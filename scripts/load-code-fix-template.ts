/**
 * Loads the Codes to Fix template (SKU + description) from the user's Excel.
 *
 *   npx tsx scripts/load-code-fix-template.ts "<file.xlsx>"            report only
 *   npx tsx scripts/load-code-fix-template.ts "<file.xlsx>" --write    replace the template
 *
 * Columns are found by header ("Internal Reference" = SKU, "Name" =
 * description). Rows with no SKU are left out and listed. A SKU listed twice
 * with two wordings blocks the load until it is decided with
 * --pick SKU=N (N = which wording, 1-based, as the report numbers them).
 * --write replaces code_fix_catalog in one transaction; entries already saved
 * keep their own copy of each SKU and description.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { codeFixCatalog } from "../src/db/code-fix-schema";
import {
  cleanGrid,
  guessColumns,
  parseOdooCatalog,
  readSpreadsheet,
} from "../src/lib/odoo-catalog-file";

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) throw new Error("Give the template .xlsx path.");
  const write = args.includes("--write");
  const picks = new Map<string, number>();
  args.forEach((a, i) => {
    if (a !== "--pick") return;
    const [sku, n] = (args[i + 1] ?? "").split("=");
    picks.set(sku.trim().toUpperCase(), Number(n));
  });

  const read = readSpreadsheet(readFileSync(file), basename(file));
  if (!read.ok) throw new Error(read.error);
  const [header, ...rows] = cleanGrid(read.grid);
  const { skuCol, descCol } = guessColumns(header);
  if (skuCol < 0 || descCol < 0) throw new Error(`Couldn't find SKU/description columns in: ${header.join(", ")}`);
  console.log(`Columns: SKU = "${header[skuCol]}", description = "${header[descCol]}"`);

  const parsed = parseOdooCatalog(rows, skuCol, descCol);
  const products = [...parsed.products];

  console.log(`\n${parsed.skipped.length} rows left out:`);
  for (const s of parsed.skipped) console.log(`  ${s.reason}: ${s.sku || s.description}`);
  console.log(`\n${parsed.sharedDescriptions.length} descriptions shared by two SKUs (kept, the rep picks):`);
  for (const g of parsed.sharedDescriptions) console.log(`  ${g.description} → ${g.skus.join(", ")}`);

  const undecided: string[] = [];
  for (const c of parsed.conflicts) {
    console.log(`\nSKU ${c.sku} has ${c.descriptions.length} wordings:`);
    c.descriptions.forEach((d, i) => console.log(`  ${i + 1}. ${d}`));
    const n = picks.get(c.sku.toUpperCase());
    if (n && c.descriptions[n - 1]) {
      console.log(`  → using ${n}`);
      products.push({ sku: c.sku, description: c.descriptions[n - 1] });
    } else {
      undecided.push(c.sku);
    }
  }

  console.log(`\n${products.length} products ready.`);
  if (undecided.length) {
    console.log(`Not loaded: decide ${undecided.join(", ")} with --pick SKU=N.`);
    process.exit(1);
  }
  if (!write) {
    console.log("Report only — add --write to replace the template.");
    return;
  }

  const client = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  const db = drizzle(client);
  await db.transaction(async (tx) => {
    await tx.delete(codeFixCatalog);
    for (let i = 0; i < products.length; i += 500) {
      await tx.insert(codeFixCatalog).values(products.slice(i, i + 500));
    }
  });
  console.log(`Template replaced: ${products.length} products.`);
  await client.end();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
