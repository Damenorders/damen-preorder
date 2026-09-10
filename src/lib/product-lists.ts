import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  inventoryItems,
  itemPrices,
  productLists,
  productListItems,
  type ProductList,
} from "@/db/schema";
import type { ProductListLine } from "@/lib/product-list-types";

// Product Lists — the buyer walks the warehouse tapping catalog items into a
// list, then exports it to Excel to print for a client. Reads only; every
// mutation lives in src/app/actions/product-lists.ts behind a role check.

export interface ProductListSummary {
  id: number;
  name: string;
  status: ProductList["status"];
  itemCount: number;
  /** Sum of the effective prices; items with no price count as zero. */
  total: number;
  /** How many lines have no price at all, so the UI can say so. */
  unpricedCount: number;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function listProductLists(): Promise<ProductListSummary[]> {
  return db
    .select({
      id: productLists.id,
      name: productLists.name,
      status: productLists.status,
      createdByName: productLists.createdByName,
      createdAt: productLists.createdAt,
      updatedAt: productLists.updatedAt,
      itemCount: sql<number>`count(${productListItems.id})::int`,
      total: sql<number>`coalesce(sum(coalesce(${productListItems.priceOverride}, ${itemPrices.price})), 0)::float8`,
      unpricedCount: sql<number>`count(*) filter (where ${productListItems.id} is not null and ${productListItems.priceOverride} is null and ${itemPrices.price} is null)::int`,
    })
    .from(productLists)
    .leftJoin(productListItems, eq(productListItems.listId, productLists.id))
    .leftJoin(itemPrices, eq(itemPrices.itemCode, productListItems.itemCode))
    .groupBy(productLists.id)
    .orderBy(desc(productLists.updatedAt));
}

export async function getProductList(
  id: number,
): Promise<ProductList | undefined> {
  return db.query.productLists.findFirst({ where: eq(productLists.id, id) });
}

export type { ProductListLine } from "@/lib/product-list-types";

/** List order is the order the buyer walked the warehouse in. */
export async function getProductListItems(
  id: number,
): Promise<ProductListLine[]> {
  const rows = await db
    .select({
      itemCode: productListItems.itemCode,
      // The catalog leads on wording — a price-file upload that corrects a
      // pack size or flags an item shows up on lists built before it. The copy
      // stored on the line is the fallback for an item since dropped from the
      // catalog, so an old sheet never loses its description entirely.
      catalogDescription: inventoryItems.description,
      description: productListItems.description,
      addedByName: productListItems.addedByName,
      priceOverride: productListItems.priceOverride,
      catalogPrice: itemPrices.price,
    })
    .from(productListItems)
    .leftJoin(itemPrices, eq(itemPrices.itemCode, productListItems.itemCode))
    .leftJoin(
      inventoryItems,
      eq(inventoryItems.code, productListItems.itemCode),
    )
    .where(eq(productListItems.listId, id))
    .orderBy(asc(productListItems.createdAt), asc(productListItems.id));

  // numeric columns arrive as strings (same as order weights elsewhere).
  return rows.map((r) => {
    const catalogPrice = r.catalogPrice === null ? null : Number(r.catalogPrice);
    const priceOverride =
      r.priceOverride === null ? null : Number(r.priceOverride);
    return {
      itemCode: r.itemCode,
      description: r.catalogDescription || r.description,
      addedByName: r.addedByName,
      catalogPrice,
      priceOverride,
      price: priceOverride ?? catalogPrice,
    };
  });
}

export interface PriceFileStatus {
  pricedItems: number;
  lastUpdatedAt: Date | null;
  lastFile: string | null;
  lastBy: string | null;
}

/** What the upload screen shows about the price file already loaded. */
export async function getPriceFileStatus(): Promise<PriceFileStatus> {
  const [row] = await db
    .select({
      pricedItems: sql<number>`count(*)::int`,
      lastUpdatedAt: sql<Date | null>`max(${itemPrices.updatedAt})`,
    })
    .from(itemPrices);

  const [latest] = await db
    .select({
      sourceFile: itemPrices.sourceFile,
      updatedByName: itemPrices.updatedByName,
    })
    .from(itemPrices)
    .orderBy(desc(itemPrices.updatedAt))
    .limit(1);

  return {
    pricedItems: row?.pricedItems ?? 0,
    lastUpdatedAt: row?.lastUpdatedAt ?? null,
    lastFile: latest?.sourceFile ?? null,
    lastBy: latest?.updatedByName ?? null,
  };
}
