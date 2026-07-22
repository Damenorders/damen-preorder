// Builds the WhatsApp-ready "Protein orders" text the butcher copies from the
// Meat Submissions page — one client block per client, one line per item, in
// the butcher's own shorthand. Pure/standalone so it can run on the server.
//
// Spec rules (confirmed with the butcher):
//  • Chicken Breast: show "with skin" only when Skin On, "FT" only when Full
//    Trim; never Standard Trim, never Fingers.
//  • Chicken Thigh: name only, no specs.
//  • All other meats: include their specs as-is.
//  • "Other" free-text items: print the typed description.

export interface ReadyLine {
  product: string;
  specs: string;
  specsJson: Record<string, string>;
  weight: string | null;
  quantity: number | null;
}

export interface ReadyOrder {
  clientName: string;
  lines: ReadyLine[];
}

// App product name → the butcher's shorthand used in the dispatch message.
// Edit a value here to change how a product reads in the copied text.
const SHORTHAND: Record<string, string> = {
  "Chicken Breast": "boneless breast",
  "Chicken Thigh": "boneless thighs",
  "Chicken Bone": "box chicken bones",
  "Ground Beef": "ground beef",
  "Ground Chicken": "ground chicken",
  "Pork Shoulder": "pork shoulder",
  Bavette: "Bavette",
  Striploin: "striploin",
  "Beef Shoulder": "chuck shoulder",
  "Frozen Lamb Shoulder": "Boneless Lamb",
  "Boneless Chicken Legs": "Boneless Chicken Legs",
  "Ribeye Steak": "Ribeye",
  "Filet Mignon": "filet mignon",
  "Flank Steak": "Flank Steak",
  "Denuded Inside Round": "Denuded Inside Round",
};

/** "100.00" → "100", "11.90" → "11.9", "25.28" → "25.28"; null/0 → null. */
function formatWeight(weight: string | null): string | null {
  if (!weight) return null;
  const n = Number(weight);
  if (!Number.isFinite(n) || n === 0) return null;
  return String(n);
}

/** Specs string ("Skin Off · Bone Off") → " (Skin Off, Bone Off)". The
 *  Box/Pieces Format value is dropped — the butcher's dispatch message doesn't
 *  carry the packaging format. */
function specsSuffix(specs: string): string {
  const parts = (specs || "")
    .split(" · ")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s !== "Box" && s !== "Pieces");
  return parts.length ? ` (${parts.join(", ")})` : "";
}

function renderLine(line: ReadyLine): string {
  const kg = formatWeight(line.weight);

  // "Other" — the free-text description IS the product.
  if (line.product === "Other") {
    const desc = line.specs?.trim() || "item";
    return kg ? `${kg}kg ${desc}` : desc;
  }

  const shorthand = SHORTHAND[line.product] ?? line.product;

  // Chicken Bone is counted in boxes, e.g. "1 box chicken bones".
  if (line.product === "Chicken Bone") {
    if (line.quantity != null) return `${line.quantity} ${shorthand}`;
    return kg ? `${kg}kg ${shorthand}` : shorthand;
  }

  const prefix = kg
    ? `${kg}kg `
    : line.quantity != null
      ? `${line.quantity} `
      : "";

  // Chicken Breast: reduced specs — "with skin" (Skin On) and "FT" (Full Trim).
  if (line.product === "Chicken Breast") {
    const sj = line.specsJson || {};
    const isFullTrim = sj.trim
      ? sj.trim === "Full Trim"
      : /full trim/i.test(line.specs);
    const skinOn = sj.skin ? sj.skin === "On" : /skin on/i.test(line.specs);
    const extras: string[] = [];
    if (isFullTrim) extras.push("FT");
    if (skinOn) extras.push("with skin");
    const suffix = extras.length ? ` ${extras.join(" ")}` : "";
    return `${prefix}${shorthand}${suffix}`;
  }

  // Chicken Thigh: name only, no specs.
  if (line.product === "Chicken Thigh") {
    return `${prefix}${shorthand}`;
  }

  // All other meats: include specs as-is.
  return `${prefix}${shorthand}${specsSuffix(line.specs)}`;
}

/**
 * Groups the given (already Ready-only) orders by client, preserving the order
 * they arrive in, and renders the full copyable message. Returns "" when there
 * is nothing to copy.
 */
export function buildReadyOrdersText(orders: ReadyOrder[]): string {
  const groups: { client: string; lines: string[] }[] = [];
  const indexByClient = new Map<string, number>();

  for (const order of orders) {
    let gi = indexByClient.get(order.clientName);
    if (gi === undefined) {
      gi = groups.length;
      indexByClient.set(order.clientName, gi);
      groups.push({ client: order.clientName, lines: [] });
    }
    for (const line of order.lines) {
      const rendered = renderLine(line);
      if (rendered.trim()) groups[gi].lines.push(rendered);
    }
  }

  const blocks = groups
    .filter((g) => g.lines.length > 0)
    .map((g) => `${g.client}\n${g.lines.join("\n")}`);

  if (blocks.length === 0) return "";
  return `Protein orders\n\n${blocks.join("\n\n")}`;
}
