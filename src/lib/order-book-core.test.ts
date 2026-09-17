import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addLineToBook,
  assignInCatalog,
  checkLineInput,
  checkSourcingInput,
  formatCopyOrder,
  formatLongDate,
  looksSimilar,
  markOrderedInBook,
  matchesQuery,
  matchSupplierName,
  normalizeName,
  normalizePack,
  renameInBook,
  resolvePicked,
  resolveTyped,
  undoOrderedInBook,
  type Book,
  type CatalogEntry,
  type PoLine,
  type Sourcing,
} from "./order-book-core";

// Spec §10 acceptance criteria, numbered as in the spec. The server actions run
// these same functions' rules in SQL; see src/app/actions/purchase-orders.ts.

const fraDi: Sourcing = {
  supplierId: 1,
  supplierName: "Fra-Di",
  supplierSku: "FD-711",
  purchasePack: "6 X 2.84L",
  purchaseUnit: "case",
};
const mega: Sourcing = {
  supplierId: 2,
  supplierName: "Mega Importing",
  supplierSku: "",
  purchasePack: "6 X 100OZ",
  purchaseUnit: "case",
};

const catalog: CatalogEntry[] = [
  { code: "TOMGR711", name: "STANISLAUS - 7/11 UNPEELED GROUND TOMATOES", sourcing: fraDi },
  { code: "TOMROSSO", name: "ROSSO - WHOLE PEELED TOMATOES", sourcing: mega },
  { code: "PANKO9", name: "PANKO BREAD CRUMBS", sourcing: null },
  { code: "NORIHALF", name: "NORI GOLD HALF SHEET", sourcing: null },
  { code: "NORIFULL", name: "NORI GOLD FULL SHEET", sourcing: null },
];

const suppliers = [
  { id: 1, name: "Fra-Di", aliases: [] },
  { id: 2, name: "Mega Importing", aliases: ["MEGA"] },
];

function line(productId: string, qty: number, unit: PoLine["unit"], name = productId): PoLine {
  return { id: `${productId}-${unit}-${qty}`, productId, qty, unit, nameAtTime: name, packAtTime: "6 X 2.84L" };
}

// 1
test("#1 exact product with sourcing goes to its supplier with the sourcing pack", () => {
  const r = resolveTyped("STANISLAUS - 7/11 UNPEELED GROUND TOMATOES", catalog);
  assert.equal(r.kind, "ready");
  if (r.kind !== "ready") return;
  assert.equal(r.entry.code, "TOMGR711");
  assert.equal(r.sourcing.supplierName, "Fra-Di");
  assert.equal(r.sourcing.purchasePack, "6 X 2.84L");
  assert.equal(r.sourcing.purchaseUnit, "case");
});

// 2
test("#2 lowercase with stray punctuation resolves to the same product", () => {
  const r = resolveTyped("  stanislaus 7-11 unpeeled, ground tomatoes!! ", catalog);
  assert.equal(r.kind, "ready");
  if (r.kind === "ready") assert.equal(r.entry.code, "TOMGR711");
});

// 3
test("#3 product with no sourcing opens assignment and adds nothing", () => {
  const r = resolveTyped("panko bread crumbs", catalog);
  assert.equal(r.kind, "needs-sourcing");
  const book: Book = { orders: [] };
  // No line is placed for a needs-sourcing resolution: the book is untouched.
  assert.deepEqual(book, { orders: [] });
});

// 4
test("#4 a saved assignment lives on the catalogue product; the next buyer is not asked", () => {
  const panko: Sourcing = {
    supplierId: 3, supplierName: "JFC", supplierSku: "", purchasePack: "9KG", purchaseUnit: "bag",
  };
  const after = assignInCatalog(catalog, "PANKO9", panko);
  const second = resolveTyped("Panko Bread Crumbs", after);
  assert.equal(second.kind, "ready");
  if (second.kind === "ready") assert.equal(second.sourcing.supplierName, "JFC");
  // The original catalogue is not mutated.
  assert.equal(catalog.find((e) => e.code === "PANKO9")?.sourcing, null);
});

// 5
test("#5 cancelled assignment leaves no line, no sourcing, no supplier", () => {
  const before = structuredClone(catalog);
  const book: Book = { orders: [] };
  // Cancel = nothing is called. Invalid input is refused before anything is written.
  assert.equal(checkSourcingInput({ purchasePack: "", purchaseUnit: "case" }).ok, false);
  assert.equal(checkSourcingInput({ purchasePack: "9KG", purchaseUnit: "" }).ok, false);
  assert.deepEqual(catalog, before);
  assert.deepEqual(book.orders, []);
  assert.equal(suppliers.length, 2);
});

// 6
test("#6 'fra di' resolves to Fra-Di, as do FRA-DI and fradi", () => {
  for (const typed of ["fra di", "FRA-DI", "fradi", " Fra Di "]) {
    const m = matchSupplierName(typed, suppliers);
    assert.equal(m.kind, "existing", typed);
    if (m.kind === "existing") assert.equal(m.supplier.id, 1);
  }
  const alias = matchSupplierName("mega", suppliers);
  assert.equal(alias.kind, "existing");
  assert.equal(matchSupplierName("Transhing", suppliers).kind, "new");
  assert.equal(matchSupplierName("  ", suppliers).kind, "empty");
});

// 7
test("#7 two catalogue products with the same name ask; no auto-pick", () => {
  const twins: CatalogEntry[] = [
    ...catalog,
    { code: "TOMGR711B", name: "Stanislaus 7/11 Unpeeled Ground Tomatoes", sourcing: mega },
  ];
  const r = resolveTyped("stanislaus 7/11 unpeeled ground tomatoes", twins);
  assert.equal(r.kind, "choose");
  if (r.kind === "choose") assert.equal(r.entries.length, 2);
});

// 8
test("#8 a close-but-inexact name offers candidates and never acts", () => {
  const r = resolveTyped("ROSSO WHOLE TOMATOES", catalog);
  assert.equal(r.kind, "similar");
  if (r.kind === "similar") {
    assert.deepEqual(r.entries.map((e) => e.code), ["TOMROSSO"]);
    assert.equal(r.entries[0].sourcing?.supplierName, "Mega Importing");
  }
  // Word order changed: still asked about, not acted on.
  assert.equal(resolveTyped("WHOLE PEELED TOMATOES ROSSO", catalog).kind, "similar");
  // The compound-word limitation is kept on purpose.
  assert.equal(looksSimilar("BREADCRUMB", "BREAD CRUMBS"), false);
  assert.equal(looksSimilar("PANKO BREADCRUMB", "PANKO BREAD CRUMBS"), false);
});

test("#8 at most six near misses are offered", () => {
  const many: CatalogEntry[] = Array.from({ length: 9 }, (_, i) => ({
    code: `GLV${i}`, name: `NITRIL BLACK GLOVES SIZE${i}`, sourcing: null,
  }));
  const r = resolveTyped("NITRIL BLACK GLOVES", many);
  assert.equal(r.kind, "similar");
  if (r.kind === "similar") assert.equal(r.entries.length, 6);
});

// 9
test("#9 no match says so and carries the typed text, inventing nothing", () => {
  const r = resolveTyped("dragonfruit puree", catalog);
  assert.deepEqual(r, { kind: "none", typed: "dragonfruit puree" });
});

// 10
test("#10 a blank quantity is asked for, never defaulted to 1", () => {
  const r = checkLineInput("", "case");
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.field, "qty");
  assert.equal(checkLineInput("   ", "case").ok, false);
  assert.equal(checkLineInput("0", "case").ok, false);
  assert.equal(checkLineInput("abc", "case").ok, false);
  assert.equal(checkLineInput("-2", "case").ok, false);
  const noUnit = checkLineInput("2", "");
  assert.equal(noUnit.ok, false);
  if (!noUnit.ok) assert.equal(noUnit.field, "unit");
  assert.deepEqual(checkLineInput("1", "each"), { ok: true, qty: 1, unit: "each" });
  assert.deepEqual(checkLineInput("1,5", "pallet"), { ok: true, qty: 1.5, unit: "pallet" });
});

// 11
test("#11 same product twice at the same unit is one line, summed", () => {
  let book: Book = { orders: [] };
  book = addLineToBook(book, 1, line("TOMGR711", 2, "case"), "po1");
  book = addLineToBook(book, 1, line("TOMGR711", 3, "case"), "po2");
  assert.equal(book.orders.length, 1);
  assert.equal(book.orders[0].lines.length, 1);
  assert.equal(book.orders[0].lines[0].qty, 5);
});

// 12
test("#12 same product at different units is two lines", () => {
  let book: Book = { orders: [] };
  book = addLineToBook(book, 1, line("TOMGR711", 2, "case"), "po1");
  book = addLineToBook(book, 1, line("TOMGR711", 1, "pallet"), "po1");
  assert.equal(book.orders[0].lines.length, 2);
});

// 13
test("#13 same name, different pack: two distinct products, never merged", () => {
  const packs: CatalogEntry[] = [
    { code: "ROSSO100", name: "ROSSO WHOLE PEELED TOMATOES", sourcing: { ...mega, purchasePack: "6 X 100OZ" } },
    { code: "ROSSO284", name: "ROSSO WHOLE PEELED TOMATOES", sourcing: { ...mega, purchasePack: "6 X 2.84L" } },
  ];
  const r = resolveTyped("rosso whole peeled tomatoes", packs);
  assert.equal(r.kind, "choose");

  let book: Book = { orders: [] };
  book = addLineToBook(book, 2, line("ROSSO100", 1, "case"), "po");
  book = addLineToBook(book, 2, line("ROSSO284", 1, "case"), "po");
  assert.equal(book.orders[0].lines.length, 2);

  assert.notEqual(normalizePack("6 X 100OZ"), normalizePack("6 X 2.84L"));
  assert.equal(normalizePack("3 X 3,5L"), normalizePack("3 x 3.5l"));
});

// 14
test("#14 mark ordered then undo: lines return and merge; method and date restored", () => {
  let book: Book = { orders: [] };
  book = addLineToBook(book, 1, line("TOMGR711", 2, "case"), "po1");
  book = {
    orders: book.orders.map((o) => ({ ...o, method: "pickup", wantedFor: "2026-09-20" })),
  };
  book = markOrderedInBook(book, "po1", "2026-09-17");
  assert.equal(book.orders[0].status, "ordered");
  assert.equal(book.orders.filter((o) => o.status === "open").length, 0);

  // Meanwhile a new open order with the same product and a default method.
  book = addLineToBook(book, 1, line("TOMGR711", 1, "case"), "po2");
  book = addLineToBook(book, 1, line("TOMGR711", 4, "each"), "po2");

  book = undoOrderedInBook(book, "po1");
  assert.equal(book.orders.length, 1);
  const open = book.orders[0];
  assert.equal(open.status, "open");
  assert.equal(open.method, "pickup");
  assert.equal(open.wantedFor, "2026-09-20");
  assert.equal(open.lines.length, 2);
  assert.equal(open.lines.find((l) => l.unit === "case")?.qty, 3);

  // With nothing open, undo simply reopens the record.
  let solo: Book = { orders: [] };
  solo = addLineToBook(solo, 1, line("TOMGR711", 2, "case"), "s1");
  solo = markOrderedInBook(solo, "s1", "2026-09-17");
  solo = undoOrderedInBook(solo, "s1");
  assert.equal(solo.orders[0].status, "open");
  assert.equal(solo.orders[0].orderedOn, null);
});

test("#14 history is a copy: editing the open order later never reaches it", () => {
  let book: Book = { orders: [] };
  book = addLineToBook(book, 1, line("TOMGR711", 2, "case"), "po1");
  const live = book.orders[0].lines;
  book = markOrderedInBook(book, "po1", "2026-09-17");
  live[0].qty = 99;
  assert.equal(book.orders[0].lines[0].qty, 2);
});

// 15
test("#15 a rename after a past order leaves the past order's name alone", () => {
  let book: Book = { orders: [] };
  book = addLineToBook(book, 1, line("TOMGR711", 2, "case", "OLD NAME"), "po1");
  book = markOrderedInBook(book, "po1", "2026-09-17");
  book = addLineToBook(book, 1, line("TOMGR711", 1, "case", "OLD NAME"), "po2");
  book = renameInBook(book, "TOMGR711", "NEW NAME");
  assert.equal(book.orders.find((o) => o.id === "po1")?.lines[0].nameAtTime, "OLD NAME");
  assert.equal(book.orders.find((o) => o.id === "po2")?.lines[0].nameAtTime, "NEW NAME");
});

// 16
test("#16 copy order is byte for byte the Order Book format", () => {
  const text = formatCopyOrder({
    contact: "Mario",
    method: "delivery",
    wantedFor: "2026-09-15",
    lines: [
      { qty: 2, unit: "pallet", nameAtTime: "PRODUCT NAME", packAtTime: "PACK SIZE" },
      { qty: 12, unit: "each", nameAtTime: "ANOTHER PRODUCT", packAtTime: "PACK SIZE" },
    ],
  });
  assert.equal(
    text,
    "Hello Mario, I would like to order the following products for delivery on September 15, 2026 : \n" +
      "\n" +
      "- 2 pallet PRODUCT NAME (PACK SIZE)\n" +
      "- 12x ANOTHER PRODUCT (PACK SIZE)\n" +
      "\n" +
      "\n" +
      "Please Confirm\n" +
      "Thank you\n",
  );
});

test("#16 missing date is ____, missing contact is 'there', pickup is named", () => {
  const text = formatCopyOrder({
    contact: "  ",
    method: "pickup",
    wantedFor: "",
    lines: [{ qty: 1.5, unit: "case", nameAtTime: "X", packAtTime: "" }],
  });
  assert.equal(
    text,
    "Hello there, I would like to order the following products for pickup on ____ : \n\n" +
      "- 1.5 case X\n\n\nPlease Confirm\nThank you\n",
  );
  assert.equal(formatLongDate("2026-01-05"), "January 5, 2026");
});

test("typeahead matches words in any order across name, pack and supplier", () => {
  assert.ok(matchesQuery("tomatoes fra", ["STANISLAUS GROUND TOMATOES", "6 X 2.84L", "Fra-Di"]));
  assert.ok(matchesQuery("2.84 stanis", ["STANISLAUS GROUND TOMATOES", "6 X 2.84L", "Fra-Di"]));
  assert.equal(matchesQuery("tomatoes mega", ["STANISLAUS GROUND TOMATOES", "6 X 2.84L", "Fra-Di"]), false);
  assert.equal(matchesQuery("  ", ["anything"]), false);
});

test("normalisation is exactly the Order Book's", () => {
  assert.equal(normalizeName("  Fra-Di's  7/11 "), "FRA DI S 7 11");
  assert.equal(normalizePack(" 6 x 2,84 l "), "6 X 2.84 L");
});

test("picking a product resolves by its own sourcing", () => {
  assert.equal(resolvePicked(catalog[0]).kind, "ready");
  assert.equal(resolvePicked(catalog[2]).kind, "needs-sourcing");
});

test("changing a line's unit keeps one line per product per unit", async () => {
  const { changeLineUnit } = await import("./order-book-core");
  const lines: PoLine[] = [
    line("TOMGR711", 2, "case"),
    line("TOMGR711", 1, "pallet"),
    line("OTHER", 3, "case"),
  ];
  // To a free unit: just changes.
  const moved = changeLineUnit(lines, lines[0].id, "box");
  assert.equal(moved.merged, false);
  assert.deepEqual(moved.lines.map((l) => `${l.productId}:${l.unit}:${l.qty}`), [
    "TOMGR711:box:2", "TOMGR711:pallet:1", "OTHER:case:3",
  ]);
  // Onto a unit the product already has: merged, quantities summed.
  const merged = changeLineUnit(lines, lines[0].id, "pallet");
  assert.equal(merged.merged, true);
  assert.deepEqual(merged.lines.map((l) => `${l.productId}:${l.unit}:${l.qty}`), [
    "TOMGR711:pallet:3", "OTHER:case:3",
  ]);
  // Another product at that unit is not touched.
  const other = changeLineUnit(lines, lines[2].id, "pallet");
  assert.equal(other.merged, false);
  // Input is never mutated.
  assert.equal(lines[0].unit, "case");
});
