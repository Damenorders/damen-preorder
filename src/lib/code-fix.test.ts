import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildLookup,
  checkLine,
  findByDescription,
  findBySku,
  parsePrice,
  searchCatalog,
} from "./code-fix";

const lookup = buildLookup([
  { sku: "FF", description: "MCCAIN 3/8 FRIES - 6 X 5 LB" },
  { sku: "BARBFF", description: "BARBIES FRIES - 6 X 5 LB" },
  { sku: "BARBSW", description: "SWEET PLATTER FRIES" },
  { sku: "SERSWEET", description: "SWEET PLATTER FRIES" },
]);

const line = (over: Partial<Parameters<typeof checkLine>[1]> = {}) => ({
  clientSku: "barbff",
  clientDescription: "",
  price: "30$",
  generalSku: "ff ",
  generalDescription: "",
  ...over,
});

test("SKU lookup ignores case and spacing", () => {
  assert.equal(findBySku(lookup, " barbff ")?.sku, "BARBFF");
  assert.equal(findBySku(lookup, "NOPE"), null);
});

test("a description shared by two SKUs returns both, so nothing is guessed", () => {
  assert.deepEqual(
    findByDescription(lookup, "sweet  platter fries").map((i) => i.sku),
    ["BARBSW", "SERSWEET"],
  );
  assert.equal(findByDescription(lookup, "MCCAIN 3/8 FRIES - 6 X 5 LB").length, 1);
});

test("search matches every word in any order, SKU hits first", () => {
  assert.deepEqual(searchCatalog(lookup, "ff").map((i) => i.sku)[0], "FF");
  assert.deepEqual(searchCatalog(lookup, "fries barbies").map((i) => i.sku), ["BARBFF"]);
  assert.deepEqual(searchCatalog(lookup, "   "), []);
});

test("prices accept $ and a comma, refuse anything else", () => {
  assert.equal(parsePrice("30"), 30);
  assert.equal(parsePrice("$30.5"), 30.5);
  assert.equal(parsePrice("30,50 $"), 30.5);
  assert.equal(parsePrice("-3"), null);
  assert.equal(parsePrice("abc"), null);
  assert.equal(parsePrice("1.234"), null);
});

test("a template SKU takes the template's spelling and description", () => {
  const r = checkLine(lookup, line({ clientDescription: "something else" }), 1);
  assert.deepEqual(r, {
    ok: true,
    line: {
      id: undefined,
      clientSku: "BARBFF",
      clientDescription: "BARBIES FRIES - 6 X 5 LB",
      price: "30.00",
      generalSku: "FF",
      generalDescription: "MCCAIN 3/8 FRIES - 6 X 5 LB",
    },
  });
});

test("a SKU not in the template needs a typed description", () => {
  const missing = checkLine(lookup, line({ clientSku: "BARBNEW" }), 2);
  assert.equal(missing.ok, false);
  assert.match(!missing.ok ? missing.error : "", /Product 2: BARBNEW is not in the template/);

  const typed = checkLine(lookup, line({ clientSku: "BARBNEW", clientDescription: " New  fries " }), 2);
  assert.ok(typed.ok);
  assert.equal(typed.ok && typed.line.clientDescription, "New fries");
});

test("client SKU is optional; general SKU and price are not", () => {
  const noClient = checkLine(lookup, line({ clientSku: "" }), 1);
  assert.ok(noClient.ok);
  assert.equal(noClient.ok && noClient.line.clientSku, null);

  assert.equal(checkLine(lookup, line({ generalSku: "" }), 1).ok, false);
  assert.equal(checkLine(lookup, line({ price: "" }), 1).ok, false);
  assert.equal(checkLine(lookup, line({ price: "thirty" }), 1).ok, false);
  // A client description with no client SKU is refused, not silently dropped.
  assert.equal(checkLine(lookup, line({ clientSku: "", clientDescription: "x" }), 1).ok, false);
});
