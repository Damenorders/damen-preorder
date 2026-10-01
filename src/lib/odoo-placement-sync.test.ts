import { test } from "node:test";
import assert from "node:assert/strict";
import {
  desiredFromOdooFloorBlob,
  desiredFromOdooRackBlob,
  itemKeyFor,
  pairMoves,
  planOdooSync,
  type OdooDesired,
  type OdooExistingPlacement,
  type ResolveSku,
} from "./odoo-placement-sync";

const CATALOG: Record<string, { sku: string; description: string }> = {
  "A100": { sku: "A100", description: "TS - SQUARE RICE PAPER 22CM" },
  "B200": { sku: "B200", description: "OLIVE OIL 6 X 2.84L" },
};
const resolve: ResolveSku = (sku) => CATALOG[sku.trim().toUpperCase()] ?? null;

let idSeq = 0;
function row(
  location: string,
  sku: string | null,
  opts: Partial<OdooExistingPlacement> = {},
): OdooExistingPlacement {
  const description = opts.description ?? (sku ? CATALOG[sku].description : "");
  return {
    id: `id-${++idSeq}`,
    location,
    itemKey: itemKeyFor(sku, description),
    sku,
    description,
    quantity: 1,
    quantityUnit: 0,
    consignment: false,
    floorId: location.startsWith("floor:") ? location.slice(6) : null,
    ...opts,
  };
}

function rack(blob: Parameters<typeof desiredFromOdooRackBlob>[0]) {
  const r = desiredFromOdooRackBlob(blob, resolve);
  assert.ok(r.ok, r.ok ? "" : r.error);
  return r as { ok: true; desired: OdooDesired[]; locations: Set<string> };
}

test("a SKU is replaced by the Odoo list's own spelling and description", () => {
  const r = rack({ "15": { "B-3": [{ sku: " a100 ", description: "whatever typed", quantity: 4 }] } });
  assert.equal(r.desired.length, 1);
  assert.equal(r.desired[0].sku, "A100");
  assert.equal(r.desired[0].description, "TS - SQUARE RICE PAPER 22CM");
  assert.equal(r.desired[0].location, "15-B-3");
  assert.equal(r.desired[0].quantity, 4);
});

test("a SKU that is not in the Odoo list is refused, never registered", () => {
  const r = desiredFromOdooRackBlob({ "15": { "B-3": [{ sku: "ZZZ9", description: "x", quantity: 1 }] } }, resolve);
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /ZZZ9 is not in the Odoo list/);
});

test("a product typed without a SKU is stored with no SKU", () => {
  const r = rack({ "15": { "B-3": [{ sku: "", description: "  Mystery sauce  ", quantity: 2 }] } });
  assert.equal(r.desired[0].sku, null);
  assert.equal(r.desired[0].description, "Mystery sauce");
  assert.equal(r.desired[0].itemKey, "~MYSTERY SAUCE");
});

test("the same product twice at one location is refused", () => {
  const bySku = desiredFromOdooRackBlob(
    { "15": { "B-3": [{ sku: "A100", quantity: 1 }, { sku: "a100", quantity: 3 }] } },
    resolve,
  );
  assert.equal(bySku.ok, false);
  const byText = desiredFromOdooFloorBlob(
    { "2": [{ description: "Mystery sauce", quantity: 1 }, { description: "mystery  SAUCE", quantity: 1 }] },
    resolve,
  );
  assert.equal(byText.ok, false);
});

test("consignment is carried, and defaults to false", () => {
  const r = rack({ "15": { "B-3": [{ sku: "A100", quantity: 1, consignment: true }, { sku: "B200", quantity: 1 }] } });
  assert.deepEqual(r.desired.map((d) => d.consignment), [true, false]);
});

test("toggling consignment updates the row and writes a consignment audit", () => {
  const existing = [row("15-B-3", "A100", { quantity: 5 })];
  const r = rack({ "15": { "B-3": [{ sku: "A100", quantity: 5, consignment: true }] } });
  const plan = planOdooSync(existing, "rack", r.desired, r.locations);
  assert.equal(plan.inserts.length, 0);
  assert.equal(plan.deleteIds.length, 0);
  assert.equal(plan.updates.length, 1);
  assert.equal(plan.updates[0].consignment, true);
  assert.deepEqual(plan.audits.map((a) => a.action), ["consignment"]);
});

test("a count change and a consignment change both get audited", () => {
  const existing = [row("15-B-3", "A100", { quantity: 5 })];
  const r = rack({ "15": { "B-3": [{ sku: "A100", quantity: 7, consignment: true }] } });
  const plan = planOdooSync(existing, "rack", r.desired, r.locations);
  assert.deepEqual(plan.audits.map((a) => a.action).sort(), ["consignment", "qty"]);
  assert.equal(plan.audits.find((a) => a.action === "qty")!.prevQuantity, 5);
});

test("a save only removes rows at the locations it sent", () => {
  const existing = [row("15-B-3", "A100"), row("15-B-4", "B200"), row("floor:2", null, { description: "Pallet X" })];
  const r = rack({ "15": { "B-3": [] } });
  const plan = planOdooSync(existing, "rack", r.desired, r.locations);
  assert.equal(plan.deleteIds.length, 1);
  assert.equal(plan.deleteIds[0], existing[0].id);
  assert.equal(plan.audits[0].action, "removed");
});

test("rack saves never touch floor rows and vice versa", () => {
  const existing = [row("floor:2", "A100")];
  const r = rack({ "15": { "B-3": [{ sku: "A100", quantity: 1 }] } });
  const plan = planOdooSync(existing, "rack", r.desired, r.locations);
  assert.equal(plan.inserts.length, 1);
  assert.equal(plan.deleteIds.length, 0);
});

test("re-saving an unchanged location changes nothing", () => {
  const existing = [row("15-B-3", "A100", { quantity: 2, quantityUnit: 3, consignment: true })];
  const r = rack({ "15": { "B-3": [{ sku: "A100", quantity: 2, quantityUnit: 3, consignment: true }] } });
  const plan = planOdooSync(existing, "rack", r.desired, r.locations);
  assert.deepEqual(plan, { inserts: [], updates: [], deleteIds: [], audits: [] });
});

test("a move is logged as one 'moved' row, not removed + added", () => {
  const base = { sku: "A100", description: "TS - SQUARE RICE PAPER 22CM", quantity: 3, quantityUnit: 0, consignment: true };
  const rows = pairMoves(
    [
      { action: "added", unit: "dry", location: "15-B-6", ...base },
      { action: "removed", unit: "dry", location: "15-B-4", ...base },
    ],
    (unit, loc) => `${unit}:${loc}`,
  );
  assert.deepEqual(rows, [
    { action: "moved", unit: "dry", sku: "A100", description: base.description, fromLocation: "dry:15-B-4", toLocation: "dry:15-B-6", quantity: 3, quantityUnit: 0, consignment: true },
  ]);
});

test("a swap logs two moves; unrelated changes stay as they are", () => {
  const a = { sku: "A100", description: "TS - SQUARE RICE PAPER 22CM", quantity: 1, quantityUnit: 0, consignment: false };
  const b = { sku: null, description: "Mystery sauce", quantity: 2, quantityUnit: 0, consignment: false };
  const rows = pairMoves(
    [
      { action: "added", unit: "freezer", location: "30-A-1b", ...a },
      { action: "removed", unit: "freezer", location: "30-A-1b", ...b },
      { action: "added", unit: "dry", location: "15-B-4", ...b },
      { action: "removed", unit: "dry", location: "15-B-4", ...a },
      { action: "removed", unit: "dry", location: "15-B-4", sku: "B200", description: "OLIVE OIL 6 X 2.84L", quantity: 1, quantityUnit: 0, consignment: false },
      { action: "qty", unit: "dry", location: "15-B-9", ...a, prevQuantity: 4 },
    ],
    (unit, loc) => `${unit}:${loc}`,
  );
  assert.deepEqual(rows.map((r) => [r.action, r.fromLocation ?? r.location, r.toLocation ?? ""]), [
    ["moved", "freezer:30-A-1b", "dry:15-B-4"],
    ["moved", "dry:15-B-4", "freezer:30-A-1b"],
    ["removed", "15-B-4", ""],
    ["qty", "15-B-9", ""],
  ]);
});
