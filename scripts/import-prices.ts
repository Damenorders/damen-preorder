/**
 * Loads a price file (SKU, Product, Price) into item_prices from the command
 * line — the same code path the Upload Prices screen uses, for when the file is
 * easier to point at on disk than to upload.
 *
 *   npx tsx scripts/import-prices.ts "C:\path\PriceList.xlsx" --dry
 *   npx tsx scripts/import-prices.ts "C:\path\PriceList.xlsx"
 *
 * .xls (the old binary format) is not readable — open it in Excel and Save As
 * .xlsx or .csv first.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import {
  applyPriceRows,
  parsePriceFile,
  previewChanges,
} from "../src/lib/price-import";

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const path = args.find((a) => !a.startsWith("--"));
  if (!path) {
    console.error("Usage: npx tsx scripts/import-prices.ts <file.xlsx|file.csv> [--dry]");
    process.exit(1);
  }

  const parsed = parsePriceFile(readFileSync(path), basename(path));
  if (!parsed.ok) {
    console.error(parsed.error);
    process.exit(1);
  }

  const preview = await previewChanges(parsed.rows);
  console.log(`File:                  ${basename(path)}`);
  console.log(`Priced rows:           ${parsed.rows.length.toLocaleString()}`);
  console.log(`New catalog items:     ${preview.itemsCreated.toLocaleString()}`);
  console.log(`Descriptions to update: ${preview.descriptionsUpdated.toLocaleString()}`);
  console.log(`Skipped rows:          ${parsed.skipped.length.toLocaleString()}`);
  for (const row of parsed.skipped.slice(0, 20)) {
    console.log(`  line ${row.line}: ${row.text || "(blank)"} — ${row.reason}`);
  }
  if (parsed.skipped.length > 20) {
    console.log(`  …and ${parsed.skipped.length - 20} more`);
  }

  if (dry) {
    console.log("\nDry run — nothing written.");
    process.exit(0);
  }

  const result = await applyPriceRows(parsed.rows, {
    userName: "import script",
    sourceFile: basename(path),
  });
  console.log(
    `\nWrote ${result.pricesSet.toLocaleString()} prices, ` +
      `added ${result.itemsCreated.toLocaleString()} catalog items, ` +
      `updated ${result.descriptionsUpdated.toLocaleString()} descriptions, ` +
      `re-synced ${result.placementsSynced.toLocaleString()} warehouse pallet cards.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
