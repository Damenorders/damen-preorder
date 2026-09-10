import { and, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { inventoryItems, inventoryPlacements, itemPrices } from "@/db/schema";
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

/** What the file would change: new items, and descriptions it rewrites. */
export async function previewChanges(
  rows: PriceRow[],
): Promise<{ itemsCreated: number; descriptionsUpdated: number }> {
  const existing = await existingItems(rows.map((r) => r.code));
  return countChanges(rows, existing);
}

function countChanges(rows: PriceRow[], existing: Map<string, string>) {
  let itemsCreated = 0;
  let descriptionsUpdated = 0;
  for (const row of rows) {
    const current = existing.get(row.code);
    if (current === undefined) itemsCreated++;
    else if (row.description && row.description !== current) {
      descriptionsUpdated++;
    }
  }
  return { itemsCreated, descriptionsUpdated };
}

/** Current code -> description for the SKUs in the file. */
async function existingItems(codes: string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  // Chunked: a few thousand codes in one IN (...) is a needlessly huge query.
  const CHUNK = 800;
  for (let i = 0; i < codes.length; i += CHUNK) {
    const rows = await db
      .select({
        code: inventoryItems.code,
        description: inventoryItems.description,
      })
      .from(inventoryItems)
      .where(inArray(inventoryItems.code, codes.slice(i, i + CHUNK)));
    for (const row of rows) found.set(row.code, row.description);
  }
  return found;
}

/**
 * Writes the prices, with the uploaded file leading on descriptions: a SKU the
 * catalog doesn't have is added, and one it does have takes the file's wording
 * (its section is left alone — that's warehouse data, not price-file data).
 * Per-line price overrides a buyer typed on a list are untouched — that is the
 * point of them.
 */
export async function applyPriceRows(
  rows: PriceRow[],
  by: { userId?: string; userName: string; sourceFile: string },
): Promise<{
  pricesSet: number;
  itemsCreated: number;
  descriptionsUpdated: number;
  placementsSynced: number;
}> {
  const existing = await existingItems(rows.map((r) => r.code));
  const { itemsCreated, descriptionsUpdated } = countChanges(rows, existing);

  const CHUNK = 400;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);

    await db.transaction(async (tx) => {
      await tx
        .insert(inventoryItems)
        .values(
          chunk.map((r) => ({
            code: r.code,
            description: r.description || r.code,
            // Only used when the row is genuinely new: the DO UPDATE below
            // never touches section, so an existing item keeps the warehouse's.
            section: PRICE_FILE_SECTION,
          })),
        )
        .onConflictDoUpdate({
          target: inventoryItems.code,
          set: {
            // A blank description in the file must not wipe a good one.
            description: sql`coalesce(nullif(excluded.description, ''), inventory_items.description)`,
            updatedAt: new Date(),
          },
        });

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

  const placementsSynced = await syncPlacementDescriptions(
    rows.map((r) => r.code),
  );

  return { pricesSet: rows.length, itemsCreated, descriptionsUpdated, placementsSynced };
}

/**
 * Pallet cards store their own copy of the description, so a corrected pack
 * size or a "DO NOT USE" flag has to be pushed out to them or the person at the
 * rack reads stale text. Text only: this updates a column and never inserts or
 * deletes a placement, so it cannot disturb what is physically on a pallet.
 */
async function syncPlacementDescriptions(codes: string[]): Promise<number> {
  let synced = 0;
  const CHUNK = 800;
  for (let i = 0; i < codes.length; i += CHUNK) {
    const slice = codes.slice(i, i + CHUNK);
    const updated = await db
      .update(inventoryPlacements)
      .set({
        description: sql`(select i.description from inventory_items i where i.code = ${inventoryPlacements.itemCode})`,
      })
      .where(
        and(
          inArray(inventoryPlacements.itemCode, slice),
          sql`${inventoryPlacements.description} is distinct from (select i.description from inventory_items i where i.code = ${inventoryPlacements.itemCode})`,
        ),
      )
      .returning({ id: inventoryPlacements.id });
    synced += updated.length;
  }
  return synced;
}
