// Purchase Orders — the pure rules, ported from the Order Book (the
// order-book snapshot's quick add, matchProduct, commitLine, markOrdered, undo
// and linesText). No database, no React, no server-only imports: the buyer
// screens, the server actions and the tests all share this, so "what counts as
// the same product" is decided in exactly one place.
//
// The rules, in one breath: the same item written differently is the SAME
// product; a different pack is a DIFFERENT product; when unsure, ask. Nothing
// here ever picks for the buyer on a guess.

export const PURCHASE_UNITS = ["pallet", "case", "box", "bag", "each"] as const;
export type PurchaseUnit = (typeof PURCHASE_UNITS)[number];

export const PURCHASE_METHODS = ["delivery", "pickup"] as const;
export type PurchaseMethod = (typeof PURCHASE_METHODS)[number];

export function isPurchaseUnit(value: unknown): value is PurchaseUnit {
  return (PURCHASE_UNITS as readonly unknown[]).includes(value);
}

export function isPurchaseMethod(value: unknown): value is PurchaseMethod {
  return (PURCHASE_METHODS as readonly unknown[]).includes(value);
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/** Uppercase, every run of non-alphanumerics -> one space, trimmed. */
export function normalizeName(s: string | null | undefined): string {
  return String(s ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/** Like normalizeName, but a decimal comma becomes a point and points stay. */
export function normalizePack(s: string | null | undefined): string {
  return String(s ?? "")
    .toUpperCase()
    .replace(/,/g, ".")
    .replace(/[^A-Z0-9.]+/g, " ")
    .trim();
}

/**
 * Supplier identity: "Fra Di", "FRA-DI" and "fradi" are one supplier, so the
 * spaces normalizeName leaves are dropped as well.
 */
export function supplierKey(s: string | null | undefined): string {
  return normalizeName(s).replace(/ /g, "");
}

function significantWords(s: string): string[] {
  return normalizeName(s)
    .split(" ")
    .filter((w) => w.length > 2);
}

/**
 * Only ever used to decide whether to ASK. Words of 3+ characters; the share
 * of the first name's words found in the second, over the smaller word count,
 * must reach 0.7. Compound spellings ("BREADCRUMB" vs "BREAD CRUMBS")
 * deliberately fall under it.
 */
export function looksSimilar(a: string, b: string): boolean {
  const wa = significantWords(a);
  const wb = significantWords(b);
  if (wa.length === 0 || wb.length === 0) return false;
  const shared = wa.filter((w) => wb.includes(w)).length;
  return shared / Math.min(wa.length, wb.length) >= 0.7;
}

/** The words a typeahead query must all find, in any order. */
export function queryWords(query: string): string[] {
  return normalizeName(query).split(" ").filter(Boolean);
}

/** True when every query word appears somewhere in the given text parts. */
export function matchesQuery(
  query: string,
  parts: Array<string | null | undefined>,
): boolean {
  const words = queryWords(query);
  if (words.length === 0) return false;
  const haystack = normalizeName(parts.filter(Boolean).join(" "));
  return words.every((w) => haystack.includes(w));
}

// ---------------------------------------------------------------------------
// Catalogue resolution (spec §5 a–e)
// ---------------------------------------------------------------------------

export interface Sourcing {
  supplierId: number;
  supplierName: string;
  supplierSku: string;
  purchasePack: string;
  /** Optional: the buyer picks the unit on each order line. */
  purchaseUnit: PurchaseUnit | null;
}

/** One sales-catalogue product, with its preferred sourcing when it has one. */
export interface CatalogEntry {
  code: string;
  name: string;
  sourcing: Sourcing | null;
}

export type Resolution =
  | { kind: "ready"; entry: CatalogEntry; sourcing: Sourcing }
  | { kind: "needs-sourcing"; entry: CatalogEntry }
  | { kind: "choose"; entries: CatalogEntry[] }
  | { kind: "similar"; entries: CatalogEntry[] }
  | { kind: "none"; typed: string };

/** Resolution for one product the buyer explicitly picked. */
export function resolvePicked(entry: CatalogEntry): Resolution {
  return entry.sourcing
    ? { kind: "ready", entry, sourcing: entry.sourcing }
    : { kind: "needs-sourcing", entry };
}

/** The Order Book offers at most this many near misses. */
export const MAX_SIMILAR = 6;

/**
 * Typed text against the catalogue, as the Order Book's quick add does it:
 * exact means equal after normalizeName (a product code typed exactly counts
 * too — our catalogue has codes, the Order Book does not). One exact match
 * acts; several ask; otherwise up to six similar ones are offered; nothing at
 * all says so. A reordered or abbreviated name lands in "similar" and is asked
 * about, never acted on.
 */
export function resolveTyped(
  typed: string,
  catalog: CatalogEntry[],
): Resolution {
  const key = normalizeName(typed);
  if (!key) return { kind: "none", typed };
  const code = typed.trim().toUpperCase();

  const exact = catalog.filter(
    (e) => normalizeName(e.name) === key || e.code.toUpperCase() === code,
  );
  if (exact.length === 1) return resolvePicked(exact[0]);
  if (exact.length > 1) return { kind: "choose", entries: exact };

  const similar = catalog
    .filter((e) => looksSimilar(e.name, typed))
    .slice(0, MAX_SIMILAR);
  if (similar.length > 0) return { kind: "similar", entries: similar };

  return { kind: "none", typed };
}

// ---------------------------------------------------------------------------
// Supplier assignment (spec §6)
// ---------------------------------------------------------------------------

export interface SupplierRef {
  id: number;
  name: string;
  aliases?: string[];
}

export type SupplierMatch<S extends SupplierRef> =
  | { kind: "existing"; supplier: S }
  | { kind: "similar"; suppliers: S[] }
  | { kind: "new"; name: string }
  | { kind: "empty" };

/**
 * A typed supplier name against the suppliers on file. Same key (name or any
 * alias) is the same supplier — no duplicate is ever created for it. A near
 * miss is returned for the buyer to decide; only a clear miss is "new".
 */
export function matchSupplierName<S extends SupplierRef>(
  typed: string,
  suppliers: S[],
): SupplierMatch<S> {
  const key = supplierKey(typed);
  if (!key) return { kind: "empty" };

  const same = suppliers.filter((s) =>
    [s.name, ...(s.aliases ?? [])].some((n) => supplierKey(n) === key),
  );
  // Several records sharing a key are older duplicates; the first one filed
  // wins, so every buyer lands on the same record.
  if (same.length > 0) {
    return { kind: "existing", supplier: [...same].sort((a, b) => a.id - b.id)[0] };
  }

  const similar = suppliers.filter((s) =>
    [s.name, ...(s.aliases ?? [])].some((n) => looksSimilar(n, typed)),
  );
  if (similar.length > 0) return { kind: "similar", suppliers: similar };

  return { kind: "new", name: typed.trim() };
}

export type SourcingCheck =
  | { ok: true; purchasePack: string; purchaseUnit: PurchaseUnit | null; supplierSku: string }
  | { ok: false; field: "purchasePack" | "purchaseUnit"; message: string };

/**
 * The pack is required and taken exactly as typed. The unit is optional (the
 * buyer picks one on every order line), but when given it must be a real one.
 * SKU is optional.
 */
export function checkSourcingInput(input: {
  purchasePack?: string | null;
  purchaseUnit?: string | null;
  supplierSku?: string | null;
}): SourcingCheck {
  const purchasePack = String(input.purchasePack ?? "").trim();
  if (!purchasePack) {
    return {
      ok: false,
      field: "purchasePack",
      message: "Enter the purchase pack as it is printed on the invoice, e.g. 6 X 2.84L.",
    };
  }
  const unit = String(input.purchaseUnit ?? "").trim();
  if (unit && !isPurchaseUnit(unit)) {
    return {
      ok: false,
      field: "purchaseUnit",
      message: "Choose pallet, case, box, bag or each — or leave the unit blank.",
    };
  }
  return {
    ok: true,
    purchasePack,
    purchaseUnit: isPurchaseUnit(unit) ? unit : null,
    supplierSku: String(input.supplierSku ?? "").trim(),
  };
}

/** Sourcing lives on the catalogue product, so every later lookup sees it. */
export function assignInCatalog(
  catalog: CatalogEntry[],
  code: string,
  sourcing: Sourcing,
): CatalogEntry[] {
  return catalog.map((e) =>
    e.code === code ? { ...e, sourcing: { ...sourcing } } : { ...e },
  );
}

// ---------------------------------------------------------------------------
// Line input (spec §5 f)
// ---------------------------------------------------------------------------

export type LineInputCheck =
  | { ok: true; qty: number; unit: PurchaseUnit }
  | { ok: false; field: "qty" | "unit"; message: string };

/**
 * Quantity and unit exactly as the buyer left them. A cleared box is a
 * question, never a silent 1; a unit is never guessed from pack text.
 */
export function checkLineInput(
  qtyText: string | null | undefined,
  unit: string | null | undefined,
): LineInputCheck {
  const shown = String(qtyText ?? "").trim();
  if (!shown) {
    return { ok: false, field: "qty", message: "How many? The quantity box is empty." };
  }
  const raw = shown.replace(",", ".");
  if (!/^\d+(\.\d{1,3})?$/.test(raw) || Number(raw) <= 0) {
    return {
      ok: false,
      field: "qty",
      message: `"${shown}" isn't a quantity. Enter a number like 2 or 1.5.`,
    };
  }
  if (!isPurchaseUnit(unit)) {
    return {
      ok: false,
      field: "unit",
      message: "Which unit? Choose pallet, case, box, bag or each.",
    };
  }
  return { ok: true, qty: Number(raw), unit };
}

// ---------------------------------------------------------------------------
// Purchase orders (spec §7) — an in-memory model of what the server does in
// SQL. Every function returns new data and never mutates its input, so a line
// moved into history can never be edited through a live reference.
// ---------------------------------------------------------------------------

export interface PoLine {
  id: string;
  productId: string;
  qty: number;
  unit: PurchaseUnit;
  nameAtTime: string;
  packAtTime: string;
}

export interface PurchaseOrder {
  id: string;
  supplierId: number;
  status: "open" | "ordered";
  method: PurchaseMethod;
  wantedFor: string;
  orderedOn: string | null;
  lines: PoLine[];
}

export interface Book {
  orders: PurchaseOrder[];
}

/** Keeps quantities tidy: 0.1 + 0.2 must print as 0.3. */
export function addQty(a: number, b: number): number {
  return Math.round((a + b) * 1000) / 1000;
}

/** Same product at the same unit adds up; a different unit is its own line. */
export function mergeLine(lines: PoLine[], line: PoLine): PoLine[] {
  const i = lines.findIndex(
    (l) => l.productId === line.productId && l.unit === line.unit,
  );
  if (i === -1) return [...lines.map((l) => ({ ...l })), { ...line }];
  return lines.map((l, j) =>
    j === i ? { ...l, qty: addQty(l.qty, line.qty) } : { ...l },
  );
}

/**
 * Changes one line's unit. Landing on a unit the same product already has on
 * this order merges the two lines (quantities summed), so the identity rule —
 * one line per product per unit — still holds.
 */
export function changeLineUnit(
  lines: PoLine[],
  lineId: string,
  unit: PurchaseUnit,
): { lines: PoLine[]; merged: boolean } {
  const line = lines.find((l) => l.id === lineId);
  if (!line || line.unit === unit) {
    return { lines: lines.map((l) => ({ ...l })), merged: false };
  }
  const rest = lines.filter((l) => l.id !== lineId);
  const merged = rest.some((l) => l.productId === line.productId && l.unit === unit);
  if (!merged) {
    return {
      lines: lines.map((l) => (l.id === lineId ? { ...l, unit } : { ...l })),
      merged: false,
    };
  }
  return { lines: mergeLine(rest, { ...line, unit }), merged: true };
}

function cloneOrder(po: PurchaseOrder): PurchaseOrder {
  return { ...po, lines: po.lines.map((l) => ({ ...l })) };
}

export function openOrderFor(
  book: Book,
  supplierId: number,
): PurchaseOrder | undefined {
  return book.orders.find(
    (o) => o.supplierId === supplierId && o.status === "open",
  );
}

/** Puts a line on the supplier's open order, opening one if needed. */
export function addLineToBook(
  book: Book,
  supplierId: number,
  line: PoLine,
  newOrderId: string,
): Book {
  const open = openOrderFor(book, supplierId);
  if (!open) {
    return {
      orders: [
        ...book.orders.map(cloneOrder),
        {
          id: newOrderId,
          supplierId,
          status: "open",
          method: "delivery",
          wantedFor: "",
          orderedOn: null,
          lines: [{ ...line }],
        },
      ],
    };
  }
  return {
    orders: book.orders.map((o) =>
      o === open
        ? { ...cloneOrder(o), lines: mergeLine(o.lines, line) }
        : cloneOrder(o),
    ),
  };
}

/** The open order becomes history; the supplier has no open order after. */
export function markOrderedInBook(
  book: Book,
  orderId: string,
  orderedOn: string,
): Book {
  return {
    orders: book.orders.map((o) =>
      o.id === orderId && o.status === "open"
        ? { ...cloneOrder(o), status: "ordered", orderedOn }
        : cloneOrder(o),
    ),
  };
}

/**
 * An ordered PO goes back on the next order and leaves History. Lines merge
 * into whatever is already open for that supplier by the same identity rule,
 * and method and wanted-for date come back from the ordered record.
 */
export function undoOrderedInBook(book: Book, orderId: string): Book {
  const ordered = book.orders.find(
    (o) => o.id === orderId && o.status === "ordered",
  );
  if (!ordered) return { orders: book.orders.map(cloneOrder) };

  const open = openOrderFor(book, ordered.supplierId);
  if (!open) {
    return {
      orders: book.orders.map((o) =>
        o === ordered
          ? { ...cloneOrder(o), status: "open", orderedOn: null }
          : cloneOrder(o),
      ),
    };
  }

  let lines = open.lines.map((l) => ({ ...l }));
  for (const line of ordered.lines) lines = mergeLine(lines, line);
  return {
    orders: book.orders
      .filter((o) => o !== ordered)
      .map((o) =>
        o === open
          ? {
              ...cloneOrder(o),
              method: ordered.method,
              wantedFor: ordered.wantedFor,
              lines,
            }
          : cloneOrder(o),
      ),
  };
}

/** A catalogue rename reaches open lines only; history keeps its wording. */
export function renameInBook(
  book: Book,
  productId: string,
  newName: string,
): Book {
  return {
    orders: book.orders.map((o) =>
      o.status === "open"
        ? {
            ...cloneOrder(o),
            lines: o.lines.map((l) =>
              l.productId === productId
                ? { ...l, nameAtTime: newName }
                : { ...l },
            ),
          }
        : cloneOrder(o),
    ),
  };
}

// ---------------------------------------------------------------------------
// Copy order (spec §8)
// ---------------------------------------------------------------------------

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * "2026-09-15" -> "September 15, 2026". Empty stays empty; anything that is
 * not a YYYY-MM-DD shape comes back as typed, as in the Order Book.
 */
export function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const b = String(iso).split("-");
  if (b.length !== 3) return String(iso);
  const month = MONTHS[Number(b[1]) - 1];
  if (!month) return String(iso);
  return `${month} ${Number(b[2])}, ${b[0]}`;
}

export function formatQty(qty: number): string {
  return String(Math.round(qty * 1000) / 1000);
}

export interface CopyLine {
  qty: number;
  unit: PurchaseUnit;
  nameAtTime: string;
  packAtTime: string;
}

/** "- 2 pallet NAME (PACK)" for named units, "- 12x NAME (PACK)" for each. */
export function formatCopyLine(line: CopyLine): string {
  const qty =
    line.unit === "each"
      ? `${formatQty(line.qty)}x`
      : `${formatQty(line.qty)} ${line.unit}`;
  const pack = line.packAtTime ? ` (${line.packAtTime})` : "";
  return `- ${qty} ${line.nameAtTime}${pack}`;
}

/** The message sent to the supplier — byte for byte the Order Book's. */
export function formatCopyOrder(order: {
  contact: string | null | undefined;
  method: PurchaseMethod | null | undefined;
  wantedFor: string | null | undefined;
  lines: CopyLine[];
}): string {
  const who = String(order.contact ?? "").trim() || "there";
  const when = order.wantedFor ? formatLongDate(order.wantedFor) : "____";
  const how = order.method || "delivery";
  return (
    `Hello ${who}, I would like to order the following products for ${how} on ${when} : \n\n` +
    order.lines.map((l) => `${formatCopyLine(l)}\n`).join("") +
    "\n\nPlease Confirm\nThank you\n"
  );
}

// ---------------------------------------------------------------------------
// Suppliers view (SUPPLIERS-TAB-SPEC.md)
// ---------------------------------------------------------------------------

/** One product we buy from one supplier: a catalogue item plus its sourcing. */
export interface SupplierProduct {
  sourcingId: string;
  code: string;
  name: string;
  pack: string;
  unit: PurchaseUnit | null;
  /** Per purchase pack. */
  cost: number | null;
  /** Per purchase pack. */
  sell: number | null;
  /** YYYY-MM-DD the cost last changed. */
  costSetOn: string | null;
  /** The supplier the Buyer card uses for this product. */
  preferred: boolean;
  /** The uploaded price file covers this product, so it leads on wording. */
  inPriceFile?: boolean;
}

export interface SupplierBlock {
  id: number;
  name: string;
  address: string;
  contact: string;
  email: string;
  products: SupplierProduct[];
}

export type SupplierEditCheck =
  | { kind: "blank" }
  | { kind: "clash"; supplier: SupplierRef }
  | { kind: "ok"; name: string; address: string };

/**
 * A rename on one supplier. The name is required, and it may not land on
 * another supplier's name or alias: two records for one supplier split its
 * price history and its orders, which is exactly the mess this refuses to
 * create. The address is free text — only trimmed.
 */
export function checkSupplierEdit<S extends SupplierRef>(
  supplierId: number,
  next: { name: string; address?: string | null },
  others: S[],
): SupplierEditCheck {
  const name = String(next.name ?? "").trim();
  const key = supplierKey(name);
  if (!key) return { kind: "blank" };

  const clash = others.find(
    (s) =>
      s.id !== supplierId &&
      [s.name, ...(s.aliases ?? [])].some((n) => supplierKey(n) === key),
  );
  if (clash) return { kind: "clash", supplier: clash };

  return { kind: "ok", name, address: String(next.address ?? "").trim() };
}

export type PriceCheck =
  | { ok: true; value: number | null }
  | { ok: false; message: string };

/** A cost or sell box: blank is allowed (null); otherwise a number >= 0. */
export function checkPrice(text: string | null | undefined): PriceCheck {
  const raw = String(text ?? "").trim().replace(/^\$/, "").replace(/,/g, "");
  if (!raw) return { ok: true, value: null };
  if (!/^\d+(\.\d{1,4})?$/.test(raw)) {
    return { ok: false, message: "Enter a price like 48 or 48.50, or leave it blank." };
  }
  return { ok: true, value: Number(raw) };
}

export interface Margin {
  /** Whole percent. */
  pct: number;
  /** sell − cost, in dollars. */
  diff: number;
  /** Under 15%: shown in the warning colour. */
  thin: boolean;
}

/** (sell − cost) / sell × 100. Never stored; null unless both are present. */
export function computeMargin(
  cost: number | null | undefined,
  sell: number | null | undefined,
): Margin | null {
  if (cost == null || sell == null || !sell) return null;
  const exact = ((sell - cost) / sell) * 100;
  return {
    pct: Math.round(exact),
    diff: Math.round((sell - cost) * 100) / 100,
    thin: exact < 15,
  };
}

/**
 * What a cost edit does to the "cost set" date: a real change stamps today,
 * clearing the cost clears the date, and the same value changes nothing.
 */
export function applyCostChange(
  current: { cost: number | null; costSetOn: string | null },
  next: number | null,
  today: string,
): { changed: boolean; cost: number | null; costSetOn: string | null } {
  if (next === current.cost) return { changed: false, ...current };
  return { changed: true, cost: next, costSetOn: next === null ? null : today };
}

export type SupplierProductMatch<P extends SupplierProduct = SupplierProduct> =
  | { kind: "exact"; product: P }
  | { kind: "pack-conflict"; product: P }
  | { kind: "similar"; product: P }
  | { kind: "new" };

/**
 * An incoming product for one supplier, as the Order Book's matchProduct:
 * the same item at the same pack is reused (never duplicated), a similar name
 * at the same pack is asked about, a different pack is a new product. Our
 * catalogue adds one case: the same catalogue item at a different pack cannot
 * be a second row for this supplier, so it is refused rather than guessed.
 */
export function matchSupplierProduct<P extends SupplierProduct>(
  products: P[],
  incoming: { code: string; name: string; pack: string },
): SupplierProductMatch<P> {
  const n = normalizeName(incoming.name);
  const p = normalizePack(incoming.pack);

  const exact = products.find(
    (x) =>
      (x.code === incoming.code || normalizeName(x.name) === n) &&
      normalizePack(x.pack) === p,
  );
  if (exact) return { kind: "exact", product: exact };

  const sameItem = products.find((x) => x.code === incoming.code);
  if (sameItem) return { kind: "pack-conflict", product: sameItem };

  const similar = products.find(
    (x) => normalizePack(x.pack) === p && looksSimilar(x.name, incoming.name),
  );
  if (similar) return { kind: "similar", product: similar };

  return { kind: "new" };
}

export type EditCheck =
  | { kind: "blank" }
  | { kind: "cosmetic" }
  | { kind: "clash"; name: string; pack: string }
  | { kind: "ok" };

/**
 * A rename or pack edit on one supplier row. Refused when it would land on
 * another product — anywhere in the catalogue for a name (names are shared),
 * and within the supplier for name + pack.
 */
export function checkProductEdit(
  row: SupplierProduct,
  next: { name: string; pack: string },
  supplierProducts: SupplierProduct[],
  catalogueNamesElsewhere: Array<{ code: string; name: string }>,
): EditCheck {
  const name = next.name.trim();
  if (normalizeName(name) === "") return { kind: "blank" };
  const pack = next.pack.trim();

  if (
    normalizeName(name) === normalizeName(row.name) &&
    normalizePack(pack) === normalizePack(row.pack)
  ) {
    return { kind: "cosmetic" };
  }

  const rowClash = supplierProducts.find(
    (x) =>
      x.sourcingId !== row.sourcingId &&
      normalizeName(x.name) === normalizeName(name) &&
      normalizePack(x.pack) === normalizePack(pack),
  );
  if (rowClash) return { kind: "clash", name: rowClash.name, pack: rowClash.pack };

  if (normalizeName(name) !== normalizeName(row.name)) {
    const nameClash = catalogueNamesElsewhere.find(
      (x) => x.code !== row.code && normalizeName(x.name) === normalizeName(name),
    );
    if (nameClash) return { kind: "clash", name: nameClash.name, pack: "" };
  }
  return { kind: "ok" };
}

export interface SupplierView {
  supplier: SupplierBlock;
  /** The rows to show: all of them, or the matches while searching. */
  products: SupplierProduct[];
  expanded: boolean;
  /** "3 of 12 match" while filtering, "12 products" otherwise. */
  countLabel: string;
}

/**
 * What the Suppliers tab shows. Searching looks across every supplier at once
 * (product name, pack and supplier name, all terms, any order), hides
 * suppliers with no match and opens the ones that match.
 *
 * When the terms all land on the supplier's own name, the supplier itself is
 * the hit: it keeps every product and stays in the list even with none yet,
 * which is the only way to reach a supplier we hold no products for.
 */
export function viewSuppliers(
  suppliers: SupplierBlock[],
  query: string,
  opened: Record<string, boolean>,
): {
  searching: boolean;
  rows: SupplierView[];
  hits: number;
  total: string;
} {
  const searching = queryWords(query).length > 0;
  const rows: SupplierView[] = [];
  let hits = 0;
  for (const supplier of suppliers) {
    const all = supplier.products;
    const supplierHit = searching && matchesQuery(query, [supplier.name]);
    const filtering = searching && !supplierHit;
    const products = filtering
      ? all.filter((p) => matchesQuery(query, [supplier.name, p.name, p.pack]))
      : all;
    if (filtering && products.length === 0) continue;
    hits += products.length;
    rows.push({
      supplier,
      products,
      expanded: searching || !!opened[`sup:${supplier.id}`],
      countLabel: filtering
        ? `${products.length} of ${all.length} match`
        : `${all.length} product${all.length === 1 ? "" : "s"}`,
    });
  }
  const total = `${hits} product${hits === 1 ? "" : "s"} in ${rows.length} supplier${rows.length === 1 ? "" : "s"}`;
  return { searching, rows, hits, total };
}

/** Add forms show only to editors, and never while a search is active. */
export function showAddForms(canEdit: boolean, searching: boolean): boolean {
  return canEdit && !searching;
}
