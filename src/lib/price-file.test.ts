import { test } from "node:test";
import assert from "node:assert/strict";
import { readPriceFile, parsePrice } from "./price-file";
import { parseCsv } from "./csv";
import { buildXlsx } from "./xlsx";
import { readXlsx } from "./xlsx-read";

test("reads the PriceList export shape, banner rows and all", () => {
  const csv = [
    "Damen Service Alimentaire (Division Ferro Poisson),,",
    "Price Lists,,",
    ",,",
    "APPREDHALF,( HALF / DEMI ) APPLES RED DELICIOUS = APPROX 50 UNITS,28.0000 ",
    "APPRGAL,APPLES ROYAL GALA POMME,78.6500 ",
    "",
  ].join("\r\n");

  const report = readPriceFile(parseCsv(csv));
  assert.equal(report.headerDetected, false);
  assert.equal(report.rows.length, 2);
  assert.deepEqual(report.rows[1], {
    code: "APPRGAL",
    description: "APPLES ROYAL GALA POMME",
    price: 78.65,
  });
});

test("uses a header row when the file has one, in any column order", () => {
  const csv = [
    "Price,Product,SKU",
    '"$1,234.50",Olive oil 12x1L,OIL-12',
    "9.99,Salt,SALT-1",
  ].join("\n");

  const report = readPriceFile(parseCsv(csv));
  assert.equal(report.headerDetected, true);
  assert.deepEqual(report.rows[0], {
    code: "OIL-12",
    description: "Olive oil 12x1L",
    price: 1234.5,
  });
  assert.equal(report.rows[1].price, 9.99);
});

test("reports rows it cannot read instead of dropping them", () => {
  const report = readPriceFile([
    ["SKU", "Product", "Price"],
    ["A1", "Good", "5.00"],
    ["A2", "No price", ""],
    ["A3", "Junk price", "call us"],
    ["A4", "Negative", "-3.00"],
  ]);
  assert.equal(report.rows.length, 1);
  assert.deepEqual(
    report.skipped.map((s) => s.reason),
    ["no price", "price not a number", "negative price"],
  );
});

test("last row wins when a SKU repeats", () => {
  const report = readPriceFile([
    ["SKU", "Product", "Price"],
    ["A1", "Old", "5.00"],
    ["A1", "New", "6.00"],
  ]);
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].price, 6);
});

test("parsePrice handles the formats Excel produces", () => {
  assert.equal(parsePrice("28.0000 "), 28);
  assert.equal(parsePrice("$1,234.50"), 1234.5);
  assert.equal(parsePrice("1.234,50"), 1234.5);
  assert.equal(parsePrice("0.7500"), 0.75);
  assert.equal(parsePrice(""), null);
  assert.equal(parsePrice("n/a"), null);
});

test("round-trips a real .xlsx through the writer and back", () => {
  const workbook = buildXlsx({
    name: "Prices",
    headers: ["SKU", "Product", "Price"],
    rows: [
      ["OIL-12", 'Olive oil "extra" & 12x1L', 12.5],
      ["SALT-1", "Salt", 0.75],
    ],
  });

  const report = readPriceFile(readXlsx(workbook));
  assert.equal(report.headerDetected, true);
  assert.equal(report.rows.length, 2);
  assert.deepEqual(report.rows[0], {
    code: "OIL-12",
    description: 'Olive oil "extra" & 12x1L',
    price: 12.5,
  });
  assert.equal(report.rows[1].price, 0.75);
});

test("recognises the Damen export's 'Regular CAD' price column", () => {
  const report = readPriceFile([
    ["Damen Service Alimentaire (Division Ferro Poisson)", "", ""],
    ["Price Lists", "", ""],
    ["", "", ""],
    ["Item No.", "Description", "Regular CAD"],
    ["#1TAKEOUT", "#1 TAKEOUT KRAFT BOX (200UN)", "26.9500 "],
  ]);
  assert.equal(report.headerDetected, true);
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].price, 26.95);
  assert.equal(report.skipped.length, 0, "banner rows are above the header");
});
