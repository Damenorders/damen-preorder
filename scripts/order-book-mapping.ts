/**
 * Order Book import, step 1 of 2: proposes which catalogue product each Order
 * Book product is, and writes it to a review file. READ-ONLY — it writes
 * nothing to the database.
 *
 *   npx tsx scripts/order-book-mapping.ts
 *
 * Output: order-book/import-mapping.csv, one row per Order Book product.
 *   - item_code is filled only where the Order Book name + pack, compared with
 *     case, punctuation and spacing ignored, equals exactly one catalogue
 *     description. Everything else is left blank with its candidates listed.
 *   - A person reviews the file: fill in item_code where a candidate is the
 *     same product, clear it where a proposal is wrong. Blank = skipped.
 * Step 2 (the import) follows that column and nothing else.
 */

import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { readFileSync, writeFileSync } from "node:fs";

const DATA = "order-book/order-book-data.json";
const OUT = "order-book/import-mapping.csv";

interface ObProduct {
  name: string;
  pack: string;
}

async function main() {
  // Imported lazily so dotenv has run before the database client is built.
  const { db } = await import("../src/db");
  const { inventoryItems } = await import("../src/db/schema");
  const { looksSimilar, normalizeName } = await import("../src/lib/order-book-core");
  const { toCsv } = await import("../src/lib/csv");

  const data = JSON.parse(readFileSync(DATA, "utf8")) as {
    suppliers: Record<string, { products: ObProduct[] }>;
  };

  const items = await db
    .select({ code: inventoryItems.code, name: inventoryItems.description })
    .from(inventoryItems);
  const byKey = new Map<string, typeof items>();
  for (const item of items) {
    const key = normalizeName(item.name);
    byKey.set(key, [...(byKey.get(key) ?? []), item]);
  }

  const rows: string[][] = [];
  const tally = { proposed: 0, several: 0, similar: 0, none: 0 };
  for (const [supplier, { products }] of Object.entries(data.suppliers)) {
    for (const p of products) {
      const exact = [
        ...(byKey.get(normalizeName(p.name)) ?? []),
        ...(p.pack ? byKey.get(normalizeName(`${p.name} ${p.pack}`)) ?? [] : []),
      ].filter((v, i, all) => all.findIndex((x) => x.code === v.code) === i);
      const similar = items
        .filter((i) => !exact.some((e) => e.code === i.code) && looksSimilar(i.name, p.name))
        .slice(0, 6);

      let match: string;
      let code = "";
      let description = "";
      if (exact.length === 1) {
        match = "exact (name + pack)";
        code = exact[0].code;
        description = exact[0].name;
        tally.proposed++;
      } else if (exact.length > 1) {
        match = "several exact — choose";
        tally.several++;
      } else if (similar.length > 0) {
        match = "similar — review";
        tally.similar++;
      } else {
        match = "no match";
        tally.none++;
      }
      const candidates = (exact.length > 1 ? exact : similar)
        .map((c) => `${c.code} = ${c.name}`)
        .join(" | ");
      rows.push([supplier, p.name, p.pack, match, code, description, candidates]);
    }
  }

  writeFileSync(
    OUT,
    toCsv(
      [
        "supplier",
        "order_book_product",
        "order_book_pack",
        "match",
        "item_code",
        "catalogue_description",
        "candidates",
      ],
      rows,
    ),
  );
  console.log(`Wrote ${OUT}: ${rows.length} products`, tally);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
