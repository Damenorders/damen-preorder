import { deflateRawSync } from "node:zlib";

// Minimal .xlsx (OOXML) writer — a real Excel workbook, not a CSV rename, so a
// Product List prints cleanly for a client: bold title, a header row that
// repeats on every printed page, sized columns and fit-to-width page setup.
// Hand-rolled rather than pulling in a spreadsheet library: one sheet of text
// is a small, well-specified slice of the format.

// --- ZIP container ---------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: string;
  data: Buffer;
}

/** Every part deflated, with a fixed timestamp so output is reproducible. */
function zip(entries: ZipEntry[]): Buffer {
  const DOS_TIME = 0; // 00:00:00
  const DOS_DATE = (2020 - 1980) * 512 + 1 * 32 + 1; // 2020-01-01
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const compressed = deflateRawSync(entry.data, { level: 9 });
    const crc = crc32(entry.data);

    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(8, 8); // method: deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // extra length
    name.copy(local, 30);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);

    locals.push(local, compressed);
    centrals.push(central);
    offset += local.length + compressed.length;
  }

  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, ...centrals, end]);
}

// --- Spreadsheet parts -----------------------------------------------------

// Control characters are illegal in XML and would corrupt the workbook.
const ILLEGAL_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

function esc(value: string): string {
  return value
    .replace(ILLEGAL_XML, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 0 -> "A", 25 -> "Z", 26 -> "AA". */
function columnName(index: number): string {
  let name = "";
  let n = index;
  do {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return name;
}

// Style ids, in the order they are declared in cellXfs below.
const STYLE = {
  plain: 0,
  title: 1,
  subtitle: 2,
  header: 3,
  cell: 4,
  centered: 5,
  money: 6,
  totalLabel: 7,
  totalMoney: 8,
} as const;

type StyleId = (typeof STYLE)[keyof typeof STYLE];

export type XlsxValue = string | number | null | undefined;

function cellXml(ref: string, value: XlsxValue, style: StyleId): string {
  const s = style ? ` s="${style}"` : "";
  if (value === null || value === undefined || value === "") {
    return `<c r="${ref}"${s}/>`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}"${s}><v>${value}</v></c>`;
  }
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(
    String(value),
  )}</t></is></c>`;
}

export interface XlsxSheet {
  /** Tab name (Excel caps this at 31 characters and forbids : \ / ? * [ ]). */
  name: string;
  /** Bold heading line printed above the table, e.g. the list name. */
  title?: string;
  /** Smaller grey lines under the title, e.g. who made it and when. */
  subtitles?: string[];
  headers: string[];
  rows: XlsxValue[][];
  /** Column widths in Excel character units; defaults to 14 per column. */
  columnWidths?: number[];
  /** Zero-based columns to format as currency. */
  moneyColumns?: number[];
  /** Bold summary row under the table, e.g. ["", "", "Total", 1234.5]. */
  totalRow?: XlsxValue[];
}

function safeSheetName(name: string): string {
  const cleaned = name.replace(/[:\\/?*[\]]/g, " ").trim();
  return (cleaned || "Sheet").slice(0, 31);
}

export function buildXlsx(sheet: XlsxSheet): Buffer {
  const sheetName = safeSheetName(sheet.name);
  const columnCount = Math.max(
    sheet.headers.length,
    ...sheet.rows.map((r) => r.length),
    1,
  );

  const lines: string[] = [];
  let rowNumber = 0;

  const pushRow = (cells: string[]) => {
    rowNumber++;
    lines.push(`<row r="${rowNumber}">${cells.join("")}</row>`);
  };

  if (sheet.title) {
    pushRow([cellXml(`A${rowNumber + 1}`, sheet.title, STYLE.title)]);
  }
  for (const line of sheet.subtitles ?? []) {
    pushRow([cellXml(`A${rowNumber + 1}`, line, STYLE.subtitle)]);
  }
  if (sheet.title || sheet.subtitles?.length) rowNumber++; // spacer row

  const headerRowNumber = rowNumber + 1;
  pushRow(
    sheet.headers.map((h, i) =>
      cellXml(`${columnName(i)}${headerRowNumber}`, h, STYLE.header),
    ),
  );

  const money = new Set(sheet.moneyColumns ?? []);
  for (const row of sheet.rows) {
    const r = rowNumber + 1;
    pushRow(
      Array.from({ length: columnCount }, (_, i) =>
        cellXml(
          `${columnName(i)}${r}`,
          row[i],
          money.has(i)
            ? STYLE.money
            : typeof row[i] === "number"
              ? STYLE.centered
              : STYLE.cell,
        ),
      ),
    );
  }

  if (sheet.totalRow) {
    const r = rowNumber + 1;
    pushRow(
      Array.from({ length: columnCount }, (_, i) =>
        cellXml(
          `${columnName(i)}${r}`,
          sheet.totalRow![i],
          money.has(i) ? STYLE.totalMoney : STYLE.totalLabel,
        ),
      ),
    );
  }

  const cols = Array.from({ length: columnCount }, (_, i) => {
    const width = sheet.columnWidths?.[i] ?? 14;
    return `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`;
  }).join("");

  const lastRow = Math.max(rowNumber, headerRowNumber);
  const lastColumn = columnName(columnCount - 1);
  const quotedSheet = `'${esc(sheetName.replace(/'/g, "''"))}'`;

  const sheetXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>` +
    `<dimension ref="A1:${lastColumn}${lastRow}"/>` +
    `<sheetViews><sheetView showGridLines="0" workbookViewId="0">` +
    `<pane ySplit="${headerRowNumber}" topLeftCell="A${headerRowNumber + 1}" activePane="bottomLeft" state="frozen"/>` +
    `</sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    `<cols>${cols}</cols>` +
    `<sheetData>${lines.join("")}</sheetData>` +
    `<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>` +
    `<pageSetup orientation="portrait" paperSize="9" fitToWidth="1" fitToHeight="0"/>` +
    `<headerFooter><oddFooter>&amp;L${esc(sheetName)}&amp;RPage &amp;P of &amp;N</oddFooter></headerFooter>` +
    `</worksheet>`;

  const workbookXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="${esc(sheetName)}" sheetId="1" r:id="rId1"/></sheets>` +
    `<definedNames>` +
    `<definedName name="_xlnm.Print_Titles" localSheetId="0">${quotedSheet}!$${headerRowNumber}:$${headerRowNumber}</definedName>` +
    `</definedNames>` +
    `</workbook>`;

  const stylesXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/></numFmts>` +
    `<fonts count="5">` +
    `<font><sz val="11"/><name val="Calibri"/></font>` +
    `<font><b/><sz val="16"/><name val="Calibri"/></font>` +
    `<font><sz val="10"/><color rgb="FF6B7280"/><name val="Calibri"/></font>` +
    `<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>` +
    `<font><b/><sz val="11"/><name val="Calibri"/></font>` +
    `</fonts>` +
    `<fills count="3">` +
    `<fill><patternFill patternType="none"/></fill>` +
    `<fill><patternFill patternType="gray125"/></fill>` +
    `<fill><patternFill patternType="solid"><fgColor rgb="FF4D61BD"/><bgColor indexed="64"/></patternFill></fill>` +
    `</fills>` +
    `<borders count="3">` +
    `<border><left/><right/><top/><bottom/><diagonal/></border>` +
    `<border><left/><right/><top/><bottom style="thin"><color rgb="FFD1D5DB"/></bottom><diagonal/></border>` +
    `<border><left/><right/><top style="thin"><color rgb="FF9CA3AF"/></top><bottom/><diagonal/></border>` +
    `</borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="9">` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
    `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
    `<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
    `<xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>` +
    `<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>` +
    `<xf numFmtId="0" fontId="4" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>` +
    `<xf numFmtId="164" fontId="4" fillId="0" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>` +
    `</cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `</styleSheet>`;

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    `</Types>`;

  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  const workbookRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`;

  return zip([
    { name: "[Content_Types].xml", data: Buffer.from(contentTypes, "utf8") },
    { name: "_rels/.rels", data: Buffer.from(rootRels, "utf8") },
    { name: "xl/workbook.xml", data: Buffer.from(workbookXml, "utf8") },
    { name: "xl/_rels/workbook.xml.rels", data: Buffer.from(workbookRels, "utf8") },
    { name: "xl/styles.xml", data: Buffer.from(stylesXml, "utf8") },
    { name: "xl/worksheets/sheet1.xml", data: Buffer.from(sheetXml, "utf8") },
  ]);
}

export function xlsxResponse(filename: string, workbook: Buffer): Response {
  return new Response(new Uint8Array(workbook), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
