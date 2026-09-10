import { inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { inventoryItems, itemPrices } from "@/db/schema";
import { parseCsv } from "@/lib/csv";
import { readXlsx } from "@/lib/xlsx-read";
import { readPriceFile, type PriceRow } from "@/lib/price-file";
import type { PriceImportReport } from "@/lib/product-list-types";

// The one place a price file turns into rows in the database. The upload screen
// and scripts/import-prices.ts both come through here, so a price loaded from
// the command line is identical to one loaded from a phone.
//
// Not marked server-only: the CLI script imports it directly.

// Catalog section given to items the price file introduces. Deliberately NOT
// the TEMP-PRICELIST tag: scripts/delete-pricelist-temp.ts prunes that one, and
// these are meant to stay.
export const PRICE_FILE_SECTION = "PRICELIST";

export type { PriceImportReport } from "@/lib/product-list-types";

export type ParseResult =
  | { ok: true; rows: PriceRow[]; skipped: PriceImportReport["skipped"] }
  | { ok: false; error: string };

/** Reads .xlsx or .csv bytes into priced rows, or explains why it can't. */
export function parsePriceFile(buffer: Buffer, fileName: string): ParseResult {
  const name = fileName.toLowerCase();

  let grid: string[][];
  try {
    if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) {
      grid = readXlsx(buffer);
    } else if (name.endsWith(".csv") || name.endsWith(".txt")) {
      grid = parseCsv(buffer.toString("utf8"));
    } else if (name.endsWith(".xls")) {
      return {
        ok: false,
        error:
          "That's the old .xls format. Open it in Excel and Save As .xlsx (or .csv), then upload again.",
      };
    } else {
      return { ok: false, error: "Upload an .xlsx or .csv file." };
    }
  } catch {
    return { ok: false, error: "That file couldn't be read as a spreadsheet." };
  }

  const parsed = readPriceFile(grid);
  if (parsed.rows.length === 0) {
    return {
      ok: false,
      error:
        "No priced rows found. The file needs a SKU, a product name and a price.",
    };
  }
  return { ok: true, rows: parsed.rows, skipped: parsed.skipped };
}

/** How many of these SKUs the catalog doesn't have yet. */
export async function countNewItems(rows: PriceRow[]): Promise<number> {
  const existing = await existingCodes(rows.map((r) => r.code));
  return rows.filter((r) => !existing.has(r.code)).length;
}

async function existingCodes(codes: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  // Chunked: a few thousand codes in one IN (...) is a needlessly huge query.
  const CHUNK = 800;
  for (let i = 0; i < codes.length; i += CHUNK) {
    const rows = await db
      .select({ code: inventoryItems.code })
      .from(inventoryItems)
      .where(inArray(inventoryItems.code, codes.slice(i, i + CHUNK)));
    for (const row of rows) found.add(row.code);
  }
  return found;
}

/**
 * Writes the prices. A SKU the catalog doesn't have is added so it becomes
 * searchable; an existing item keeps its own description and section. Per-line
 * overrides a buyer typed on a list are untouched — that is the point of them.
 */
export async function applyPriceRows(
  rows: PriceRow[],
  by: { userId?: string; userName: string; sourceFile: string },
): Promise<{ pricesSet: number; itemsCreated: number }> {
  const existing = await existingCodes(rows.map((r) => r.code));
  const itemsCreated = rows.filter((r) => !existing.has(r.code)).length;

  const CHUNK = 400;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);

    await db.transaction(async (tx) => {
      const newItems = chunk.filter((r) => !existing.has(r.code));
      if (newItems.length > 0) {
        await tx
          .insert(inventoryItems)
          .values(
            newItems.map((r) => ({
              code: r.code,
              description: r.description || r.code,
              section: PRICE_FILE_SECTION,
            })),
          )
          .onConflictDoNothing();
      }

      await tx
        .insert(itemPrices)
        .values(
          chunk.map((r) => ({
            itemCode: r.code,
            price: r.price.toFixed(4),
            updatedBy: by.userId,
            updatedByName: by.userName,
            sourceFile: by.sourceFile.slice(0, 200),
          })),
        )
        .onConflictDoUpdate({
          target: itemPrices.itemCode,
          set: {
            price: sql`excluded.price`,
            updatedBy: sql`excluded.updated_by`,
            updatedByName: sql`excluded.updated_by_name`,
            sourceFile: sql`excluded.source_file`,
            updatedAt: new Date(),
          },
        });
    });
  }

  return { pricesSet: rows.length, itemsCreated };
}
