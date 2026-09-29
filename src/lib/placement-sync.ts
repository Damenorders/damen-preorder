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
  /** Box count. */
  quantity?: number;
  /** Loose-unit count. Absent from clients older than the box/unit split. */
  quantityUnit?: number;
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
  /** undefined = the client didn't send one (a page loaded before the
   *  box/unit split): keep whatever unit count is stored. */
  quantityUnit: number | undefined;
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
  quantityUnit: number;
  floorId: string | null;
}

export interface AuditDraft {
  action: "added" | "qty" | "removed";
  itemCode: string;
  description: string;
  location: string;
  quantity: number;
  quantityUnit: number;
  prevQuantity?: number;
  prevQuantityUnit?: number;
}

export interface SyncPlan {
  inserts: Desired[];
  updates: { id: string; quantity: number; quantityUnit: number; description: string }[];
  deleteIds: string[];
  audits: AuditDraft[];
}

/**
 * The stand-in item code a freehand item (typed description, no SKU) is stored
 * under — placements need a code, and a product not yet in the catalog has none.
 */
export function freehandCode(description: string) {
  return description.slice(0, 64);
}

/**
 * The SKU to hand back to the rack-locator for a stored placement. A freehand
 * item goes back with a BLANK sku, never its stand-in code: the counting
 * workflow is "write what isn't in the catalog, export, filter blank SKU, add
 * those to Odoo" — returning the stand-in filled the SKU with the description
 * after the first save, so those rows no longer showed up as blank. Sending the
 * blank back on the next save maps to the same stand-in, so the row is stable.
 */
export function clientSku(itemCode: string, description: string, isCatalogItem: boolean) {
  return !isCatalogItem && itemCode === freehandCode(description) ? "" : itemCode;
}

/** A whole, non-negative count, or undefined when none was sent. */
function count(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : undefined;
}

export function normalise(items: ClientItem[] | undefined) {
  const out: {
    code: string;
    description: string;
    quantity: number;
    quantityUnit: number | undefined;
  }[] = [];
  for (const it of items ?? []) {
    const code = (it.sku ?? "").trim();
    const description = (it.description ?? "").trim();
    if (!code && !description) continue;
    // Items typed freehand (not in the catalog) are keyed by their description
    // so they still get a stable row; the catalog code wins when present.
    out.push({
      code: code || freehandCode(description),
      description,
      quantity: count(it.quantity) ?? 0,
      quantityUnit: count(it.quantityUnit),
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
          quantityUnit: it.quantityUnit,
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
        quantityUnit: it.quantityUnit,
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
  const updates: { id: string; quantity: number; quantityUnit: number; description: string }[] = [];
  const deleteIds: string[] = [];
  const audits: AuditDraft[] = [];

  for (const [key, d] of after) {
    const prev = before.get(key);
    if (!prev) {
      const unit = d.quantityUnit ?? 0;
      inserts.push({ ...d, quantityUnit: unit });
      audits.push({
        action: "added",
        itemCode: d.itemCode,
        description: d.description,
        location: d.location,
        quantity: d.quantity,
        quantityUnit: unit,
      });
      continue;
    }
    const unit = d.quantityUnit ?? prev.quantityUnit;
    const countChanged = prev.quantity !== d.quantity || prev.quantityUnit !== unit;
    if (countChanged || prev.description !== d.description) {
      updates.push({ id: prev.id, quantity: d.quantity, quantityUnit: unit, description: d.description });
      if (countChanged) {
        audits.push({
          action: "qty",
          itemCode: d.itemCode,
          description: d.description,
          location: d.location,
          quantity: d.quantity,
          quantityUnit: unit,
          prevQuantity: prev.quantity,
          prevQuantityUnit: prev.quantityUnit,
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
      quantityUnit: prev.quantityUnit,
    });
  }

  return { inserts, updates, deleteIds, audits };
}
