import { test } from "node:test";
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import { buildXlsx } from "./xlsx";

// The workbook is assembled byte by byte, so the test reads it back the way
// Excel does: walk the zip central directory, inflate each part, check the XML.

function readZip(buf: Buffer): Map<string, string> {
  const out = new Map<string, string>();
  // End of central directory: fixed 22 bytes here (we never write a comment).
  const eocd = buf.length - 22;
  assert.equal(buf.readUInt32LE(eocd), 0x06054b50, "missing end-of-central-dir");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);

  for (let i = 0; i < count; i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50, "bad central header");
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);

    assert.equal(buf.readUInt32LE(localOffset), 0x04034b50, "bad local header");
    const compressedSize = buf.readUInt32LE(localOffset + 18);
    const localNameLen = buf.readUInt16LE(localOffset + 26);
    const localExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const data = buf.subarray(dataStart, dataStart + compressedSize);
    out.set(name, inflateRawSync(data).toString("utf8"));

    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

const workbook = buildXlsx({
  name: "Product List",
  title: 'Ben & Jerry "Fall" list',
  subtitles: ["2 items", "Created by Tester"],
  headers: ["#", "SKU", "Description"],
  rows: [
    [1, "AB-100", 'Olives & "brine" <12x1L>'],
    [2, "AB-101", "Tomatoes"],
  ],
  columnWidths: [6, 18, 70],
});

test("writes every part Excel requires", () => {
  const parts = readZip(workbook);
  for (const name of [
    "[Content_Types].xml",
    "_rels/.rels",
    "xl/workbook.xml",
    "xl/_rels/workbook.xml.rels",
    "xl/styles.xml",
    "xl/worksheets/sheet1.xml",
  ]) {
    assert.ok(parts.has(name), `missing part: ${name}`);
  }
});

test("escapes text and keeps numbers numeric", () => {
  const sheet = readZip(workbook).get("xl/worksheets/sheet1.xml")!;
  assert.ok(sheet.includes("Ben &amp; Jerry &quot;Fall&quot; list"));
  assert.ok(sheet.includes("Olives &amp; &quot;brine&quot; &lt;12x1L&gt;"));
  // Row 1 is the title, 2-3 the subtitles, 4 blank, 5 the header, 6 first item.
  assert.ok(sheet.includes('<c r="A6" s="5"><v>1</v></c>'), "numeric # cell");
  assert.ok(sheet.includes('t="inlineStr"><is><t xml:space="preserve">AB-100'));
});

test("repeats the header row on every printed page", () => {
  const book = readZip(workbook).get("xl/workbook.xml")!;
  assert.ok(book.includes("_xlnm.Print_Titles"));
  assert.ok(book.includes("'Product List'!$5:$5"), "header row is row 5");
});

test("strips control characters that would corrupt the XML", () => {
  const raw = `bad\u0001char`;
  const sheet = readZip(
    buildXlsx({
      name: "T",
      headers: ["A"],
      rows: [[raw]],
    }),
  ).get("xl/worksheets/sheet1.xml")!;
  assert.ok(sheet.includes("badchar"));
  assert.ok(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(sheet));
});

test("formats money columns and a bold total row", () => {
  const parts = readZip(
    buildXlsx({
      name: "Priced",
      headers: ["#", "SKU", "Description", "Price"],
      rows: [
        [1, "A1", "Olives", 12.5],
        [2, "A2", "Salt", 0.75],
      ],
      moneyColumns: [3],
      totalRow: ["", "", "Total", 13.25],
    }),
  );
  const sheet = parts.get("xl/worksheets/sheet1.xml")!;
  // Style 6 is the currency cell, 8 the bold currency total.
  assert.ok(sheet.includes('<c r="D2" s="6"><v>12.5</v></c>'), "price cell");
  assert.ok(sheet.includes('<c r="D4" s="8"><v>13.25</v></c>'), "total cell");
  assert.ok(sheet.includes('<c r="C4" s="7"'), "total label cell");

  const styles = parts.get("xl/styles.xml")!;
  assert.ok(styles.includes('numFmtId="164"'), "currency format declared");
  assert.ok(styles.includes("#,##0.00"));
});
