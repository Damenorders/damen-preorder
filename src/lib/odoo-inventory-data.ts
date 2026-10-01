import "server-only";
import { asc, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  odooAudit,
  odooItems,
  odooPlacements,
  users,
  type OdooWarehouseUnit,
} from "@/db/schema";
import { ODOO_UNITS, ODOO_UNIT_LABELS, displayLocation } from "@/lib/odoo-locations";

// Reads for the Odoo Inventory. Only ever the odoo_* tables.

/**
 * The shape the odoo-locator client expects: {c: SKU, d: description,
 * s: section (unused, blank), x: 1 when the SKU is no longer in the Odoo list}.
 * Products that dropped out of the list still come down so a pallet holding
 * one can be opened and saved; the client never offers them as suggestions.
 */
export interface OdooCatalogEntry {
  c: string;
  d: string;
  s: string;
  x?: 1;
}

export async function getOdooCatalog(): Promise<OdooCatalogEntry[]> {
  const rows = await db
    .select({ sku: odooItems.sku, description: odooItems.description, active: odooItems.active })
    .from(odooItems)
    .orderBy(asc(odooItems.description));
  return rows.map((r) => (r.active ? { c: r.sku, d: r.description, s: "" } : { c: r.sku, d: r.description, s: "", x: 1 }));
}

/** A unit's placements; a SKU'd row takes its description from the list, so a re-upload's wording shows. */
function placementsFor(unit: OdooWarehouseUnit) {
  return db
    .select({ ...getTableColumns(odooPlacements), catalogDescription: odooItems.description })
    .from(odooPlacements)
    .leftJoin(odooItems, eq(odooItems.sku, odooPlacements.sku))
    .where(eq(odooPlacements.unit, unit));
}

type ClientRow = {
  sku: string;
  description: string;
  quantity: number;
  quantityUnit: number;
  consignment: boolean;
};

function clientRow(r: Awaited<ReturnType<typeof placementsFor>>[number]): ClientRow {
  return {
    sku: r.sku ?? "",
    description: r.sku ? (r.catalogDescription ?? r.description) : r.description,
    quantity: r.quantity,
    quantityUnit: r.quantityUnit,
    consignment: r.consignment,
  };
}

/** `<unit>-rack-data`: { [rackId]: { "B-3": [{ sku, description, quantity, quantityUnit, consignment }] } } */
export async function getOdooRackData(unit: OdooWarehouseUnit) {
  const rows = await placementsFor(unit);
  const out: Record<string, Record<string, ClientRow[]>> = {};
  for (const r of rows) {
    if (r.floorId || r.rack == null || !r.level || !r.position) continue;
    const rack = String(r.rack);
    const code = `${r.level}-${r.position}`;
    out[rack] ??= {};
    out[rack][code] ??= [];
    out[rack][code].push(clientRow(r));
  }
  return out;
}

/** `<unit>-floor-data`: { [floorId]: [{ sku, description, quantity, quantityUnit, consignment }] } */
export async function getOdooFloorData(unit: OdooWarehouseUnit) {
  const rows = await placementsFor(unit);
  const out: Record<string, ClientRow[]> = {};
  for (const r of rows) {
    if (!r.floorId) continue;
    out[r.floorId] ??= [];
    out[r.floorId].push(clientRow(r));
  }
  return out;
}

/** The audit trail, in the shape the client's Activity screen renders. */
export async function getOdooAudit(limit = 200) {
  const rows = await db.select().from(odooAudit).orderBy(desc(odooAudit.createdAt)).limit(limit);
  return rows.map((r) => ({
    t: r.createdAt.getTime(),
    u: r.userName,
    a: r.action,
    sku: r.sku ?? "",
    desc: r.description ?? "",
    loc: r.location ? (r.unit ? displayLocation(r.unit, r.location) : r.location) : "",
    from: r.fromLocation ?? "",
    to: r.toLocation ?? "",
    wh: r.unit ? ODOO_UNIT_LABELS[r.unit] : "",
    qty: r.quantity ?? undefined,
    prevQty: r.prevQuantity ?? undefined,
    qtyUnit: r.quantityUnit ?? undefined,
    prevQtyUnit: r.prevQuantityUnit ?? undefined,
    cons: r.consignment ?? undefined,
  }));
}

export interface OdooExportRow {
  location: string;
  area: string;
  sku: string;
  description: string;
  boxes: number;
  units: number;
  consignment: boolean;
  /** "Yes", "No" (typed, not in the list) or "No longer in list". */
  inOdoo: string;
  countedBy: string;
  updatedAt: Date;
}

/** Every counted product, one row per product per location, in warehouse order. */
export async function getOdooExportRows(unit?: OdooWarehouseUnit): Promise<OdooExportRow[]> {
  const base = db
    .select({
      unit: odooPlacements.unit,
      location: odooPlacements.location,
      sku: odooPlacements.sku,
      description: odooPlacements.description,
      quantity: odooPlacements.quantity,
      quantityUnit: odooPlacements.quantityUnit,
      consignment: odooPlacements.consignment,
      updatedAt: odooPlacements.updatedAt,
      catalogDescription: odooItems.description,
      catalogActive: odooItems.active,
      userName: users.name,
    })
    .from(odooPlacements)
    .leftJoin(odooItems, eq(odooItems.sku, odooPlacements.sku))
    .leftJoin(users, eq(users.id, odooPlacements.updatedBy));
  const rows = unit ? await base.where(eq(odooPlacements.unit, unit)) : await base;

  const out = rows.map((r) => ({
    // Sort keys: area in map order, rack slots before floor areas.
    unitOrder: ODOO_UNITS.indexOf(r.unit),
    isFloor: r.location.startsWith("floor:"),
    row: {
      location: displayLocation(r.unit, r.location),
      area: ODOO_UNIT_LABELS[r.unit],
      sku: r.sku ?? "",
      description: r.sku ? (r.catalogDescription ?? r.description) : r.description,
      boxes: r.quantity,
      units: r.quantityUnit,
      consignment: r.consignment,
      inOdoo: !r.sku ? "No" : r.catalogActive ? "Yes" : "No longer in list",
      countedBy: r.userName ?? "",
      updatedAt: r.updatedAt,
    },
  }));
  out.sort(
    (a, b) =>
      a.unitOrder - b.unitOrder ||
      Number(a.isFloor) - Number(b.isFloor) ||
      a.row.location.localeCompare(b.row.location, undefined, { numeric: true }) ||
      a.row.description.localeCompare(b.row.description),
  );
  return out.map((o) => o.row);
}

/** What the upload page shows: list size, and the last upload. */
export async function getOdooCatalogStatus() {
  const [counts] = await db
    .select({
      active: sql<number>`count(*) filter (where ${odooItems.active})::int`,
      retired: sql<number>`count(*) filter (where not ${odooItems.active})::int`,
    })
    .from(odooItems);
  const [last] = await db
    .select({ description: odooAudit.description, userName: odooAudit.userName, createdAt: odooAudit.createdAt })
    .from(odooAudit)
    .where(eq(odooAudit.action, "catalog"))
    .orderBy(desc(odooAudit.createdAt))
    .limit(1);
  return {
    active: counts?.active ?? 0,
    retired: counts?.retired ?? 0,
    lastUpload: last ?? null,
  };
}
