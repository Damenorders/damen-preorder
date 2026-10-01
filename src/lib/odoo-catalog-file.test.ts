import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanGrid,
  diffOdooCatalog,
  guessColumns,
  parseOdooCatalog,
  readSpreadsheet,
} from "./odoo-catalog-file";
import { buildXlsx } from "./xlsx";

test("guesses Odoo's own export headers", () => {
  assert.deepEqual(guessColumns(["ID", "Internal Reference", "Name", "Sales Price"]), { skuCol: 1, descCol: 2 });
  assert.deepEqual(guessColumns(["SKU", "Description"]), { skuCol: 0, descCol: 1 });
  assert.deepEqual(guessColumns(["foo", "bar"]), { skuCol: -1, descCol: -1 });
});

test("blank rows are dropped and cells trimmed", () => {
  assert.deepEqual(cleanGrid([[" a ", "b"], ["", "  "], [], ["c"]]), [["a", "b"], ["c"]]);
});

test("reads SKU + description pairs and reports rows missing either", () => {
  const r = parseOdooCatalog(
    [
      ["A100", "Rice paper 22cm"],
      ["", "No code here"],
      ["B200", ""],
      ["C300", "Olive  oil"],
    ],
    0,
    1,
  );
  assert.deepEqual(r.products, [
    { sku: "A100", description: "Rice paper 22cm" },
    { sku: "C300", description: "Olive oil" },
  ]);
  assert.deepEqual(r.skipped.map((s) => s.reason), ["No SKU", "No description"]);
});

test("a SKU with two different descriptions is a conflict, not imported", () => {
  const r = parseOdooCatalog([["A100", "Rice paper 22cm"], ["a100", "Rice paper 16cm"], ["B200", "Oil"]], 0, 1);
  assert.equal(r.conflicts.length, 1);
  assert.equal(r.conflicts[0].sku, "A100");
  assert.deepEqual(r.products.map((p) => p.sku), ["B200"]);
});

test("an exact repeat is kept once and reported", () => {
  const r = parseOdooCatalog([["A100", "Rice paper"], ["A100", "RICE PAPER"]], 0, 1);
  assert.equal(r.products.length, 1);
  assert.equal(r.repeated[0].times, 2);
  assert.equal(r.conflicts.length, 0);
});

test("two SKUs with one description are allowed and reported", () => {
  const r = parseOdooCatalog([["A100", "Rice paper"], ["A101", "Rice Paper"]], 0, 1);
  assert.equal(r.products.length, 2);
  assert.deepEqual(r.sharedDescriptions[0].skus, ["A100", "A101"]);
});

test("diff: added, renamed, retired, restored", () => {
  const existing = [
    { sku: "A100", description: "Rice paper", active: true },
    { sku: "B200", description: "Oil", active: true },
    { sku: "C300", description: "Salt", active: false },
    { sku: "D400", description: "Sugar", active: true },
  ];
  const d = diffOdooCatalog(existing, [
    { sku: "a100", description: "Rice paper" },
    { sku: "B200", description: "Olive oil" },
    { sku: "C300", description: "Salt" },
    { sku: "E500", description: "Flour" },
  ]);
  assert.deepEqual(d.added, [{ sku: "E500", description: "Flour" }]);
  assert.deepEqual(d.renamed, [{ sku: "B200", from: "Oil", to: "Olive oil" }]);
  assert.deepEqual(d.retired, [{ sku: "D400", description: "Sugar" }]);
  assert.deepEqual(d.restored, [{ sku: "C300", description: "Salt" }]);
  assert.equal(d.unchanged, 1);
});

test("an empty cell in a real .xlsx never swallows the cell after it", () => {
  const workbook = buildXlsx({
    name: "Product",
    headers: ["ID", "Internal Reference", "Name"],
    rows: [
      ["1", "TST-001", "Rice paper"],
      ["2", "", "No code here"],
      ["3", "TST-003", ""],
      ["4", "TST-004", "Olive oil"],
    ],
  });
  const read = readSpreadsheet(workbook, "odoo.xlsx");
  assert.ok(read.ok);
  const grid = cleanGrid((read as { ok: true; grid: string[][] }).grid);
  assert.deepEqual(grid[2], ["2", "", "No code here"]);
  const r = parseOdooCatalog(grid.slice(1), 1, 2);
  assert.deepEqual(r.products.map((p) => p.sku), ["TST-001", "TST-004"]);
  assert.deepEqual(r.skipped, [
    { sku: "", description: "No code here", reason: "No SKU" },
    { sku: "TST-003", description: "", reason: "No description" },
  ]);
});
