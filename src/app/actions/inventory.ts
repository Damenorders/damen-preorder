"use server";

// Warehouse Inventory — the rack-locator client persists through a tiny
// key/value bridge (window.storage). These actions translate those keys into
// real rows in inventory_placements and write the audit trail.
//
// Keys the client uses:
//   "rack-data"            → Dry Products rack placements (unprefixed, legacy)
//   "<unit>-rack-data"     → rack placements for freezer / fridge40 / 50 / 60
//   "<unit>-floor-data"    → floor-storage placements
//   "<unit>-rack-rows"     → rack list (layout metadata, stored as-is)
//   "wh-audit-log"         → read-only; served from inventory_audit

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  inventoryAudit,
  inventoryItems,
  inventoryPlacements,
  type User,
  type WarehouseUnit,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import {
  getFloorData,
  getInventoryAudit,
  getRackData,
} from "@/lib/inventory-data";
import {
  desiredFromFloorBlob,
  desiredFromRackBlob,
  planSync,
  type ClientItem,
  type Desired,
  type FloorBlob,
  type RackBlob,
} from "@/lib/placement-sync";

const UNITS: WarehouseUnit[] = [
  "dry",
  "freezer",
  "fridge40",
  "fridge50",
  "fridge60",
];

const UNIT_LABELS: Record<WarehouseUnit, string> = {
  dry: "Dry Products",
  freezer: "Freezer",
  fridge40: "Fridge 40",
  fridge50: "Fridge 50",
  fridge60: "Fridge 60",
};

/** "freezer-rack-data" → {unit: "freezer", kind: "rack-data"}; bare keys are Dry Products. */
function parseKey(key: string): { unit: WarehouseUnit; kind: string } | null {
  for (const unit of UNITS) {
    if (unit !== "dry" && key.startsWith(`${unit}-`)) {
      return { unit, kind: key.slice(unit.length + 1) };
    }
  }
  if (/^(rack-data|floor-data|rack-rows)$/.test(key)) {
    return { unit: "dry", kind: key };
  }
  return null;
}

/** Keeps unknown item codes out of the FK by registering them as inactive catalog rows. */
async function ensureItems(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  desired: Desired[],
) {
  const codes = [...new Set(desired.map((d) => d.itemCode))];
  if (!codes.length) return;
  const known = await tx
    .select({ code: inventoryItems.code })
    .from(inventoryItems)
    .where(inArray(inventoryItems.code, codes));
  const knownSet = new Set(known.map((k) => k.code));
  const missing = desired.filter((d) => !knownSet.has(d.itemCode));
  if (!missing.length) return;
  const seen = new Set<string>();
  const rows = missing
    .filter((m) => (seen.has(m.itemCode) ? false : seen.add(m.itemCode)))
    .map((m) => ({
      code: m.itemCode,
      description: m.description || m.itemCode,
      section: "UNLISTED",
      active: false,
    }));
  await tx.insert(inventoryItems).values(rows).onConflictDoNothing();
}

/**
 * Syncs the placements at the locations the client actually sent (`scopeLocations`),
 * writing one audit row per real change. Crucially, it only DELETES placements at
 * those locations — a save can never remove items from a location the client never
 * included, so one user's save can't wipe another user's items elsewhere in the
 * warehouse (the whole warehouse is one shared inventory). Rack and floor
 * placements are synced separately so saving one never wipes the other.
 */
async function syncPlacements(
  user: User,
  unit: WarehouseUnit,
  scope: "rack" | "floor",
  desired: Desired[],
  scopeLocations: Set<string>,
) {
  await db.transaction(async (tx) => {
    await ensureItems(tx, desired);

    const existing = await tx
      .select()
      .from(inventoryPlacements)
      .where(eq(inventoryPlacements.unit, unit));

    // All insert/update/scoped-delete decisions live in the pure planSync
    // (src/lib/placement-sync.ts) so they can be unit-tested; here we just
    // apply the plan inside the transaction.
    const plan = planSync(existing, scope, desired, scopeLocations);
    const stamp = { unit, userId: user.id, userName: user.name };

    for (const d of plan.inserts) {
      await tx.insert(inventoryPlacements).values({
        unit,
        location: d.location,
        rack: d.rack,
        level: d.level,
        position: d.position,
        floorId: d.floorId,
        itemCode: d.itemCode,
        description: d.description,
        quantity: d.quantity,
        updatedBy: user.id,
      });
    }

    for (const u of plan.updates) {
      await tx
        .update(inventoryPlacements)
        .set({
          quantity: u.quantity,
          description: u.description,
          updatedBy: user.id,
          updatedAt: new Date(),
        })
        .where(eq(inventoryPlacements.id, u.id));
    }

    if (plan.deleteIds.length) {
      await tx
        .delete(inventoryPlacements)
        .where(inArray(inventoryPlacements.id, plan.deleteIds));
    }

    if (plan.audits.length) {
      await tx
        .insert(inventoryAudit)
        .values(plan.audits.map((a) => ({ ...stamp, ...a })));
    }
  });

  revalidatePath("/warehouse");
}

/** window.storage.get(key) */
export async function readWarehouseKey(
  key: string,
): Promise<{ value: string } | null> {
  await requireRole("buyer", "dispatch");

  if (key === "wh-audit-log") {
    const log = await getInventoryAudit(200);
    return {
      value: JSON.stringify(
        log.map((e) => ({ ...e, wh: UNIT_LABELS[e.wh as WarehouseUnit] ?? e.wh })),
      ),
    };
  }

  const parsed = parseKey(key);
  if (!parsed) return null;
  if (parsed.kind === "rack-data") {
    return { value: JSON.stringify(await getRackData(parsed.unit)) };
  }
  if (parsed.kind === "floor-data") {
    return { value: JSON.stringify(await getFloorData(parsed.unit)) };
  }
  // rack-rows is layout metadata; the client falls back to its own defaults.
  return null;
}

/** window.storage.set(key, value) */
export async function writeWarehouseKey(
  key: string,
  value: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole("buyer", "dispatch");

  // The audit trail is derived server-side — the client's copy is read-only.
  if (key === "wh-audit-log") return { ok: true };

  const parsed = parseKey(key);
  if (!parsed) return { ok: false, error: `Unknown key ${key}` };
  if (parsed.kind === "rack-rows") return { ok: true };

  let blob: unknown;
  try {
    blob = JSON.parse(value);
  } catch {
    return { ok: false, error: "Malformed payload" };
  }

  if (parsed.kind === "rack-data") {
    const { desired, locations } = desiredFromRackBlob(blob as RackBlob);
    await syncPlacements(user, parsed.unit, "rack", desired, locations);
    return { ok: true };
  }
  if (parsed.kind === "floor-data") {
    const { desired, locations } = desiredFromFloorBlob(blob as FloorBlob);
    await syncPlacements(user, parsed.unit, "floor", desired, locations);
    return { ok: true };
  }
  return { ok: false, error: `Unknown key ${key}` };
}

/**
 * Targeted, transactional write of ONE location — a single rack slot
 * ("50-A-1") or floor area ("floor:2"). Unlike writeWarehouseKey, which syncs
 * the entire warehouse blob and can delete items other people added elsewhere,
 * this only ever touches the one location it is given: `syncPlacements` is
 * scoped to that single location, so a concurrent edit on any other slot can
 * never be wiped. This is the path every per-slot edit should use.
 */
export async function writeWarehouseLocation(input: {
  unit: WarehouseUnit;
  scope: "rack" | "floor";
  rackId?: string;
  slotCode?: string;
  floorId?: string;
  items: ClientItem[];
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole("buyer", "dispatch");
  const { unit, scope, rackId, slotCode, floorId, items } = input;
  if (!UNITS.includes(unit)) return { ok: false, error: `Unknown unit ${unit}` };
  const list = Array.isArray(items) ? items : [];

  if (scope === "rack") {
    if (!rackId || !slotCode) return { ok: false, error: "Missing rack location" };
    const { desired, locations } = desiredFromRackBlob({ [rackId]: { [slotCode]: list } });
    await syncPlacements(user, unit, "rack", desired, locations);
    return { ok: true };
  }
  if (scope === "floor") {
    if (!floorId) return { ok: false, error: "Missing floor id" };
    const { desired, locations } = desiredFromFloorBlob({ [floorId]: list });
    await syncPlacements(user, unit, "floor", desired, locations);
    return { ok: true };
  }
  return { ok: false, error: `Unknown scope ${scope}` };
}

/** Clears one unit — used by the locator's "reset" button. */
export async function clearWarehouseUnit(unit: WarehouseUnit) {
  const user = await requireRole("buyer", "dispatch");
  await db.transaction(async (tx) => {
    await tx
      .delete(inventoryPlacements)
      .where(eq(inventoryPlacements.unit, unit));
    await tx.insert(inventoryAudit).values({
      action: "cleared",
      unit,
      description: `All pallet data for ${UNIT_LABELS[unit]}`,
      userId: user.id,
      userName: user.name,
    });
  });
  revalidatePath("/warehouse");
  return { ok: true };
}

/** Where is this item? Used by the dashboard/search entry points. */
export async function findItemLocations(code: string) {
  await requireRole("buyer", "dispatch");
  const rows = await db
    .select()
    .from(inventoryPlacements)
    .where(and(eq(inventoryPlacements.itemCode, code)));
  return rows.map((r) => ({
    unit: r.unit,
    unitLabel: UNIT_LABELS[r.unit],
    location: r.location,
    quantity: r.quantity,
  }));
}
