/**
 * TEMPORARY import of PriceList.xls into the Warehouse Item Catalog.
 *
 *   npx tsx scripts/import-pricelist-temp.ts data/pricelist-dump.csv
 *
 * Adds every price-list item to inventory_items with section = TEMP-PRICELIST.
 * Existing catalog codes are LEFT UNTOUCHED (onConflictDoNothing), so the real
 * ~493 items keep their own section and can never be marked temporary or
 * pruned by the companion delete script.
 *
 * The CSV is the Excel "Save As CSV" export of PriceList.xls and comes out as
 * windows-1252, so it is decoded as latin1 to preserve the accented French
 * descriptions.
 */

import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { inventoryItems } from "../src/db/schema";
import {
  connect,
  extractItems,
  parseCsv,
  TEMP_SECTION,
} from "./pricelist-temp";

async function main() {
  const file = process.argv[2] ?? "data/pricelist-dump.csv";
  const text = readFileSync(file, "latin1");
  const items = extractItems(parseCsv(text));
  if (items.length === 0) throw new Error(`No items parsed from ${file}`);

  const { db, client } = connect();

  let inserted = 0;
  const CHUNK = 200;
  for (let i = 0; i < items.length; i += CHUNK) {
    const batch = items.slice(i, i + CHUNK).map((it) => ({
      code: it.code,
      description: it.description,
      section: TEMP_SECTION,
      active: true,
    }));
    const returned = await db
      .insert(inventoryItems)
      .values(batch)
      .onConflictDoNothing({ target: inventoryItems.code })
      .returning({ code: inventoryItems.code });
    inserted += returned.length;
  }

  const skipped = items.length - inserted;
  console.log(`Parsed ${items.length} unique price-list items from ${file}`);
  console.log(`  inserted as temporary (${TEMP_SECTION}): ${inserted}`);
  console.log(`  skipped (code already in catalog, untouched): ${skipped}`);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(inventoryItems)
    .where(sql`section = ${TEMP_SECTION}`);
  console.log(`Total items now tagged ${TEMP_SECTION}: ${count}`);

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
