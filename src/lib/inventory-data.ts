import "server-only";
import { asc, desc, eq, getTableColumns } from "drizzle-orm";
import { db } from "@/db";
import {
  inventoryAudit,
  inventoryItems,
  inventoryPlacements,
  type InventoryItem,
  type WarehouseUnit,
} from "@/db/schema";
import { clientSku } from "@/lib/placement-sync";

/** The shape the rack-locator client expects: {c: code, d: description, s: section}. */
export interface CatalogEntry {
  c: string;
  d: string;
  s: string;
}

export async function getCatalog(): Promise<CatalogEntry[]> {
  const rows = await db
    .select({
      code: inventoryItems.code,
      description: inventoryItems.description,
      section: inventoryItems.section,
    })
    .from(inventoryItems)
    .where(eq(inventoryItems.active, true))
    .orderBy(asc(inventoryItems.description));
  return rows.map((r) => ({ c: r.code, d: r.description, s: r.section }));
}

export async function getItem(code: string): Promise<InventoryItem | undefined> {
  return db.query.inventoryItems.findFirst({
    where: eq(inventoryItems.code, code),
  });
}

/** A unit's placements, each flagged with whether its code is a live catalog item. */
function placementsWithCatalogFlag(unit: WarehouseUnit) {
  return db
    .select({ ...getTableColumns(inventoryPlacements), catalogActive: inventoryItems.active })
    .from(inventoryPlacements)
    .leftJoin(inventoryItems, eq(inventoryItems.code, inventoryPlacements.itemCode))
    .where(eq(inventoryPlacements.unit, unit));
}

/**
 * Rebuilds the rack-locator's `<unit>-rack-data` blob from the database:
 *   { [rackId]: { "B-3": [{ sku, description, quantity }, ...] } }
 */
export async function getRackData(unit: WarehouseUnit) {
  const rows = await placementsWithCatalogFlag(unit);

  const out: Record<
    string,
    Record<string, { sku: string; description: string; quantity: number }[]>
  > = {};
  for (const r of rows) {
    if (r.floorId || r.rack == null || !r.level || !r.position) continue;
    const rack = String(r.rack);
    const code = `${r.level}-${r.position}`;
    out[rack] ??= {};
    out[rack][code] ??= [];
    out[rack][code].push({
      sku: clientSku(r.itemCode, r.description, !!r.catalogActive),
      description: r.description,
      quantity: r.quantity,
    });
  }
  return out;
}

/** Rebuilds the `<unit>-floor-data` blob: { [floorId]: [{ sku, description, quantity }] }. */
export async function getFloorData(unit: WarehouseUnit) {
  const rows = await placementsWithCatalogFlag(unit);

  const out: Record<
    string,
    { sku: string; description: string; quantity: number }[]
  > = {};
  for (const r of rows) {
    if (!r.floorId) continue;
    out[r.floorId] ??= [];
    out[r.floorId].push({
      sku: clientSku(r.itemCode, r.description, !!r.catalogActive),
      description: r.description,
      quantity: r.quantity,
    });
  }
  return out;
}

/** The audit trail, in the shape the client's Activity screen renders. */
export async function getInventoryAudit(limit = 200) {
  const rows = await db
    .select()
    .from(inventoryAudit)
    .orderBy(desc(inventoryAudit.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    t: r.createdAt.getTime(),
    u: r.userName,
    a: r.action,
    sku: r.itemCode ?? "",
    desc: r.description ?? "",
    loc: r.location ?? "",
    from: r.fromLocation ?? "",
    to: r.toLocation ?? "",
    wh: r.unit ?? "",
    qty: r.quantity ?? undefined,
    prevQty: r.prevQuantity ?? undefined,
  }));
}
