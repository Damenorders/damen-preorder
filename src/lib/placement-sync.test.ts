import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clientSku,
  duplicateMessage,
  findDuplicate,
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
  opts: { floorId?: string | null; description?: string; quantityUnit?: number } = {},
): ExistingPlacement {
  return {
    id: `id-${++idSeq}`,
    location,
    itemCode,
    description: opts.description ?? itemCode,
    quantity,
    quantityUnit: opts.quantityUnit ?? 0,
    floorId: opts.floorId ?? (location.startsWith("floor:") ? location.slice(6) : null),
  };
}

test("normalise trims, drops blanks, keys freehand by description, never invents a count", () => {
  const out = normalise([
    { sku: " ABC ", description: " Apples ", quantity: 3, quantityUnit: 7 },
    { sku: "", description: "" }, // dropped
    { sku: "", description: "Freehand item", quantity: 2 }, // code falls back to description
    { sku: "XYZ" }, // no box count sent -> 0 (not a made-up 1); no unit count -> undefined
    { sku: "NEG", quantity: -4, quantityUnit: 2.9 }, // clamped / truncated
  ]);
  assert.deepEqual(out, [
    { code: "ABC", description: "Apples", quantity: 3, quantityUnit: 7 },
    { code: "Freehand item", description: "Freehand item", quantity: 2, quantityUnit: undefined },
    { code: "XYZ", description: "", quantity: 0, quantityUnit: undefined },
    { code: "NEG", description: "", quantity: 0, quantityUnit: 2 },
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
  assert.deepEqual(plan.updates, [{ id: existing[0].id, quantity: 5, quantityUnit: 0, description: "" }]);
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
  assert.deepEqual(plan.updates, [{ id: existing[0].id, quantity: 3, quantityUnit: 0, description: "Apples" }]);
  assert.deepEqual(plan.deleteIds, [existing[1].id]); // W removed
});

test("a freehand item (no SKU) reads back with a BLANK sku, not its stand-in code", () => {
  const [stored] = normalise([{ sku: "", description: "Rice paper round 30cm" }]);
  assert.equal(stored.code, "Rice paper round 30cm"); // what the DB holds
  assert.equal(clientSku(stored.code, stored.description, false), "");
});

test("a long freehand description still reads back blank (stand-in is truncated)", () => {
  const desc = "X".repeat(80);
  const [stored] = normalise([{ description: desc }]);
  assert.equal(clientSku(stored.code, desc, false), "");
});

test("a real SKU always reads back as itself", () => {
  assert.equal(clientSku("TS100", "TS - SQUARE RICE PAPER 22CM", true), "TS100");
  // typed by hand, not in the catalog — still the code the user wrote
  assert.equal(clientSku("ZZ-9", "Mystery box", false), "ZZ-9");
  // a live catalog item whose code happens to equal its name is never blanked
  assert.equal(clientSku("SALT", "SALT", true), "SALT");
});

test("saving a freehand item again after reload is a no-op (no duplicate row)", () => {
  const desc = "Unlisted pallet wrap";
  const existing = [row("15-A-1", desc, 4, { description: desc })];
  const reloadedSku = clientSku(desc, desc, false); // "" — what the phone now holds
  const { desired, locations } = desiredFromRackBlob({
    "15": { "A-1": [{ sku: reloadedSku, description: desc, quantity: 4 }] },
  });
  const plan = planSync(existing, "rack", desired, locations);
  assert.deepEqual(plan, { inserts: [], updates: [], deleteIds: [], audits: [] });
});

test("box and unit counts are stored separately and never added together", () => {
  const { desired, locations } = desiredFromRackBlob({
    "15": { "A-1": [{ sku: "X", quantity: 3, quantityUnit: 12 }] },
  });
  const plan = planSync([], "rack", desired, locations);
  assert.equal(plan.inserts[0].quantity, 3);
  assert.equal(plan.inserts[0].quantityUnit, 12);
  assert.equal(plan.audits[0].quantity, 3);
  assert.equal(plan.audits[0].quantityUnit, 12);
});

test("changing only the unit count is an update with a qty audit showing both before/after", () => {
  const existing = [row("15-A-1", "X", 3, { quantityUnit: 12 })];
  const { desired, locations } = desiredFromRackBlob({
    "15": { "A-1": [{ sku: "X", description: "X", quantity: 3, quantityUnit: 5 }] },
  });
  const plan = planSync(existing, "rack", desired, locations);
  assert.deepEqual(plan.updates, [{ id: existing[0].id, quantity: 3, quantityUnit: 5, description: "X" }]);
  assert.equal(plan.audits.length, 1);
  assert.deepEqual(
    [plan.audits[0].prevQuantity, plan.audits[0].prevQuantityUnit, plan.audits[0].quantity, plan.audits[0].quantityUnit],
    [3, 12, 3, 5],
  );
});

// A phone that loaded the page before the box/unit split runs the old script,
// which sends only `quantity`. Its save must not wipe unit counts entered on a
// phone running the new one.
test("a save from an old client (no unit count) keeps the stored unit count", () => {
  const existing = [row("15-A-1", "X", 3, { description: "X", quantityUnit: 12 })];
  const { desired, locations } = desiredFromRackBlob({
    "15": { "A-1": [{ sku: "X", description: "X", quantity: 4 }] },
  });
  const plan = planSync(existing, "rack", desired, locations);
  assert.deepEqual(plan.updates, [{ id: existing[0].id, quantity: 4, quantityUnit: 12, description: "X" }]);
  // ...and an old client re-saving unchanged boxes is a no-op, not a unit wipe.
  const same = desiredFromRackBlob({ "15": { "A-1": [{ sku: "X", description: "X", quantity: 3 }] } });
  const noop = planSync(existing, "rack", same.desired, same.locations);
  assert.deepEqual(noop, { inserts: [], updates: [], deleteIds: [], audits: [] });
});

test("the same product twice at one location is caught before planSync can drop a count", () => {
  const dupSku = desiredFromRackBlob({ "15": { "B-3": [{ sku: "OIL-12", quantity: 2 }, { sku: "OIL-12", quantity: 5 }] } });
  const found = findDuplicate(dupSku.desired);
  assert.ok(found);
  assert.equal(found.location, "15-B-3");
  assert.match(duplicateMessage(found), /listed twice at 15-B-3/);

  const dupText = desiredFromFloorBlob({ "2": [{ description: "Tahini" }, { description: "Tahini" }] });
  assert.ok(findDuplicate(dupText.desired));

  // Same product at two DIFFERENT locations is fine.
  const twoPlaces = desiredFromRackBlob({ "15": { "B-3": [{ sku: "OIL-12" }], "B-4": [{ sku: "OIL-12" }] } });
  assert.equal(findDuplicate(twoPlaces.desired), null);
});
