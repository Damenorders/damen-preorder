// Shared Product List types. Pure types with no imports, for two reasons:
// a "use server" module may only export async functions (a type re-exported
// from one becomes a runtime reference and crashes on module evaluation), and
// client components need these shapes without pulling in server code.

export interface CatalogHit {
  code: string;
  description: string;
  /** Uploaded price, or null when the price file doesn't cover this SKU. */
  price: number | null;
}

export interface ProductListLine {
  itemCode: string;
  description: string;
  addedByName: string;
  /** The uploaded catalog price, or null when the price file never had it. */
  catalogPrice: number | null;
  /** A price typed on this line for this client, or null to use the catalog. */
  priceOverride: number | null;
  /** What the sheet actually prints. */
  price: number | null;
}

export interface PriceImportReport {
  fileName: string;
  pricesSet: number;
  itemsCreated: number;
  /** Catalog descriptions the file rewrote — the file leads on wording. */
  descriptionsUpdated: number;
  /** Warehouse pallet cards brought back in line with the catalog. */
  placementsSynced: number;
  skipped: Array<{ line: number; reason: string; text: string }>;
}

export type ProductListResult = { ok: true } | { ok: false; error: string };

export type CreateProductListResult =
  | { ok: true; id: number }
  | { ok: false; error: string };

export type PriceImportResult =
  | { ok: true; report: PriceImportReport }
  | { ok: false; error: string };
