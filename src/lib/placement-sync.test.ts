import { test } from "node:test";
import assert from "node:assert/strict";
import {
  desiredFromFloorBlob,
  desiredFromRackBlob,
  normalise,
  planSync,
  type ExistingPlacement,
} from "./placement-sync";

// Small helper to build an existing DB row for planSync.
let idSeq = 0;
function row(
  location: string,
  itemCode: string,
  quantity = 1,
  opts: { floorId?: string | null; description?: string } = {},
): ExistingPlacement {
  return {
    id: `id-${++idSeq}`,
    location,
    itemCode,
    description: opts.description ?? itemCode,
    quantity,
    floorId: opts.floorId ?? (location.startsWith("floor:") ? location.slice(6) : null),
  };
}

test("normalise trims, drops blanks, defaults qty, keys freehand by description", () => {
  const out = normalise([
    { sku: " ABC ", description: " Apples ", quantity: 3 },
    { sku: "", description: "" }, // dropped
    { sku: "", description: "Freehand item" }, // code falls back to description
    { sku: "XYZ" }, // qty defaults to 1
  ]);
  assert.deepEqual(out, [
    { code: "ABC", description: "Apples", quantity: 3 },
    { code: "Freehand item", description: "Freehand item", quantity: 1 },
    { code: "XYZ", description: "", quantity: 1 },
  ]);
});

test("desiredFromRackBlob scopes to exactly the sent locations", () => {
  const { desired, locations } = desiredFromRackBlob({
    "50": { "A-1": [{ sku: "X", quantity: 2 }] },
  });
  assert.deepEqual([...locations], ["50-A-1"]);
  assert.equal(desired.length, 1);
  assert.equal(desired[0].location, "50-A-1");
  assert.equal(desired[0].rack, 50);
  assert.equal(desired[0].level, "A");
  assert.equal(desired[0].position, "1");
  assert.equal(desired[0].itemCode, "X");
  assert.equal(desired[0].quantity, 2);
});

test("an emptied slot is still in scope (so clearing it deletes), with no desired rows", () => {
  const { desired, locations } = desiredFromRackBlob({ "50": { "A-1": [] } });
  assert.deepEqual([...locations], ["50-A-1"]);
  assert.equal(desired.length, 0);
});

test("desiredFromFloorBlob maps floorId to floor:<id>", () => {
  const { desired, locations } = desiredFromFloorBlob({ "2": [{ sku: "Y" }] });
  assert.deepEqual([...locations], ["floor:2"]);
  assert.equal(desired[0].location, "floor:2");
  assert.equal(desired[0].floorId, "2");
});

test("planSync inserts a brand-new item", () => {
  const { desired, locations } = desiredFromRackBlob({ "50": { "A-1": [{ sku: "X" }] } });
  const plan = planSync([], "rack", desired, locations);
  assert.equal(plan.inserts.length, 1);
  assert.equal(plan.inserts[0].itemCode, "X");
  assert.equal(plan.updates.length, 0);
  assert.equal(plan.deleteIds.length, 0);
  assert.equal(plan.audits[0].action, "added");
});

test("planSync updates quantity and records a qty audit", () => {
  const existing = [row("50-A-1", "X", 1)];
  const { desired, locations } = desiredFromRackBlob({ "50": { "A-1": [{ sku: "X", quantity: 5 }] } });
  const plan = planSync(existing, "rack", desired, locations);
  assert.equal(plan.inserts.length, 0);
  assert.deepEqual(plan.updates, [{ id: existing[0].id, quantity: 5, description: "" }]);
  assert.equal(plan.deleteIds.length, 0);
  assert.equal(plan.audits[0].action, "qty");
  assert.equal(plan.audits[0].prevQuantity, 1);
  assert.equal(plan.audits[0].quantity, 5);
});

test("planSync is a no-op when nothing changed", () => {
  const existing = [row("50-A-1", "X", 2, { description: "Apples" })];
  const { desired, locations } = desiredFromRackBlob({
    "50": { "A-1": [{ sku: "X", description: "Apples", quantity: 2 }] },
  });
  const plan = planSync(existing, "rack", desired, locations);
  assert.equal(plan.inserts.length, 0);
  assert.equal(plan.updates.length, 0);
  assert.equal(plan.deleteIds.length, 0);
  assert.equal(plan.audits.length, 0);
});

test("planSync deletes an item removed from a slot that IS in scope", () => {
  const existing = [row("50-A-1", "X", 1)];
  const { desired, locations } = desiredFromRackBlob({ "50": { "A-1": [] } });
  const plan = planSync(existing, "rack", desired, locations);
  assert.deepEqual(plan.deleteIds, [existing[0].id]);
  assert.equal(plan.audits[0].action, "removed");
});

// The regression that caused vanishing pallets: a save must NEVER delete items
// at a location it did not send.
test("planSync NEVER deletes items at a location outside scope", () => {
  const existing = [
    row("50-A-1", "X", 1), // this user is editing here
    row("52-A-1", "Y", 1), // another user just added this elsewhere
  ];
  // Targeted write to 50-A-1 only.
  const { desired, locations } = desiredFromRackBlob({ "50": { "A-1": [{ sku: "X" }, { sku: "Z" }] } });
  const plan = planSync(existing, "rack", desired, locations);
  assert.equal(plan.deleteIds.length, 0, "must not delete anything");
  assert.equal(plan.inserts.length, 1);
  assert.equal(plan.inserts[0].itemCode, "Z");
  // 52-A-1:Y was never in scope, so it is untouched — survives.
  assert.ok(!plan.deleteIds.includes(existing[1].id));
});

test("rack-scope sync never touches floor placements and vice versa", () => {
  const existing = [
    row("50-A-1", "X", 1),
    row("floor:2", "Y", 1, { floorId: "2" }),
  ];
  // A rack save that clears 50-A-1 must not delete the floor row.
  const rack = desiredFromRackBlob({ "50": { "A-1": [] } });
  const rackPlan = planSync(existing, "rack", rack.desired, rack.locations);
  assert.deepEqual(rackPlan.deleteIds, [existing[0].id]);

  // A floor save that clears floor:2 must not delete the rack row.
  const floor = desiredFromFloorBlob({ "2": [] });
  const floorPlan = planSync(existing, "floor", floor.desired, floor.locations);
  assert.deepEqual(floorPlan.deleteIds, [existing[1].id]);
});

test("planSync swaps quantities correctly on a two-item slot", () => {
  const existing = [
    row("50-A-1", "X", 1, { description: "Apples" }),
    row("50-A-1", "W", 4, { description: "Pears" }),
  ];
  // Keep X (bump qty), drop W, add V.
  const { desired, locations } = desiredFromRackBlob({
    "50": { "A-1": [{ sku: "X", description: "Apples", quantity: 3 }, { sku: "V", quantity: 1 }] },
  });
  const plan = planSync(existing, "rack", desired, locations);
  assert.equal(plan.inserts.length, 1);
  assert.equal(plan.inserts[0].itemCode, "V");
  assert.deepEqual(plan.updates, [{ id: existing[0].id, quantity: 3, description: "Apples" }]);
  assert.deepEqual(plan.deleteIds, [existing[1].id]); // W removed
});
