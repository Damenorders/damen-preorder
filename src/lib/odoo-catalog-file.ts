import { parseCsv } from "@/lib/csv";
import { readXlsx } from "@/lib/xlsx-read";

// Reads the uploaded Odoo product list (.xlsx or .csv) into SKU + description
// pairs, and reports every problem instead of guessing. Pure apart from the
// file readers, so it is unit-tested (odoo-catalog-file.test.ts).
//
// The rules follow CLAUDE.md: a product is never invented, never merged on a
// guess. A SKU listed twice with two different descriptions blocks the upload
// until the file is fixed; a row missing its SKU or its description is left
// out and listed.

export type GridResult = { ok: true; grid: string[][] } | { ok: false; error: string };

export function readSpreadsheet(buffer: Buffer, fileName: string): GridResult {
  const name = fileName.toLowerCase();
  try {
    if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) {
      return { ok: true, grid: readXlsx(buffer) };
    }
    if (name.endsWith(".csv") || name.endsWith(".txt")) {
      return { ok: true, grid: parseCsv(buffer.toString("utf8")) };
    }
    if (name.endsWith(".xls")) {
      return {
        ok: false,
        error: "That's the old .xls format. Open it in Excel and Save As .xlsx (or .csv), then upload again.",
      };
    }
    return { ok: false, error: "Upload an .xlsx or .csv file." };
  } catch {
    return { ok: false, error: "That file couldn't be read as a spreadsheet." };
  }
}

/** Drops fully blank rows; every remaining cell trimmed. */
export function cleanGrid(grid: string[][]): string[][] {
  return grid
    .map((row) => row.map((c) => String(c ?? "").trim()))
    .filter((row) => row.some((c) => c !== ""));
}

/**
 * A starting suggestion for which columns hold the SKU and the description,
 * from the header names. Only a suggestion — the upload screen shows it and
 * the person confirms or changes it before anything is imported.
 */
export function guessColumns(headers: string[]): { skuCol: number; descCol: number } {
  const find = (patterns: RegExp[]) => {
    for (const re of patterns) {
      const i = headers.findIndex((h) => re.test(h.trim()));
      if (i >= 0) return i;
    }
    return -1;
  };
  const skuCol = find([
    /^internal reference$/i,
    /^default code$/i,
    /^sku$/i,
    /internal ref/i,
    /\bsku\b/i,
    /\bcode\b/i,
    /reference/i,
  ]);
  let descCol = find([/^description$/i, /^name$/i, /^product name$/i, /descr/i, /\bname\b/i, /product/i]);
  if (descCol === skuCol) descCol = -1;
  return { skuCol, descCol };
}

export interface OdooCatalogRow {
  sku: string;
  description: string;
}

export interface OdooCatalogParse {
  /** One entry per SKU, in file order. */
  products: OdooCatalogRow[];
  /** Rows left out: a SKU with no description, or a description with no SKU. */
  skipped: { sku: string; description: string; reason: string }[];
  /** Same SKU with different descriptions — blocks the upload. */
  conflicts: { sku: string; descriptions: string[] }[];
  /** Same SKU and same description more than once — kept once. */
  repeated: { sku: string; description: string; times: number }[];
  /** Different SKUs sharing one description — allowed, reported. */
  sharedDescriptions: { description: string; skus: string[] }[];
}

const fold = (s: string) => s.trim().replace(/\s+/g, " ").toUpperCase();

/**
 * Turns the data rows (header row already removed) into the product list,
 * using the columns the person confirmed.
 */
export function parseOdooCatalog(
  rows: string[][],
  skuCol: number,
  descCol: number,
): OdooCatalogParse {
  const bySku = new Map<string, { sku: string; description: string; descriptions: Map<string, string>; times: number }>();
  const skipped: OdooCatalogParse["skipped"] = [];

  for (const row of rows) {
    const sku = String(row[skuCol] ?? "").trim();
    const description = String(row[descCol] ?? "").trim().replace(/\s+/g, " ");
    if (!sku && !description) continue;
    if (!sku) {
      skipped.push({ sku, description, reason: "No SKU" });
      continue;
    }
    if (!description) {
      skipped.push({ sku, description, reason: "No description" });
      continue;
    }
    const key = sku.toUpperCase();
    const entry = bySku.get(key);
    if (!entry) {
      bySku.set(key, { sku, description, descriptions: new Map([[fold(description), description]]), times: 1 });
    } else {
      entry.times++;
      if (!entry.descriptions.has(fold(description))) entry.descriptions.set(fold(description), description);
    }
  }

  const products: OdooCatalogRow[] = [];
  const conflicts: OdooCatalogParse["conflicts"] = [];
  const repeated: OdooCatalogParse["repeated"] = [];
  for (const e of bySku.values()) {
    if (e.descriptions.size > 1) {
      conflicts.push({ sku: e.sku, descriptions: [...e.descriptions.values()] });
      continue;
    }
    if (e.times > 1) repeated.push({ sku: e.sku, description: e.description, times: e.times });
    products.push({ sku: e.sku, description: e.description });
  }

  const byDescription = new Map<string, { description: string; skus: string[] }>();
  for (const p of products) {
    const k = fold(p.description);
    const g = byDescription.get(k);
    if (g) g.skus.push(p.sku);
    else byDescription.set(k, { description: p.description, skus: [p.sku] });
  }
  const sharedDescriptions = [...byDescription.values()].filter((g) => g.skus.length > 1);

  return { products, skipped, conflicts, repeated, sharedDescriptions };
}

export interface OdooCatalogDiff {
  added: OdooCatalogRow[];
  renamed: { sku: string; from: string; to: string }[];
  /** In the current list but not in the file: kept, marked "No longer in Odoo list". */
  retired: OdooCatalogRow[];
  /** Marked "no longer in the list" before, and back in this file. */
  restored: OdooCatalogRow[];
  unchanged: number;
}

/**
 * What an upload would change. SKUs are matched ignoring case; the stored
 * spelling of an existing SKU is kept so counted rows stay linked to it.
 */
export function diffOdooCatalog(
  existing: { sku: string; description: string; active: boolean }[],
  products: OdooCatalogRow[],
): OdooCatalogDiff {
  const current = new Map(existing.map((e) => [e.sku.toUpperCase(), e]));
  const inFile = new Set(products.map((p) => p.sku.toUpperCase()));
  const diff: OdooCatalogDiff = { added: [], renamed: [], retired: [], restored: [], unchanged: 0 };

  for (const p of products) {
    const e = current.get(p.sku.toUpperCase());
    if (!e) {
      diff.added.push(p);
      continue;
    }
    if (!e.active) diff.restored.push({ sku: e.sku, description: p.description });
    if (e.description !== p.description) {
      diff.renamed.push({ sku: e.sku, from: e.description, to: p.description });
    } else if (e.active) {
      diff.unchanged++;
    }
  }
  for (const e of existing) {
    if (e.active && !inFile.has(e.sku.toUpperCase())) {
      diff.retired.push({ sku: e.sku, description: e.description });
    }
  }
  return diff;
}
