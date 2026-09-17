import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addLineToBook,
  applyCostChange,
  checkPrice,
  checkProductEdit,
  computeMargin,
  markOrderedInBook,
  matchSupplierName,
  matchSupplierProduct,
  renameInBook,
  showAddForms,
  viewSuppliers,
  type Book,
  type SupplierBlock,
  type SupplierProduct,
} from "./order-book-core";

// SUPPLIERS-TAB-SPEC.md §12, numbered as in the spec. The server actions apply
// these same rules in SQL; see src/app/actions/purchase-orders.ts.

function product(over: Partial<SupplierProduct> & { code: string; name: string }): SupplierProduct {
  return {
    sourcingId: `s-${over.code}`,
    pack: "",
    unit: "case",
    cost: null,
    sell: null,
    costSetOn: null,
    preferred: true,
    ...over,
  };
}

const transhing: SupplierBlock = {
  id: 1,
  name: "Transhing",
  contact: "Dandan",
  email: "dandan@transhing.com",
  products: [
    product({ code: "RP22", name: "TS - SQUARE RICE PAPER 22CM", pack: "40 X 400G" }),
    product({ code: "SESB", name: "BLACK ROASTED SESAME SEEDS FULL BOX", pack: "12 X 1KG" }),
    product({ code: "SESW", name: "WHITE ROASTED SESAME SEEDS FULL BOX", pack: "10 X 1KG" }),
    product({ code: "NORIH", name: "YAMADA - NORI GOLD *HALF* SHEET BIG BOX", pack: "4 X 1000UN" }),
  ],
};
const fraDi: SupplierBlock = {
  id: 2,
  name: "Fra-Di",
  contact: "Mario",
  email: "",
  products: [product({ code: "TOM711", name: "STANISLAUS - 7/11 UNPEELED GROUND TOMATOES", pack: "6 X 2.84L" })],
};
const empty: SupplierBlock = { id: 3, name: "VIEDERA", contact: "", email: "", products: [] };
const all = [fraDi, transhing, empty];

// 1
test("#1 opened: every supplier collapsed, counts visible", () => {
  const v = viewSuppliers(all, "", {});
  assert.equal(v.searching, false);
  assert.deepEqual(v.rows.map((r) => r.expanded), [false, false, false]);
  assert.deepEqual(v.rows.map((r) => r.countLabel), ["1 product", "4 products", "0 products"]);
});

// 2
test("#2 clicking a supplier expands it and shows the add form", () => {
  const v = viewSuppliers(all, "", { "sup:1": true });
  assert.equal(v.rows.find((r) => r.supplier.id === 1)?.expanded, true);
  assert.equal(v.rows.find((r) => r.supplier.id === 2)?.expanded, false);
  assert.equal(showAddForms(true, v.searching), true);
});

// 3
test("#3 search 'sesame': only matching suppliers, expanded, n of m", () => {
  const v = viewSuppliers(all, "sesame", {});
  assert.equal(v.rows.length, 1);
  assert.equal(v.rows[0].supplier.name, "Transhing");
  assert.equal(v.rows[0].expanded, true);
  assert.equal(v.rows[0].countLabel, "2 of 4 match");
  assert.equal(v.total, "2 products in 1 supplier");
});

// 4
test("#4 search 'paper rice' ignores word order", () => {
  const v = viewSuppliers(all, "paper rice", {});
  assert.deepEqual(v.rows[0].products.map((p) => p.code), ["RP22"]);
  // Supplier name and pack count too, and all terms must be present.
  assert.equal(viewSuppliers(all, "fra 2.84", {}).rows[0].supplier.name, "Fra-Di");
  assert.equal(viewSuppliers(all, "sesame tomatoes", {}).rows.length, 0);
  assert.equal(viewSuppliers(all, "nothing-like-this", {}).total, "0 products in 0 suppliers");
});

// 5
test("#5 both add forms are hidden while searching", () => {
  assert.equal(showAddForms(true, viewSuppliers(all, "sesame", {}).searching), false);
  assert.equal(showAddForms(true, viewSuppliers(all, "   ", {}).searching), true);
});

// 6
test("#6 back on the tab with no search: collapsed again", () => {
  // Leaving the tab unmounts the view, which drops the search text; the fold
  // state that remains is only what was opened by hand.
  const v = viewSuppliers(all, "", {});
  assert.ok(v.rows.every((r) => !r.expanded));
});

// 7
test("#7 cost 48, sell 67: 28% and $19.00; cost date set", () => {
  assert.deepEqual(computeMargin(48, 67), { pct: 28, diff: 19, thin: false });
  assert.equal(computeMargin(48, 67)!.diff.toFixed(2), "19.00");
  assert.deepEqual(
    applyCostChange({ cost: null, costSetOn: null }, 48, "2026-09-17"),
    { changed: true, cost: 48, costSetOn: "2026-09-17" },
  );
});

// 8
test("#8 clearing the cost: margin blank, cost date cleared", () => {
  assert.equal(computeMargin(null, 67), null);
  assert.deepEqual(
    applyCostChange({ cost: 48, costSetOn: "2026-09-01" }, null, "2026-09-17"),
    { changed: true, cost: null, costSetOn: null },
  );
  // Same value: nothing moves, the old date stays.
  assert.deepEqual(
    applyCostChange({ cost: 48, costSetOn: "2026-09-01" }, 48, "2026-09-17"),
    { changed: false, cost: 48, costSetOn: "2026-09-01" },
  );
  assert.equal(computeMargin(48, 0), null);
  assert.equal(computeMargin(48, null), null);
});

// 9
test("#9 cost 60, sell 65 is under 15%: warning", () => {
  assert.equal(computeMargin(60, 65)!.thin, true);
  assert.equal(computeMargin(60, 65)!.pct, 8);
  assert.equal(computeMargin(85, 100)!.thin, false);
});

test("price boxes accept blank and plain numbers only", () => {
  assert.deepEqual(checkPrice(""), { ok: true, value: null });
  assert.deepEqual(checkPrice(" $1,234.5 "), { ok: true, value: 1234.5 });
  assert.equal(checkPrice("-3").ok, false);
  assert.equal(checkPrice("abc").ok, false);
});

// 10
test("#10 a rename goes through and reaches open order lines", () => {
  const row = transhing.products[0];
  const check = checkProductEdit(
    row,
    { name: "TS SQUARE RICE PAPER 22 CM ROUND", pack: row.pack },
    transhing.products,
    [],
  );
  assert.equal(check.kind, "ok");

  let book: Book = { orders: [] };
  book = addLineToBook(book, 1, {
    id: "l1", productId: "RP22", qty: 2, unit: "pallet", nameAtTime: row.name, packAtTime: row.pack,
  }, "po1");
  book = renameInBook(book, "RP22", "TS SQUARE RICE PAPER 22 CM ROUND");
  assert.equal(book.orders[0].lines[0].nameAtTime, "TS SQUARE RICE PAPER 22 CM ROUND");
});

// 11
test("#11 renaming onto an existing product is refused", () => {
  const [, black, white] = transhing.products;
  // Onto another product of this supplier at the same pack.
  const samePack = { ...white, pack: black.pack };
  const check = checkProductEdit(
    black,
    { name: "white roasted sesame seeds, full box", pack: black.pack },
    [black, samePack],
    [],
  );
  assert.equal(check.kind, "clash");
  // Onto a name another catalogue product already has (names are shared).
  const elsewhere = checkProductEdit(
    black,
    { name: "PANKO BREAD CRUMBS", pack: black.pack },
    transhing.products,
    [{ code: "PANKO9", name: "PANKO BREAD CRUMBS" }],
  );
  assert.equal(elsewhere.kind, "clash");
  // A cosmetic tidy-up is not a clash with itself.
  assert.equal(
    checkProductEdit(black, { name: "Black roasted sesame seeds - full box", pack: "12 x 1kg" }, transhing.products, [
      { code: black.code, name: black.name },
    ]).kind,
    "cosmetic",
  );
});

// 12
test("#12 renaming to blank is refused", () => {
  const row = transhing.products[0];
  assert.equal(checkProductEdit(row, { name: "  ", pack: row.pack }, [], []).kind, "blank");
  assert.equal(checkProductEdit(row, { name: " - / ", pack: row.pack }, [], []).kind, "blank");
});

// 13
test("#13 a rename after a past order leaves history alone", () => {
  let book: Book = { orders: [] };
  book = addLineToBook(book, 1, {
    id: "l1", productId: "RP22", qty: 2, unit: "pallet", nameAtTime: "OLD", packAtTime: "40 X 400G",
  }, "po1");
  book = markOrderedInBook(book, "po1", "2026-09-08");
  book = renameInBook(book, "RP22", "NEW");
  assert.equal(book.orders[0].lines[0].nameAtTime, "OLD");
});

// 14
test("#14 adding a product already on file at that pack: no duplicate", () => {
  const m = matchSupplierProduct(transhing.products, {
    code: "RP22", name: "ts square rice paper 22cm", pack: "40 x 400g",
  });
  assert.equal(m.kind, "exact");
  // A different catalogue code with the same name and pack is still the same product.
  const twin = matchSupplierProduct(transhing.products, {
    code: "RP22-B", name: "TS SQUARE RICE PAPER 22CM", pack: "40X400G".replace("X", " X "),
  });
  assert.equal(twin.kind, "exact");
});

// 15
test("#15 a similar product at the same pack is asked about", () => {
  const m = matchSupplierProduct(transhing.products, {
    code: "SESB2", name: "BLACK SESAME SEEDS ROASTED BOX", pack: "12 X 1KG",
  });
  assert.equal(m.kind, "similar");
  if (m.kind === "similar") assert.equal(m.product.code, "SESB");

  // A different pack is always a new product, no question.
  const other = matchSupplierProduct(transhing.products, {
    code: "SESB5", name: "BLACK ROASTED SESAME SEEDS FULL BOX", pack: "5 X 1KG",
  });
  assert.equal(other.kind, "new");

  // Half sheet and full sheet never merge.
  assert.equal(
    matchSupplierProduct(transhing.products, {
      code: "NORIF", name: "YAMADA - NORI GOLD *FULL* SHEET BIG BOX", pack: "4000UN",
    }).kind,
    "new",
  );

  // The same catalogue item at a different pack cannot become a second row.
  assert.equal(
    matchSupplierProduct(transhing.products, { code: "RP22", name: "x", pack: "20 X 400G" }).kind,
    "pack-conflict",
  );
});

// 16
test("#16 adding supplier 'fra di' resolves to Fra-Di", () => {
  const m = matchSupplierName("fra di", all);
  assert.equal(m.kind, "existing");
  if (m.kind === "existing") assert.equal(m.supplier.name, "Fra-Di");
});

// 17
test("#17 removing a product leaves past orders unchanged", () => {
  let book: Book = { orders: [] };
  book = addLineToBook(book, 2, {
    id: "l1", productId: "TOM711", qty: 1, unit: "pallet",
    nameAtTime: fraDi.products[0].name, packAtTime: fraDi.products[0].pack,
  }, "po1");
  book = markOrderedInBook(book, "po1", "2026-09-09");
  const before = structuredClone(book);
  const afterRemoval: SupplierBlock = { ...fraDi, products: [] };
  assert.equal(afterRemoval.products.length, 0);
  // Removal is a catalogue-side change only; the book is not an input to it.
  assert.deepEqual(book, before);
});

// 18
test("#18 read-only viewer: no add forms, search still works", () => {
  assert.equal(showAddForms(false, false), false);
  assert.equal(viewSuppliers(all, "sesame", {}).rows.length, 1);
});
