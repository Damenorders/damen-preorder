/**
 * Replaces the Product List card's product list with an Odoo export
 * (columns: Name, Internal Reference).
 *
 *   npx tsx scripts/import-product-list.ts "C:\path\Product (product.template).xlsx" --dry
 *   npx tsx scripts/import-product-list.ts "C:\path\Product (product.template).xlsx"
 *
 * - Every SKU in the file goes on the product list (in_product_list = true);
 *   every other item comes off it. Nothing is deleted, and `active` is never
 *   touched, so Warehouse Inventory and Purchase Orders are unaffected.
 * - A SKU the catalogue doesn't have is added. One it does have takes the
 *   file's wording, pushed to pallet cards, Product List lines and open
 *   purchase orders (same as a price upload).
 * - Rows without an Internal Reference are left out and listed.
 * - Prices are not in this file; item_prices is not touched.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "node:fs";
import { inArray, notInArray, sql } from "drizzle-orm";
import { db } from "../src/db";
import { inventoryItems } from "../src/db/schema";
import { readXlsx } from "../src/lib/xlsx-read";
import { syncCatalogWording } from "../src/lib/price-import";

const NEW_ITEM_SECTION = "PRODUCTLIST";

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const path = args.find((a) => !a.startsWith("--"));
  if (!path) {
    console.error(
      'Usage: npx tsx scripts/import-product-list.ts "<file.xlsx>" [--dry]',
    );
    process.exit(1);
  }

  const grid = readXlsx(readFileSync(path));
  const header = (grid[0] ?? []).map((h) => (h ?? "").trim().toLowerCase());
  const nameCol = header.indexOf("name");
  const codeCol = header.indexOf("internal reference");
  if (nameCol < 0 || codeCol < 0) {
    console.error('Row 1 must have "Name" and "Internal Reference" columns.');
    process.exit(1);
  }

  const rows = new Map<string, string>();
  const noSku: string[] = [];
  const dupes: string[] = [];
  for (const r of grid.slice(1)) {
    const name = (r[nameCol] ?? "").trim();
    const code = (r[codeCol] ?? "").trim();
    if (!name && !code) continue;
    if (!code) {
      noSku.push(name);
      continue;
    }
    if (rows.has(code) && rows.get(code) !== name) dupes.push(code);
    rows.set(code, name);
  }
  if (dupes.length) {
    console.error(
      `Stopped: these SKUs are listed twice with different wording: ${dupes.join(", ")}`,
    );
    process.exit(1);
  }

  const codes = [...rows.keys()];
  const existing = new Map<string, string>();
  for (const r of await db
    .select({ code: inventoryItems.code, description: inventoryItems.description })
    .from(inventoryItems)) {
    existing.set(r.code, r.description);
  }

  const added = codes.filter((c) => !existing.has(c));
  const reworded = codes.filter(
    (c) => existing.has(c) && rows.get(c) && existing.get(c) !== rows.get(c),
  );
  const [{ onNow }] = await db
    .select({ onNow: sql<number>`count(*)::int` })
    .from(inventoryItems)
    .where(sql`${inventoryItems.inProductList}`);

  console.log(`File: ${codes.length} products with a SKU`);
  console.log(`  new to the catalogue: ${added.length}`);
  console.log(`  wording replaced:     ${reworded.length}`);
  console.log(`  left out (no SKU):    ${noSku.length}`);
  for (const n of noSku) console.log(`    - ${n}`);
  console.log(`On the product list now: ${onNow}`);

  if (dry) {
    console.log("Dry run: nothing written.");
    process.exit(0);
  }

  await db.transaction(async (tx) => {
    const CHUNK = 400;
    for (let i = 0; i < codes.length; i += CHUNK) {
      await tx
        .insert(inventoryItems)
        .values(
          codes.slice(i, i + CHUNK).map((code) => ({
            code,
            description: rows.get(code) || code,
            section: NEW_ITEM_SECTION,
            inProductList: true,
          })),
        )
        .onConflictDoUpdate({
          target: inventoryItems.code,
          set: {
            description: sql`coalesce(nullif(excluded.description, ''), inventory_items.description)`,
            inProductList: true,
            updatedAt: new Date(),
          },
        });
    }
    await tx
      .update(inventoryItems)
      .set({ inProductList: false })
      .where(notInArray(inventoryItems.code, codes));
  });

  const synced = await syncCatalogWording(codes);

  const [{ onAfter }] = await db
    .select({ onAfter: sql<number>`count(*)::int` })
    .from(inventoryItems)
    .where(sql`${inventoryItems.inProductList}`);
  const [{ missing }] = await db
    .select({ missing: sql<number>`(${codes.length} - count(*))::int` })
    .from(inventoryItems)
    .where(inArray(inventoryItems.code, codes));

  console.log(`Done. On the product list: ${onAfter} (missing from catalogue: ${missing})`);
  console.log(
    `Wording pushed to: ${synced.placementsSynced} pallet cards, ${synced.listLinesSynced} list lines, ${synced.openOrderLinesSynced} open PO lines`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
