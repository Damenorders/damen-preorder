/**
 * Shared helpers for the TEMPORARY price-list catalog import.
 *
 * The workflow (requested by Damen Orders):
 *   1. Bulk-load every item from PriceList.xls into the Warehouse Item Catalog
 *      (inventory_items) marked with section = TEMP_SECTION, so the whole price
 *      list is searchable/placeable without touching the ~493 real items.
 *   2. Later, on the "delete the temporary items" command, prune every temp item
 *      that was never given a warehouse location (no inventory_placements row).
 *      Temp items that DID get placed are promoted into the real catalog.
 *
 * The marker is the `section` value: it is free-text, only rendered as a small
 * chip in the warehouse UI, so it is a safe, visible, fully-reversible tag.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/db/schema";

/** The tag that identifies items added by the temporary price-list import. */
export const TEMP_SECTION = "TEMP-PRICELIST";

/** Section given to a temp item once it has been placed (kept on prune). */
export const KEEP_SECTION = "SEC";

export function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.local)");
  const client = postgres(url, { prepare: false });
  const db = drizzle(client, { schema });
  return { db, client };
}

/**
 * Parses an RFC-4180-ish CSV (Excel `Save As CSV` output): handles quoted
 * fields, embedded commas/newlines, and `""` escapes. Returns an array of
 * records, each an array of string fields.
 */
export function parseCsv(text: string): string[][] {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let i = 0;
  // Strip a leading BOM if present.
  if (text.charCodeAt(0) === 0xfeff) i = 1;

  const pushField = () => {
    record.push(field);
    field = "";
  };
  const pushRecord = () => {
    pushField();
    records.push(record);
    record = [];
  };

  for (; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      pushField();
    } else if (ch === "\r") {
      // handled together with \n below
    } else if (ch === "\n") {
      pushRecord();
    } else {
      field += ch;
    }
  }
  // Trailing field/record (file may not end with a newline).
  if (field.length > 0 || record.length > 0) pushRecord();
  return records;
}

/**
 * Turns the parsed price-list CSV into de-duplicated {code, description} rows,
 * dropping the title banner, the "Item No." header, and any blank rows.
 */
export function extractItems(
  records: string[][],
): Array<{ code: string; description: string }> {
  const byCode = new Map<string, string>();
  for (const rec of records) {
    const code = (rec[0] ?? "").trim();
    const description = (rec[1] ?? "").trim();
    if (!code || !description) continue;
    if (code.toLowerCase() === "item no.") continue; // column header
    // Last write wins if the same code appears twice in the file.
    byCode.set(code, description);
  }
  return [...byCode.entries()].map(([code, description]) => ({
    code,
    description,
  }));
}
