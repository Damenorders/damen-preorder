// Codes to Fix — the SKU/description lookup and the line checks, shared by the
// form (auto-fill) and the server action (validation). Pure, so it is
// unit-tested (code-fix.test.ts).
//
// CLAUDE.md rules: nothing is guessed. A SKU found in the template always
// takes the template's description; a description shared by two SKUs fills
// nothing until the rep picks one; a SKU not in the template keeps the
// description the rep typed.

export interface CatalogItem {
  sku: string;
  description: string;
}

export interface CatalogLookup {
  items: CatalogItem[];
  bySku: Map<string, CatalogItem>;
  byDescription: Map<string, CatalogItem[]>;
}

/** Case and spacing folded — how two SKUs or descriptions are compared. */
export const fold = (s: string) => s.trim().replace(/\s+/g, " ").toUpperCase();

/** Accents and punctuation dropped too — only for the search box. */
const searchFold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

export function buildLookup(items: CatalogItem[]): CatalogLookup {
  const bySku = new Map<string, CatalogItem>();
  const byDescription = new Map<string, CatalogItem[]>();
  for (const item of items) {
    bySku.set(fold(item.sku), item);
    const k = fold(item.description);
    byDescription.set(k, [...(byDescription.get(k) ?? []), item]);
  }
  return { items, bySku, byDescription };
}

export function findBySku(lookup: CatalogLookup, sku: string): CatalogItem | null {
  return lookup.bySku.get(fold(sku)) ?? null;
}

/** Every SKU with exactly this description (usually one; sometimes two). */
export function findByDescription(lookup: CatalogLookup, description: string): CatalogItem[] {
  return lookup.byDescription.get(fold(description)) ?? [];
}

/**
 * Template products whose SKU or description contains every typed word, in
 * any order. SKU matches first, then description order.
 */
export function searchCatalog(lookup: CatalogLookup, query: string, limit = 8): CatalogItem[] {
  const words = searchFold(query).split(" ").filter(Boolean);
  if (words.length === 0) return [];
  const hits: { item: CatalogItem; rank: number }[] = [];
  for (const item of lookup.items) {
    const sku = searchFold(item.sku);
    const hay = `${sku} ${searchFold(item.description)}`;
    if (!words.every((w) => hay.includes(w))) continue;
    const q = words.join(" ");
    const rank = sku === q ? 0 : sku.startsWith(q) ? 1 : 2;
    hits.push({ item, rank });
  }
  hits.sort((a, b) => a.rank - b.rank || a.item.description.localeCompare(b.item.description));
  return hits.slice(0, limit).map((h) => h.item);
}

/** "30", "$30", "30$", "30,50" → 30 / 30.5. Null when not a valid price. */
export function parsePrice(raw: string): number | null {
  const s = raw.trim().replace(/\$/g, "").replace(/\s+/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Number(s);
}

export interface CodeFixLineInput {
  id?: number;
  clientSku: string;
  clientDescription: string;
  price: string;
  generalSku: string;
  generalDescription: string;
}

export interface CleanLine {
  id?: number;
  clientSku: string | null;
  clientDescription: string | null;
  price: string | null; // two decimals, as stored
  generalSku: string | null;
  generalDescription: string | null;
}

/**
 * Cleans one line against the template. Every field is optional. A SKU in the
 * template takes the template's spelling and description; any other SKU or
 * description is kept as typed. Only a price that is typed but not a price
 * is refused.
 */
export function checkLine(
  lookup: CatalogLookup,
  line: CodeFixLineInput,
  n: number,
): { ok: true; line: CleanLine } | { ok: false; error: string } {
  const resolve = (sku: string, description: string) => {
    const s = sku.trim();
    const d = description.trim().replace(/\s+/g, " ");
    const hit = s ? findBySku(lookup, s) : null;
    if (hit) return { sku: hit.sku, description: hit.description };
    return { sku: s || null, description: d || null };
  };

  let price: string | null = null;
  if (line.price.trim()) {
    const p = parsePrice(line.price);
    if (p === null) return { ok: false, error: `Product ${n}: "${line.price}" is not a price.` };
    price = p.toFixed(2);
  }

  const c = resolve(line.clientSku, line.clientDescription);
  const g = resolve(line.generalSku, line.generalDescription);
  return {
    ok: true,
    line: {
      id: line.id,
      clientSku: c.sku,
      clientDescription: c.description,
      price,
      generalSku: g.sku,
      generalDescription: g.description,
    },
  };
}
