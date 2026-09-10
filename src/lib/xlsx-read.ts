import { inflateRawSync } from "node:zlib";

// Reads an uploaded .xlsx down to a grid of strings — enough for a price file
// (SKU, Product, Price). The counterpart to src/lib/xlsx.ts, and the reason
// this project still needs no spreadsheet dependency. Anything fancier in the
// file (formulas, formatting, extra sheets) is ignored: only the first sheet's
// cell values come back.

/** Reads the zip central directory and inflates every part into a string. */
function unzip(buf: Buffer): Map<string, string> {
  const parts = new Map<string, string>();

  // The end-of-central-directory record sits in the last 64KB, after a
  // variable-length comment, so scan backwards for its signature.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 65558; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a valid .xlsx file.");

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);

  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;

    // Only the few parts holding cell text are worth inflating.
    if (
      name !== "xl/sharedStrings.xml" &&
      !name.startsWith("xl/worksheets/sheet")
    ) {
      continue;
    }
    if (buf.readUInt32LE(localOffset) !== 0x04034b50) continue;

    const localNameLen = buf.readUInt16LE(localOffset + 26);
    const localExtraLen = buf.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLen + localExtraLen;
    const raw = buf.subarray(start, start + compressedSize);
    try {
      parts.set(name, (method === 0 ? raw : inflateRawSync(raw)).toString("utf8"));
    } catch {
      // A part we can't inflate is a part we can't read — skip it rather than
      // failing the whole upload.
    }
  }
  return parts;
}

function unescapeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) =>
      String.fromCharCode(parseInt(code, 16)),
    )
    .replace(/&amp;/g, "&");
}

/** Concatenates every <t> in a chunk — a shared string can be split by runs. */
function textOf(xml: string): string {
  let out = "";
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t\s*\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out += unescapeXml(m[1] ?? "");
  return out;
}

function sharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  const out: string[] = [];
  const re = /<si>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(textOf(m[1]));
  return out;
}

/** "C12" -> 2 (zero-based column index). */
function columnIndex(ref: string): number {
  const letters = /^([A-Z]+)/.exec(ref.toUpperCase())?.[1] ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/**
 * Every row of the first worksheet, as trimmed strings. Blank trailing cells
 * are preserved by position, so column 3 is column 3 even when column 2 is
 * empty.
 */
export function readXlsx(buf: Buffer): string[][] {
  const parts = unzip(buf);
  const strings = sharedStrings(parts.get("xl/sharedStrings.xml"));

  const sheetName = [...parts.keys()]
    .filter((n) => n.startsWith("xl/worksheets/sheet"))
    .sort()[0];
  if (!sheetName) throw new Error("That file has no worksheet.");
  const sheet = parts.get(sheetName)!;

  const rows: string[][] = [];
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRe.exec(sheet))) {
    const cells: string[] = [];
    const cellRe = /<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellRe.exec(rowMatch[1]))) {
      const attrs = cellMatch[1] ?? "";
      const body = cellMatch[2] ?? "";
      const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const type = /t="([^"]+)"/.exec(attrs)?.[1] ?? "n";

      let value = "";
      if (type === "s") {
        const index = Number(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1]);
        value = strings[index] ?? "";
      } else if (type === "inlineStr") {
        value = textOf(body);
      } else if (type === "str") {
        value = unescapeXml(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "");
      } else {
        value = unescapeXml(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "");
      }

      const at = ref ? columnIndex(ref) : cells.length;
      while (cells.length < at) cells.push("");
      cells[at] = value.trim();
    }
    rows.push(cells);
  }
  return rows;
}
