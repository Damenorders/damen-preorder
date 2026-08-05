/**
 * Pure warehouse-inventory sync logic — no database, no server-only imports, so
 * it can be unit-tested in isolation. This is the exact code path that once
 * caused pallets to vanish, so it is the part most worth locking down with
 * tests. The DB I/O lives in src/app/actions/inventory.ts, which turns a
 * client blob into `Desired[]` here and then applies the plan `planSync`
 * returns inside one transaction.
 */

export interface ClientItem {
  sku?: string;
  description?: string;
  quantity?: number;
}

export type RackBlob = Record<string, Record<string, ClientItem[]>>;
export type FloorBlob = Record<string, ClientItem[]>;

export interface Desired {
  location: string;
  rack: number | null;
  level: string | null;
  position: string | null;
  floorId: string | null;
  itemCode: string;
  description: string;
  quantity: number;
}

export interface DesiredBlob {
  desired: Desired[];
  /** Every location the client's payload included — the ONLY locations a save
   *  is allowed to delete from, so it can never wipe a location it never saw. */
  locations: Set<string>;
}

/** The subset of an inventory_placements row that planSync needs. */
export interface ExistingPlacement {
  id: string;
  location: string;
  itemCode: string;
  description: string;
  quantity: number;
  floorId: string | null;
}

export interface AuditDraft {
  action: "added" | "qty" | "removed";
  itemCode: string;
  description: string;
  location: string;
  quantity: number;
  prevQuantity?: number;
}

export interface SyncPlan {
  inserts: Desired[];
  updates: { id: string; quantity: number; description: string }[];
  deleteIds: string[];
  audits: AuditDraft[];
}

export function normalise(items: ClientItem[] | undefined) {
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

export function desiredFromRackBlob(blob: RackBlob): DesiredBlob {
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

export function desiredFromFloorBlob(blob: FloorBlob): DesiredBlob {
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

/**
 * Given the placements that currently exist for a unit, computes what to
 * insert / update / delete so the DB matches `desired` — but ONLY within
 * `scopeLocations`. A placement at any location the client did not send is left
 * untouched, so one user's save can never delete another user's items
 * elsewhere. Rack and floor placements are handled separately (`scope`).
 */
export function planSync(
  existing: ExistingPlacement[],
  scope: "rack" | "floor",
  desired: Desired[],
  scopeLocations: Set<string>,
): SyncPlan {
  const inScope = existing.filter((e) =>
    scope === "floor" ? !!e.floorId : !e.floorId,
  );

  const keyOf = (location: string, code: string) => JSON.stringify([location, code]);
  const before = new Map(inScope.map((e) => [keyOf(e.location, e.itemCode), e]));
  const after = new Map(desired.map((d) => [keyOf(d.location, d.itemCode), d]));

  const inserts: Desired[] = [];
  const updates: { id: string; quantity: number; description: string }[] = [];
  const deleteIds: string[] = [];
  const audits: AuditDraft[] = [];

  for (const [key, d] of after) {
    const prev = before.get(key);
    if (!prev) {
      inserts.push(d);
      audits.push({
        action: "added",
        itemCode: d.itemCode,
        description: d.description,
        location: d.location,
        quantity: d.quantity,
      });
    } else if (prev.quantity !== d.quantity || prev.description !== d.description) {
      updates.push({ id: prev.id, quantity: d.quantity, description: d.description });
      if (prev.quantity !== d.quantity) {
        audits.push({
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

  for (const [key, prev] of before) {
    if (after.has(key)) continue;
    // Only remove items at locations this save actually covered. A location the
    // client never included is left untouched — never wiped.
    if (!scopeLocations.has(prev.location)) continue;
    deleteIds.push(prev.id);
    audits.push({
      action: "removed",
      itemCode: prev.itemCode,
      description: prev.description,
      location: prev.location,
      quantity: prev.quantity,
    });
  }

  return { inserts, updates, deleteIds, audits };
}
