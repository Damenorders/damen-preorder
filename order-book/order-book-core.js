/**
 * order-book-core.js
 *
 * The logic behind the Order Book, with no UI and no dependencies.
 * Works in the browser, in Node, and inside React/Vue/Svelte.
 *
 * Nothing here touches the DOM or storage — every function takes state in
 * and returns a result, so you can wire it to whatever UI you already have.
 *
 * Shapes it expects:
 *
 *   product   { id, name, pack, cost, sell, costDate }
 *   line      { id, qty, unit, name, pack }
 *   supplier  { contact, email, products: product[] }
 *   meta      { method: "delivery" | "pickup", date: "YYYY-MM-DD" }
 *   state     { suppliers: {name: supplier},
 *               toOrder:   {name: line[]},
 *               orderMeta: {name: meta},
 *               pastOrders: [{ id, supplier, date, items: line[], method, wanted }] }
 */

/* ------------------------------------------------------------------ *
 * Product identity
 *
 * The rule: the same item written differently is the SAME product, but a
 * different pack, format or size is a DIFFERENT product.
 * ------------------------------------------------------------------ */

/** Strip punctuation, spacing and case so "TS - Rice Paper" === "ts rice paper". */
export function normalizeName(s) {
  return String(s == null ? "" : s).toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

/** Same idea for pack sizes, but keeps decimals and treats "3,5L" as "3.5L". */
export function normalizePack(s) {
  return String(s == null ? "" : s)
    .toUpperCase().replace(/,/g, ".")
    .replace(/[^A-Z0-9.]+/g, " ").replace(/\s+/g, " ").trim();
}

function significantWords(s) {
  return normalizeName(s).split(" ").filter(w => w.length > 2);
}

/**
 * True when two names share enough words to be worth asking about.
 * Deliberately fuzzy — use it to prompt the user, never to merge silently.
 */
export function looksSimilar(a, b, threshold = 0.7) {
  const A = significantWords(a), B = significantWords(b);
  if (!A.length || !B.length) return false;
  const hits = A.filter(w => B.includes(w)).length;
  return hits / Math.min(A.length, B.length) >= threshold;
}

/**
 * Decide what an incoming product is.
 *   { kind: "exact",   product }  -> reuse it, no question asked
 *   { kind: "similar", product }  -> ASK THE USER before merging
 *   { kind: "new" }               -> safe to create
 *
 * A different pack size never returns "exact" or "similar".
 */
export function matchProduct(products, name, pack) {
  const n = normalizeName(name), p = normalizePack(pack);

  const exact = products.find(x => normalizeName(x.name) === n && normalizePack(x.pack) === p);
  if (exact) return { kind: "exact", product: exact };

  const similar = products.find(x => normalizePack(x.pack) === p && looksSimilar(x.name, name));
  if (similar) return { kind: "similar", product: similar };

  return { kind: "new" };
}

/* ------------------------------------------------------------------ *
 * Order operations — all return a NEW state, never mutate the old one
 * ------------------------------------------------------------------ */

const uid = () => Math.random().toString(36).slice(2, 9);
const clone = s => JSON.parse(JSON.stringify(s));

export function today(d = new Date()) {
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}

/**
 * Add a line to a supplier's open order.
 *
 * Repeating a product at the same unit adds to the existing line instead of
 * creating a second one. Pass `resolvedProduct` when the user has already
 * answered a "similar product?" prompt; otherwise a "similar" match is
 * reported back so you can ask, and nothing is written.
 *
 * Returns { state, needsDecision?, line }
 */
export function addLine(state, supplier, { qty = 1, unit = "x", name, pack = "" }, resolvedProduct) {
  if (!name || !String(name).trim()) throw new Error("A product name is required.");

  const next = clone(state);
  next.suppliers[supplier] = next.suppliers[supplier] || { contact: "", email: "", products: [] };
  const products = next.suppliers[supplier].products;

  let use = resolvedProduct || null;
  if (!use) {
    const m = matchProduct(products, name, pack);
    if (m.kind === "similar") {
      // Caller must ask the user; no silent merge, no silent duplicate.
      return { state, needsDecision: { incoming: { name, pack }, existing: m.product } };
    }
    use = m.kind === "exact" ? m.product : null;
  }

  if (use) { name = use.name; pack = use.pack; }
  else products.push({ id: uid(), name, pack, cost: null, sell: null, costDate: null });

  next.toOrder[supplier] = next.toOrder[supplier] || [];
  const open = next.toOrder[supplier].find(l =>
    normalizeName(l.name) === normalizeName(name) &&
    normalizePack(l.pack) === normalizePack(pack) &&
    l.unit === unit);

  let line;
  if (open) { open.qty = Number(open.qty) + (Number(qty) || 1); line = open; }
  else {
    line = { id: uid(), qty: Number(qty) || 1, unit, name, pack };
    next.toOrder[supplier].push(line);
  }
  return { state: next, line };
}

/** Move a supplier's open lines into history, dated today, and clear the list. */
export function markOrdered(state, supplier, date = today()) {
  const lines = (state.toOrder || {})[supplier] || [];
  if (!lines.length) return state;

  const next = clone(state);
  const m = (next.orderMeta || {})[supplier] || {};
  next.pastOrders = next.pastOrders || [];
  next.pastOrders.push({
    id: uid(), supplier, date, items: lines,
    method: m.method || "delivery", wanted: m.date || ""
  });
  delete next.toOrder[supplier];
  if (next.orderMeta) delete next.orderMeta[supplier];
  return next;
}

/** Undo: put a past order back on the open list, merging with anything already there. */
export function undoOrder(state, pastOrderId) {
  const order = (state.pastOrders || []).find(o => o.id === pastOrderId);
  if (!order) return state;

  const next = clone(state);
  const list = next.toOrder[order.supplier] = next.toOrder[order.supplier] || [];

  for (const item of order.items) {
    const same = list.find(l =>
      normalizeName(l.name) === normalizeName(item.name) &&
      normalizePack(l.pack) === normalizePack(item.pack) &&
      l.unit === item.unit);
    if (same) same.qty = Number(same.qty) + (Number(item.qty) || 1);
    else list.push({ id: uid(), qty: Number(item.qty) || 1, unit: item.unit, name: item.name, pack: item.pack });
  }

  next.pastOrders = next.pastOrders.filter(o => o.id !== pastOrderId);
  next.orderMeta = next.orderMeta || {};
  next.orderMeta[order.supplier] = { method: order.method || "delivery", date: order.wanted || "" };
  return next;
}

/* ------------------------------------------------------------------ *
 * The message sent to the supplier
 * ------------------------------------------------------------------ */

const MONTHS = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"];

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin",
              "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function longDate(iso, lang = "en") {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-");
  const names = lang === "fr" ? MOIS : MONTHS;
  const name = names[Number(m) - 1];
  if (!name) return iso;
  return lang === "fr" ? `${Number(d)} ${name} ${y}` : `${name} ${Number(d)}, ${y}`;
}

/** "2 pallet" / "12x" — matches how the quantities are written by hand. */
export function formatQty(qty, unit) {
  return unit === "x" ? `${qty}x` : `${qty} ${unit}`;
}

/**
 * Build the order message.
 *
 * options:
 *   contact    who it's addressed to        (default "there")
 *   method     "delivery" | "pickup"        (default "delivery")
 *   date       "YYYY-MM-DD"                 (blank shows as ____ so it's obvious)
 *   showPack   include pack size in brackets (default true — it's what
 *              separates two otherwise identical products)
 *   lang       "en" | "fr"
 */
export function buildOrderMessage(lines, options = {}) {
  const {
    contact = "", method = "delivery", date = "",
    showPack = true, lang = "en"
  } = options;

  const who = String(contact).trim() || (lang === "fr" ? "bonjour" : "there");
  const when = date ? longDate(date, lang) : "____";

  const head = lang === "fr"
    ? `Bonjour ${who}, je voudrais commander les produits suivants pour ${method === "pickup" ? "ramassage" : "livraison"} le ${when} : `
    : `Hello ${who}, I would like to order the following products for ${method} on ${when} : `;

  const body = lines
    .map(l => `* ${formatQty(l.qty, l.unit)} ${l.name}${showPack && l.pack ? ` (${l.pack})` : ""}`)
    .join("\n");

  const foot = lang === "fr" ? "\n\n\nMerci de confirmer\nMerci\n" : "\n\n\nPlease Confirm\nThank you\n";

  return head + "\n\n" + body + foot;
}

/* ------------------------------------------------------------------ */

export function emptyState() {
  return { suppliers: {}, toOrder: {}, orderMeta: {}, pastOrders: [] };
}
