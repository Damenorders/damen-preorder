import "server-only";
import { and, asc, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  inventoryItems,
  itemPrices,
  itemSourcing,
  purchaseOrderLines,
  purchaseOrders,
  suppliers,
} from "@/db/schema";
import {
  normalizeName,
  queryWords,
  type CatalogEntry,
  type SupplierBlock,
  type SupplierProduct,
} from "@/lib/order-book-core";
import type {
  OrderView,
  PurchaseHit,
  SupplierOption,
} from "@/lib/purchase-order-types";

// Purchase Orders — reads only. Every mutation lives in
// src/app/actions/purchase-orders.ts behind a role check.

type Executor = Pick<typeof db, "select">;

/** normalizeName, in SQL: uppercase, non-alphanumeric runs -> one space. */
export function normalizedSql(value: SQL | typeof inventoryItems.description) {
  return sql<string>`btrim(regexp_replace(upper(${value}), '[^A-Z0-9]+', ' ', 'g'))`;
}

const hitColumns = {
  code: inventoryItems.code,
  name: inventoryItems.description,
  pack: itemSourcing.purchasePack,
  unit: itemSourcing.purchaseUnit,
  supplierId: itemSourcing.supplierId,
  supplierName: suppliers.name,
};

/** Catalogue products joined to their preferred sourcing and its supplier. */
function hitQuery(executor: Executor = db) {
  return executor
    .select(hitColumns)
    .from(inventoryItems)
    .leftJoin(
      itemSourcing,
      and(
        eq(itemSourcing.itemCode, inventoryItems.code),
        eq(itemSourcing.preferred, true),
      ),
    )
    .leftJoin(suppliers, eq(suppliers.id, itemSourcing.supplierId));
}

type HitRow = {
  code: string;
  name: string;
  pack: string | null;
  unit: PurchaseHit["unit"];
  supplierId: number | null;
  supplierName: string | null;
};

function toHit(r: HitRow): PurchaseHit {
  return {
    code: r.code,
    name: r.name,
    pack: r.pack,
    unit: r.unit,
    supplierId: r.supplierId,
    supplierName: r.supplierName,
  };
}

export function hitToEntry(h: PurchaseHit): CatalogEntry {
  return {
    code: h.code,
    name: h.name,
    sourcing:
      h.supplierId !== null && h.pack !== null && h.unit !== null
        ? {
            supplierId: h.supplierId,
            supplierName: h.supplierName ?? "",
            supplierSku: "",
            purchasePack: h.pack,
            purchaseUnit: h.unit,
          }
        : null,
  };
}

/**
 * Typeahead: every typed word must appear, in any order, in the product's
 * code, name, purchase pack or supplier name — all compared normalised.
 */
export async function searchPurchaseHits(query: string): Promise<PurchaseHit[]> {
  const words = queryWords(query);
  if (words.length === 0) return [];

  const haystack = normalizedSql(
    sql`${inventoryItems.code} || ' ' || ${inventoryItems.description} || ' ' || coalesce(${itemSourcing.purchasePack}, '') || ' ' || coalesce(${suppliers.name}, '')`,
  );
  const first = normalizeName(query);
  const rows = await hitQuery()
    .where(
      and(
        eq(inventoryItems.active, true),
        // Words are [A-Z0-9] only after normalising, so nothing to escape.
        ...words.map((w) => sql`${haystack} like ${`%${w}%`}`),
      ),
    )
    .orderBy(
      sql`case when ${normalizedSql(inventoryItems.description)} like ${`${first}%`} then 0 else 1 end`,
      asc(inventoryItems.description),
    )
    .limit(40);
  return rows.map(toHit);
}

export async function getPurchaseHit(
  code: string,
  executor: Executor = db,
): Promise<PurchaseHit | null> {
  const [row] = await hitQuery(executor)
    .where(eq(inventoryItems.code, code))
    .limit(1);
  return row ? toHit(row) : null;
}

/**
 * The only catalogue rows that can matter to a typed name: exact matches
 * (by normalised name or by code), and anything sharing a significant word —
 * the pure resolver then decides between exact, similar and none.
 */
export async function resolutionCandidates(
  typed: string,
  opts: { activeOnly?: boolean } = {},
): Promise<PurchaseHit[]> {
  const key = normalizeName(typed);
  if (!key) return [];
  const code = typed.trim().toUpperCase();
  const words = [...new Set(key.split(" ").filter((w) => w.length > 2))];
  const name = normalizedSql(inventoryItems.description);

  const rows = await hitQuery()
    .where(
      and(
        opts.activeOnly === false ? undefined : eq(inventoryItems.active, true),
        or(
          sql`${name} = ${key}`,
          sql`upper(${inventoryItems.code}) = ${code}`,
          ...words.map((w) => sql`(' ' || ${name} || ' ') like ${`% ${w} %`}`),
        ),
      ),
    )
    .orderBy(asc(inventoryItems.description))
    .limit(1000);
  return rows.map(toHit);
}

export async function listSupplierOptions(): Promise<SupplierOption[]> {
  return db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      contact: suppliers.contact,
      email: suppliers.email,
    })
    .from(suppliers)
    .where(eq(suppliers.active, true))
    .orderBy(asc(suppliers.name));
}

/** Existing catalogue sections, for the create-product form. */
export async function listCatalogSections(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ section: inventoryItems.section })
    .from(inventoryItems)
    .orderBy(asc(inventoryItems.section));
  return rows.map((r) => r.section).filter(Boolean);
}

async function loadOrders(where: SQL, limit: number): Promise<OrderView[]> {
  const orders = await db
    .select({
      id: purchaseOrders.id,
      supplierId: purchaseOrders.supplierId,
      supplierName: suppliers.name,
      contact: suppliers.contact,
      email: suppliers.email,
      status: purchaseOrders.status,
      method: purchaseOrders.method,
      wantedFor: purchaseOrders.wantedFor,
      orderedOn: sql<
        string | null
      >`to_char(${purchaseOrders.orderedOn} at time zone 'America/Montreal', 'YYYY-MM-DD')`,
      orderedByName: purchaseOrders.orderedByName,
    })
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
    .where(where)
    .orderBy(desc(purchaseOrders.orderedOn), asc(suppliers.name))
    .limit(limit);
  if (orders.length === 0) return [];

  const lines = await db
    .select()
    .from(purchaseOrderLines)
    .where(
      inArray(
        purchaseOrderLines.orderId,
        orders.map((o) => o.id),
      ),
    )
    .orderBy(asc(purchaseOrderLines.createdAt), asc(purchaseOrderLines.id));

  return orders.map((o) => ({
    ...o,
    wantedFor: o.wantedFor ?? "",
    lines: lines
      .filter((l) => l.orderId === o.id)
      .map((l) => ({
        id: l.id,
        itemCode: l.itemCode,
        // numeric columns arrive as strings (same as order weights elsewhere).
        qty: Number(l.qty),
        unit: l.unit,
        nameAtTime: l.nameAtTime,
        packAtTime: l.packAtTime,
        addedByName: l.addedByName,
      })),
  }));
}

/** Every supplier's next order that has at least one line. */
export async function getOpenOrders(): Promise<OrderView[]> {
  const open = await loadOrders(eq(purchaseOrders.status, "open"), 500);
  return open.filter((o) => o.lines.length > 0);
}

/** History, newest first. */
export async function getOrderHistory(limit = 100): Promise<OrderView[]> {
  return loadOrders(eq(purchaseOrders.status, "ordered"), limit);
}

// ---------------------------------------------------------------------------
// Suppliers view
// ---------------------------------------------------------------------------

type Reader = Pick<typeof db, "select">;

/** Every product bought from the given suppliers (or all of them). */
export async function getSupplierProducts(
  supplierId?: number,
  executor: Reader = db,
): Promise<Array<SupplierProduct & { supplierId: number }>> {
  const rows = await executor
    .select({
      sourcingId: itemSourcing.id,
      supplierId: itemSourcing.supplierId,
      code: itemSourcing.itemCode,
      name: inventoryItems.description,
      pack: itemSourcing.purchasePack,
      unit: itemSourcing.purchaseUnit,
      cost: itemSourcing.cost,
      sell: itemSourcing.sell,
      costSetOn: itemSourcing.costSetOn,
      preferred: itemSourcing.preferred,
      priced: itemPrices.itemCode,
    })
    .from(itemSourcing)
    .innerJoin(inventoryItems, eq(inventoryItems.code, itemSourcing.itemCode))
    .leftJoin(itemPrices, eq(itemPrices.itemCode, itemSourcing.itemCode))
    .where(
      supplierId === undefined
        ? undefined
        : eq(itemSourcing.supplierId, supplierId),
    )
    .orderBy(asc(inventoryItems.description), asc(itemSourcing.purchasePack));

  // numeric columns arrive as strings.
  return rows.map(({ priced, cost, sell, ...r }) => ({
    ...r,
    cost: cost === null ? null : Number(cost),
    sell: sell === null ? null : Number(sell),
    inPriceFile: priced !== null,
  }));
}

/** The Suppliers tab: every active supplier with what we buy from it. */
export async function getSupplierBlocks(): Promise<SupplierBlock[]> {
  const [list, products] = await Promise.all([
    db
      .select({
        id: suppliers.id,
        name: suppliers.name,
        contact: suppliers.contact,
        email: suppliers.email,
      })
      .from(suppliers)
      .where(eq(suppliers.active, true))
      .orderBy(sql`lower(${suppliers.name})`),
    getSupplierProducts(),
  ]);
  return list.map((s) => ({
    ...s,
    products: products.filter((p) => p.supplierId === s.id),
  }));
}

/** Other catalogue products whose name normalises to the given one. */
export async function catalogueNamesMatching(
  name: string,
  executor: Reader = db,
): Promise<Array<{ code: string; name: string }>> {
  const key = normalizeName(name);
  if (!key) return [];
  return executor
    .select({ code: inventoryItems.code, name: inventoryItems.description })
    .from(inventoryItems)
    .where(sql`${normalizedSql(inventoryItems.description)} = ${key}`)
    .limit(10);
}
