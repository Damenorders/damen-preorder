// Turns an uploaded price file into rows of {code, description, price}.
// Written against the real PriceList export, which starts with two banner lines
// and a blank one before the data, sometimes carries an "Item No." header, and
// writes prices like "28.0000 " or "$1,234.50". Everything it can't read comes
// back in `skipped` rather than silently vanishing.

export interface PriceRow {
  code: string;
  description: string;
  price: number;
}

export interface PriceFileReport {
  rows: PriceRow[];
  skipped: Array<{ line: number; reason: string; text: string }>;
  /** True when a real header row named the columns, rather than positions. */
  headerDetected: boolean;
}

const CODE_HEADERS = ["sku", "item", "item no.", "item no", "code", "item code"];
const NAME_HEADERS = ["product", "description", "desc", "name", "item name"];
// "Regular CAD" is what the Damen PriceList export calls its price column.
const PRICE_HEADERS = [
  "price",
  "unit price",
  "cost",
  "prix",
  "regular cad",
  "regular",
  "cad",
  "price cad",
  "prix regulier",
  "prix régulier",
];

function normalise(cell: string): string {
  return cell.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Accepts "28.0000", "$1,234.50", "1 234,50", "(2.50)" as -2.50. */
export function parsePrice(raw: string): number | null {
  let text = raw.trim();
  if (!text) return null;

  const negative = /^\(.*\)$/.test(text);
  if (negative) text = text.slice(1, -1);

  // Drop currency symbols, spaces (including non-breaking) and letters.
  text = text.replace(/[^\d.,-]/g, "");
  if (!text) return null;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma > lastDot) {
    // "1.234,50" — comma is the decimal separator.
    text = text.replace(/\./g, "").replace(",", ".");
  } else {
    text = text.replace(/,/g, "");
  }

  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

/** Locates the header row, if the file has one, and maps the three columns. */
function findColumns(rows: string[][]): {
  code: number;
  description: number;
  price: number;
  headerLine: number;
} | null {
  const limit = Math.min(rows.length, 20);
  for (let i = 0; i < limit; i++) {
    const cells = rows[i].map(normalise);
    const code = cells.findIndex((c) => CODE_HEADERS.includes(c));
    const price = cells.findIndex((c) => PRICE_HEADERS.includes(c));
    if (code === -1 || price === -1) continue;
    const description = cells.findIndex((c) => NAME_HEADERS.includes(c));
    return {
      code,
      description: description === -1 ? code + 1 : description,
      price,
      headerLine: i,
    };
  }
  return null;
}

export function readPriceFile(rows: string[][]): PriceFileReport {
  const header = findColumns(rows);
  // No header: the PriceList export's own shape — SKU, Product, Price.
  const columns = header ?? { code: 0, description: 1, price: 2, headerLine: -1 };

  const byCode = new Map<string, PriceRow>();
  const skipped: PriceFileReport["skipped"] = [];

  for (let i = columns.headerLine + 1; i < rows.length; i++) {
    const row = rows[i];
    const code = (row[columns.code] ?? "").trim();
    const description = (row[columns.description] ?? "").trim();
    const rawPrice = (row[columns.price] ?? "").trim();

    // Blank lines and the file's banner rows just aren't data.
    if (!code && !description && !rawPrice) continue;
    if (!code) continue;
    if (CODE_HEADERS.includes(normalise(code))) continue;

    const price = parsePrice(rawPrice);
    if (price === null) {
      skipped.push({
        line: i + 1,
        reason: rawPrice ? "price not a number" : "no price",
        text: `${code} ${description}`.trim(),
      });
      continue;
    }
    if (price < 0) {
      skipped.push({
        line: i + 1,
        reason: "negative price",
        text: `${code} ${description}`.trim(),
      });
      continue;
    }

    // Last row wins when a code repeats in the file.
    byCode.set(code, { code, description, price });
  }

  return { rows: [...byCode.values()], skipped, headerDetected: header !== null };
}
