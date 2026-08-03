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

interface ClientItem {
  sku?: string;
  description?: string;
  quantity?: number;
}
type RackBlob = Record<string, Record<string, ClientItem[]>>;
type FloorBlob = Record<string, ClientItem[]>;

interface Desired {
  location: string;
  rack: number | null;
  level: string | null;
  position: string | null;
  floorId: string | null;
  itemCode: string;
  description: string;
  quantity: number;
}

function normalise(items: ClientItem[] | undefined) {
  const out: { code: string; description: string; quantity: number }[] = [];
  for (const it of items ?? []) {
    const code = (it.sku ?? "").trim();
    const description = (it.description ?? "").trim();
    if (!code && !description) continue;
    // Items typed freehand (not in the catalog) are keyed by their description
    // so they still get a stable row; the catalog code wins when present.
    out.push({
      code: code || description.slice(0, 64),
      description,
      quantity: Number.isFinite(it.quantity) ? Number(it.quantity) : 1,
    });
  }
  return out;
}

interface DesiredBlob {
  desired: Desired[];
  /** Every location the client's payload included — the ONLY locations a save
   *  is allowed to delete from, so it can never wipe a location it never saw. */
  locations: Set<string>;
}

function desiredFromRackBlob(blob: RackBlob): DesiredBlob {
  const out: Desired[] = [];
  const locations = new Set<string>();
  for (const [rackId, slots] of Object.entries(blob ?? {})) {
    for (const [slotCode, items] of Object.entries(slots ?? {})) {
      const [level, position] = slotCode.split("-");
      const location = `${rackId}-${level}-${position}`;
      locations.add(location);
      for (const it of normalise(items)) {
        out.push({
          location,
          rack: Number.parseInt(rackId, 10) || null,
          level,
          position,
          floorId: null,
          itemCode: it.code,
          description: it.description,
          quantity: it.quantity,
        });
      }
    }
  }
  return { desired: out, locations };
}

function desiredFromFloorBlob(blob: FloorBlob): DesiredBlob {
  const out: Desired[] = [];
  const locations = new Set<string>();
  for (const [floorId, items] of Object.entries(blob ?? {})) {
    const location = `floor:${floorId}`;
    locations.add(location);
    for (const it of normalise(items)) {
      out.push({
        location,
        rack: null,
        level: null,
        position: null,
        floorId,
        itemCode: it.code,
        description: it.description,
        quantity: it.quantity,
      });
    }
  }
  return { desired: out, locations };
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
    const inScope = existing.filter((e) =>
      scope === "floor" ? !!e.floorId : !e.floorId,
    );

    const keyOf = (location: string, code: string) => `${location}\u0000${code}`;
    const before = new Map(inScope.map((e) => [keyOf(e.location, e.itemCode), e]));
    const after = new Map(desired.map((d) => [keyOf(d.location, d.itemCode), d]));

    const audits: (typeof inventoryAudit.$inferInsert)[] = [];
    const stamp = {
      unit,
      userId: user.id,
      userName: user.name,
    };

    for (const [key, d] of after) {
      const prev = before.get(key);
      if (!prev) {
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
        audits.push({
          ...stamp,
          action: "added",
          itemCode: d.itemCode,
          description: d.description,
          location: d.location,
          quantity: d.quantity,
        });
      } else if (prev.quantity !== d.quantity || prev.description !== d.description) {
        await tx
          .update(inventoryPlacements)
          .set({
            quantity: d.quantity,
            description: d.description,
            updatedBy: user.id,
            updatedAt: new Date(),
          })
          .where(eq(inventoryPlacements.id, prev.id));
        if (prev.quantity !== d.quantity) {
          audits.push({
            ...stamp,
            action: "qty",
            itemCode: d.itemCode,
            description: d.description,
            location: d.location,
            quantity: d.quantity,
            prevQuantity: prev.quantity,
          });
        }
      }
    }

    const goneIds: string[] = [];
    for (const [key, prev] of before) {
      if (after.has(key)) continue;
      // Only remove items at locations this save actually covered. A location the
      // client never included is left untouched — never wiped.
      if (!scopeLocations.has(prev.location)) continue;
      goneIds.push(prev.id);
      audits.push({
        ...stamp,
        action: "removed",
        itemCode: prev.itemCode,
        description: prev.description,
        location: prev.location,
        quantity: prev.quantity,
      });
    }
    if (goneIds.length) {
      await tx
        .delete(inventoryPlacements)
        .where(inArray(inventoryPlacements.id, goneIds));
    }

    if (audits.length) await tx.insert(inventoryAudit).values(audits);
  });

  revalidatePath("/warehouse");
}

/** window.storage.get(key) */
export async function readWarehouseKey(
  key: string,
): Promise<{ value: string } | null> {
  await requireRole("buyer");

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
  const user = await requireRole("buyer");

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

/** Clears one unit — used by the locator's "reset" button. */
export async function clearWarehouseUnit(unit: WarehouseUnit) {
  const user = await requireRole("buyer");
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
  await requireRole("buyer");
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
