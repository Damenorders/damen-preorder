"use server";

// Product Lists — buyer/admin only. The buyer walks the warehouse tapping items
// out of the warehouse item catalog; each tap is its own INSERT and each removal
// its own DELETE, so two people building the same list never overwrite each
// other (same rule as the warehouse placements — never rewrite the whole list).

import { revalidatePath } from "next/cache";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  inventoryItems,
  itemPrices,
  productLists,
  productListItems,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { notifyProductListsChanged } from "@/lib/realtime-server";
import { getProductListItems } from "@/lib/product-lists";
import { applyPriceRows, parsePriceFile } from "@/lib/price-import";
// Types live in a separate module: a "use server" file may only export async
// functions, and re-exporting a type from one crashes on module evaluation.
import type {
  CatalogHit,
  CreateProductListResult,
  PriceImportResult,
  ProductListLine,
  ProductListResult,
} from "@/lib/product-list-types";

/** Every entry point sits behind this; admin passes automatically. */
function requireBuyer() {
  return requireRole("buyer");
}

async function touchList(listId: number) {
  await db
    .update(productLists)
    .set({ updatedAt: new Date() })
    .where(eq(productLists.id, listId));
}

/** Refresh the list index, the builder screen, and every other open copy. */
async function announce(listId: number) {
  revalidatePath("/buyer/product-lists");
  revalidatePath(`/buyer/product-lists/${listId}`);
  await notifyProductListsChanged();
}

export async function createProductList(
  name: string,
): Promise<CreateProductListResult> {
  const user = await requireBuyer();
  const trimmed = name?.trim();
  if (!trimmed) return { ok: false, error: "Name the list first." };

  const [created] = await db
    .insert(productLists)
    .values({
      name: trimmed.slice(0, 120),
      createdByUserId: user.id,
      createdByName: user.name,
    })
    .returning({ id: productLists.id });

  await announce(created.id);
  return { ok: true, id: created.id };
}

export async function renameProductList(
  listId: number,
  name: string,
): Promise<ProductListResult> {
  await requireBuyer();
  const trimmed = name?.trim();
  if (!trimmed) return { ok: false, error: "The list needs a name." };

  await db
    .update(productLists)
    .set({ name: trimmed.slice(0, 120), updatedAt: new Date() })
    .where(eq(productLists.id, listId));

  await announce(listId);
  return { ok: true };
}

export async function addProductListItem(
  listId: number,
  itemCode: string,
): Promise<ProductListResult> {
  const user = await requireBuyer();
  const code = itemCode?.trim();
  if (!code) return { ok: false, error: "No item selected." };

  const item = await db.query.inventoryItems.findFirst({
    where: eq(inventoryItems.code, code),
  });
  if (!item) return { ok: false, error: "That item is not in the catalog." };

  // onConflictDoNothing: a double-tap, or two people tapping the same item at
  // once, leaves one line rather than failing or duplicating.
  await db
    .insert(productListItems)
    .values({
      listId,
      itemCode: item.code,
      description: item.description,
      addedByUserId: user.id,
      addedByName: user.name,
    })
    .onConflictDoNothing();

  await touchList(listId);
  await announce(listId);
  return { ok: true };
}

export async function removeProductListItem(
  listId: number,
  itemCode: string,
): Promise<ProductListResult> {
  await requireBuyer();

  await db
    .delete(productListItems)
    .where(
      and(
        eq(productListItems.listId, listId),
        eq(productListItems.itemCode, itemCode),
      ),
    );

  await touchList(listId);
  await announce(listId);
  return { ok: true };
}

/** The Save button: files an in-progress list under Current Product Lists. */
export async function saveProductList(
  listId: number,
  name?: string,
): Promise<ProductListResult> {
  await requireBuyer();
  const trimmed = name?.trim();

  const [count] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(productListItems)
    .where(eq(productListItems.listId, listId));
  if (!count || count.n === 0) {
    return { ok: false, error: "Add at least one item before saving." };
  }

  await db
    .update(productLists)
    .set({
      status: "saved",
      updatedAt: new Date(),
      ...(trimmed ? { name: trimmed.slice(0, 120) } : {}),
    })
    .where(eq(productLists.id, listId));

  await announce(listId);
  return { ok: true };
}

export async function deleteProductList(
  listId: number,
): Promise<ProductListResult> {
  await requireBuyer();
  // Items go with it (on delete cascade).
  await db.delete(productLists).where(eq(productLists.id, listId));
  await announce(listId);
  return { ok: true };
}

/**
 * Catalog search for the item picker. Runs on the server so the phone never
 * downloads the whole catalog, and so a live refresh (another user's tap)
 * doesn't drag thousands of rows back down with it.
 */
export async function searchCatalog(query: string): Promise<CatalogHit[]> {
  await requireBuyer();
  const q = query?.trim();
  if (!q || q.length < 2) return [];

  const like = `%${q.replace(/[%_]/g, (c) => `\\${c}`)}%`;
  const rows = await db
    .select({
      code: inventoryItems.code,
      description: inventoryItems.description,
      price: itemPrices.price,
    })
    .from(inventoryItems)
    .leftJoin(itemPrices, eq(itemPrices.itemCode, inventoryItems.code))
    .where(
      and(
        eq(inventoryItems.active, true),
        or(
          ilike(inventoryItems.description, like),
          ilike(inventoryItems.code, like),
        ),
      ),
    )
    // Items whose description starts with the query come first — typing
    // "toma" should surface "Tomatoes" ahead of "Sun-dried tomato paste".
    .orderBy(
      sql`case when ${inventoryItems.description} ilike ${q + "%"} then 0 else 1 end`,
      asc(inventoryItems.description),
    )
    .limit(40);

  return rows.map((r) => ({
    code: r.code,
    description: r.description,
    price: r.price === null ? null : Number(r.price),
  }));
}

/** Sets (or clears, with null) the price on one line of one list. */
export async function setProductListItemPrice(
  listId: number,
  itemCode: string,
  price: number | null,
): Promise<ProductListResult> {
  await requireBuyer();

  if (price !== null && (!Number.isFinite(price) || price < 0)) {
    return { ok: false, error: "Enter a price like 12.50, or clear the box." };
  }

  await db
    .update(productListItems)
    .set({ priceOverride: price === null ? null : price.toFixed(4) })
    .where(
      and(
        eq(productListItems.listId, listId),
        eq(productListItems.itemCode, itemCode),
      ),
    );

  await touchList(listId);
  await announce(listId);
  return { ok: true };
}

/**
 * Loads an uploaded price file (SKU, Product, Price) as .xlsx or .csv.
 * Prices replace whatever was there for that SKU; a SKU the catalog doesn't
 * have yet is added so it becomes searchable. Per-line overrides a buyer typed
 * on a list are left alone — that is the point of an override.
 */
export async function importPrices(
  formData: FormData,
): Promise<PriceImportResult> {
  const user = await requireBuyer();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a price file first." };
  }
  if (file.size > 10 * 1024 * 1024) {
    return {
      ok: false,
      error: "That file is over 10 MB — export it again as .xlsx or .csv.",
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parsePriceFile(buffer, file.name);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const { pricesSet, itemsCreated } = await applyPriceRows(parsed.rows, {
    userId: user.id,
    userName: user.name,
    sourceFile: file.name,
  });

  // Every list's printed price may have moved.
  revalidatePath("/buyer/product-lists");
  await notifyProductListsChanged();

  return {
    ok: true,
    report: {
      fileName: file.name,
      pricesSet,
      itemsCreated,
      skipped: parsed.skipped,
    },
  };
}

/** Read-only lines for the View panel on Current Product Lists. */
export async function getProductListLines(
  listId: number,
): Promise<ProductListLine[]> {
  await requireBuyer();
  return getProductListItems(listId);
}
