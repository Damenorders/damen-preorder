/**
 * Pure Odoo Inventory sync logic — no database, no server-only imports, so it
 * can be unit-tested. The Odoo copy of src/lib/placement-sync.ts, with three
 * differences:
 *
 *  - a product not in the Odoo list is stored with NO SKU (sku = null), keyed
 *    by its typed description; a SKU that is not in the Odoo list is refused,
 *    never registered as a new product;
 *  - the same product twice at one location is refused instead of one row
 *    silently overwriting the other's count;
 *  - every row carries a consignment flag.
 *
 * Saves stay location-scoped exactly like the Warehouse Inventory: a save can
 * only delete rows at the locations it sent, never anyone else's.
 */

export interface OdooClientItem {
  sku?: string;
  description?: string;
  /** Box count. */
  quantity?: number;
  /** Loose-unit count. */
  quantityUnit?: number;
  consignment?: boolean;
}

export type OdooRackBlob = Record<string, Record<string, OdooClientItem[]>>;
export type OdooFloorBlob = Record<string, OdooClientItem[]>;

/** A catalogue product as the sync needs it: canonical SKU and description. */
export interface OdooCatalogProduct {
  sku: string;
  description: string;
}
export type ResolveSku = (sku: string) => OdooCatalogProduct | null;

export interface OdooDesired {
  location: string;
  rack: number | null;
  level: string | null;
  position: string | null;
  floorId: string | null;
  itemKey: string;
  sku: string | null;
  description: string;
  quantity: number;
  quantityUnit: number;
  consignment: boolean;
}

export type OdooDesiredResult =
  | { ok: true; desired: OdooDesired[]; locations: Set<string> }
  | { ok: false; error: string };

export interface OdooExistingPlacement {
  id: string;
  location: string;
  itemKey: string;
  sku: string | null;
  description: string;
  quantity: number;
  quantityUnit: number;
  consignment: boolean;
  floorId: string | null;
}

export interface OdooAuditDraft {
  action: "added" | "qty" | "removed" | "consignment";
  sku: string | null;
  description: string;
  location: string;
  quantity: number;
  quantityUnit: number;
  prevQuantity?: number;
  prevQuantityUnit?: number;
  consignment: boolean;
}

export interface OdooSyncPlan {
  inserts: OdooDesired[];
  updates: {
    id: string;
    quantity: number;
    quantityUnit: number;
    description: string;
    consignment: boolean;
  }[];
  deleteIds: string[];
  audits: OdooAuditDraft[];
}

/** Description folded for comparison: case and repeated spaces ignored. */
function foldDescription(description: string) {
  return description.trim().replace(/\s+/g, " ").toUpperCase();
}

/** The unique key of a row at its location: the SKU, or "~" + description. */
export function itemKeyFor(sku: string | null, description: string) {
  return sku ? sku : "~" + foldDescription(description);
}

/** A whole, non-negative count; anything missing or unreadable is 0. */
function count(v: unknown): number {
  if (v === undefined || v === null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

type NormalisedItem = Omit<OdooDesired, "location" | "rack" | "level" | "position" | "floorId">;

/**
 * Validates one location's items: every SKU must be in the Odoo list (it is
 * replaced by the list's own spelling and description), a row with no SKU
 * keeps its typed description, and a product may appear only once.
 */
export function normaliseOdoo(
  items: OdooClientItem[] | undefined,
  resolveSku: ResolveSku,
  locationLabel: string,
): { ok: true; items: NormalisedItem[] } | { ok: false; error: string } {
  const out: NormalisedItem[] = [];
  const seen = new Set<string>();
  for (const it of items ?? []) {
    const typedSku = String(it.sku ?? "").trim();
    const typedDescription = String(it.description ?? "").trim();
    if (!typedSku && !typedDescription) continue;

    let sku: string | null = null;
    let description = typedDescription;
    if (typedSku) {
      const product = resolveSku(typedSku);
      if (!product) {
        return {
          ok: false,
          error: `SKU ${typedSku} is not in the Odoo list (${locationLabel}). Pick the product from the list, or clear the SKU to save it as "Not in Odoo".`,
        };
      }
      sku = product.sku;
      description = product.description;
    }

    const itemKey = itemKeyFor(sku, description);
    if (seen.has(itemKey)) {
      return {
        ok: false,
        error: `${description || sku} is listed twice at ${locationLabel}. Put its whole count on one line.`,
      };
    }
    seen.add(itemKey);

    out.push({
      itemKey,
      sku,
      description,
      quantity: count(it.quantity),
      quantityUnit: count(it.quantityUnit),
      consignment: it.consignment === true,
    });
  }
  return { ok: true, items: out };
}

export function desiredFromOdooRackBlob(
  blob: OdooRackBlob,
  resolveSku: ResolveSku,
): OdooDesiredResult {
  const desired: OdooDesired[] = [];
  const locations = new Set<string>();
  for (const [rackId, slots] of Object.entries(blob ?? {})) {
    for (const [slotCode, items] of Object.entries(slots ?? {})) {
      const [level, position] = slotCode.split("-");
      const location = `${rackId}-${level}-${position}`;
      locations.add(location);
      const norm = normaliseOdoo(items, resolveSku, location);
      if (!norm.ok) return norm;
      for (const it of norm.items) {
        desired.push({
          location,
          rack: Number.parseInt(rackId, 10) || null,
          level,
          position,
          floorId: null,
          ...it,
        });
      }
    }
  }
  return { ok: true, desired, locations };
}

export function desiredFromOdooFloorBlob(
  blob: OdooFloorBlob,
  resolveSku: ResolveSku,
): OdooDesiredResult {
  const desired: OdooDesired[] = [];
  const locations = new Set<string>();
  for (const [floorId, items] of Object.entries(blob ?? {})) {
    const location = `floor:${floorId}`;
    locations.add(location);
    const norm = normaliseOdoo(items, resolveSku, location);
    if (!norm.ok) return norm;
    for (const it of norm.items) {
      desired.push({
        location,
        rack: null,
        level: null,
        position: null,
        floorId,
        ...it,
      });
    }
  }
  return { ok: true, desired, locations };
}

/**
 * What to insert / update / delete so the database matches `desired` — but
 * ONLY within `scopeLocations`. A row at any location the client did not send
 * is left untouched. Rack and floor rows are handled separately (`scope`).
 */
export function planOdooSync(
  existing: OdooExistingPlacement[],
  scope: "rack" | "floor",
  desired: OdooDesired[],
  scopeLocations: Set<string>,
): OdooSyncPlan {
  const inScope = existing.filter((e) => (scope === "floor" ? !!e.floorId : !e.floorId));

  const keyOf = (location: string, itemKey: string) => JSON.stringify([location, itemKey]);
  const before = new Map(inScope.map((e) => [keyOf(e.location, e.itemKey), e]));
  const after = new Map(desired.map((d) => [keyOf(d.location, d.itemKey), d]));

  const plan: OdooSyncPlan = { inserts: [], updates: [], deleteIds: [], audits: [] };

  for (const [key, d] of after) {
    const prev = before.get(key);
    const base = {
      sku: d.sku,
      description: d.description,
      location: d.location,
      quantity: d.quantity,
      quantityUnit: d.quantityUnit,
      consignment: d.consignment,
    };
    if (!prev) {
      plan.inserts.push(d);
      plan.audits.push({ action: "added", ...base });
      continue;
    }
    const countChanged = prev.quantity !== d.quantity || prev.quantityUnit !== d.quantityUnit;
    const consignmentChanged = prev.consignment !== d.consignment;
    if (countChanged || consignmentChanged || prev.description !== d.description) {
      plan.updates.push({
        id: prev.id,
        quantity: d.quantity,
        quantityUnit: d.quantityUnit,
        description: d.description,
        consignment: d.consignment,
      });
    }
    if (countChanged) {
      plan.audits.push({
        action: "qty",
        ...base,
        prevQuantity: prev.quantity,
        prevQuantityUnit: prev.quantityUnit,
      });
    }
    if (consignmentChanged) plan.audits.push({ action: "consignment", ...base });
  }

  for (const [key, prev] of before) {
    if (after.has(key)) continue;
    // Only remove rows at locations this save actually covered.
    if (!scopeLocations.has(prev.location)) continue;
    plan.deleteIds.push(prev.id);
    plan.audits.push({
      action: "removed",
      sku: prev.sku,
      description: prev.description,
      location: prev.location,
      quantity: prev.quantity,
      quantityUnit: prev.quantityUnit,
      consignment: prev.consignment,
    });
  }

  return plan;
}

/** An audit draft tagged with the area it happened in. */
export type OdooUnitAuditDraft = OdooAuditDraft & { unit: string };

/** An audit row ready to insert: a plain change, or a move between two locations. */
export type OdooAuditRow =
  | (OdooUnitAuditDraft & { fromLocation?: undefined; toLocation?: undefined })
  | {
      action: "moved";
      unit: string;
      sku: string | null;
      description: string;
      location?: undefined;
      fromLocation: string;
      toLocation: string;
      quantity: number;
      quantityUnit: number;
      consignment: boolean;
    };

/**
 * A move is saved as two location writes, which on their own read as
 * "removed" at the source and "added" at the target. This pairs them back up:
 * the same product leaving one location and arriving at another becomes one
 * "moved" row (from → to, with the count it arrived with). Anything that
 * doesn't pair — a real removal, a count change — is kept as it was.
 * `label` names a location for the log.
 */
export function pairMoves(
  audits: OdooUnitAuditDraft[],
  label: (unit: string, location: string) => string,
): OdooAuditRow[] {
  const keyOf = (a: OdooUnitAuditDraft) => itemKeyFor(a.sku, a.description);
  const used = new Set<OdooUnitAuditDraft>();
  const out: OdooAuditRow[] = [];
  for (const removed of audits) {
    if (removed.action !== "removed") continue;
    const added = audits.find(
      (a) =>
        a.action === "added" &&
        !used.has(a) &&
        keyOf(a) === keyOf(removed) &&
        (a.unit !== removed.unit || a.location !== removed.location),
    );
    if (!added) continue;
    used.add(added);
    used.add(removed);
    out.push({
      action: "moved",
      unit: added.unit,
      sku: added.sku,
      description: added.description,
      fromLocation: label(removed.unit, removed.location),
      toLocation: label(added.unit, added.location),
      quantity: added.quantity,
      quantityUnit: added.quantityUnit,
      consignment: added.consignment,
    });
  }
  for (const a of audits) if (!used.has(a)) out.push(a);
  return out;
}
