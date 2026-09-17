"use server";

// Purchase Orders — buyer/admin only (the same gate as the other catalogue
// edits: price uploads and Product Lists). The buyer types a product from the
// sales catalogue and the line lands on that product's supplier's open order.
//
// Concurrency: several buyers work this at once, so nothing here rewrites an
// order wholesale. A line is one upsert that adds to the existing quantity; the
// database allows one open order per supplier and one preferred supplier per
// product; per-supplier advisory locks keep "open a new order" and "undo into
// the open order" from racing each other.

import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  inventoryItems,
  itemSourcing,
  itemSourcingCostHistory,
  purchaseOrderLines,
  purchaseOrders,
  suppliers,
  type Supplier,
  type User,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { insertSupplier } from "@/lib/suppliers";
import {
  notifyProductListsChanged,
  notifyPurchaseOrdersChanged,
} from "@/lib/realtime-server";
import { syncCatalogWording } from "@/lib/price-import";
import {
  applyCostChange,
  checkLineInput,
  checkPrice,
  checkProductEdit,
  checkSourcingInput,
  checkSupplierEdit,
  isPurchaseMethod,
  isPurchaseUnit,
  looksSimilar,
  matchSupplierName,
  matchSupplierProduct,
  normalizeName,
  resolvePicked,
  resolveTyped,
  supplierKey,
  type PurchaseUnit,
} from "@/lib/order-book-core";
import {
  catalogueNamesMatching,
  getPurchaseHit,
  getSupplierProducts,
  hitToEntry,
  listCatalogSections,
  listSupplierOptions,
  resolutionCandidates,
  searchPurchaseHits,
} from "@/lib/purchase-orders";
// Types live in a separate module: a "use server" file may only export async
// functions, and re-exporting a type from one crashes on module evaluation.
import type {
  AddSupplierProductInput,
  AddSupplierProductResult,
  AddSupplierResult,
  PriceEditResult,
  DeleteSupplierResult,
  RemoveSupplierProductResult,
  SupplierEditResult,
  SupplierUse,
  AddLineInput,
  AddLineResult,
  AssignInput,
  AssignResult,
  CreateProductInput,
  CreateProductResult,
  LineUnitResult,
  MarkOrderedResult,
  PlacedLine,
  PurchaseActionResult,
  PurchaseHit,
  SupplierOption,
  UndoOrderResult,
} from "@/lib/purchase-order-types";

/** Every entry point sits behind this; admin passes automatically. */
function requireBuyer() {
  return requireRole("buyer");
}

async function announce() {
  revalidatePath("/buyer/purchase-orders");
  await notifyPurchaseOrdersChanged();
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Postgres error code, whether or not the driver error was wrapped. */
function pgError(err: unknown): { code?: string; constraint?: string } {
  const e = err as {
    code?: string;
    constraint_name?: string;
    cause?: { code?: string; constraint_name?: string };
  };
  return {
    code: e?.code ?? e?.cause?.code,
    constraint: e?.constraint_name ?? e?.cause?.constraint_name,
  };
}

/** Serialises order-shape changes for one supplier within a transaction. */
async function lockSupplierOrders(tx: Tx, supplierId: number) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext('purchase_orders'), ${supplierId})`,
  );
}

/**
 * Puts a line on the supplier's open order (opening one if there is none).
 * Same product at the same unit adds to the existing line, in one statement,
 * so two buyers adding at once end up with the sum.
 */
async function placeLine(
  tx: Tx,
  user: User,
  p: {
    supplierId: number;
    supplierName: string;
    itemCode: string;
    qty: number;
    unit: PurchaseUnit;
    name: string;
    pack: string;
  },
): Promise<PlacedLine> {
  await lockSupplierOrders(tx, p.supplierId);
  await tx
    .insert(purchaseOrders)
    .values({ supplierId: p.supplierId })
    .onConflictDoNothing({
      target: purchaseOrders.supplierId,
      where: sql`status = 'open'`,
    });
  const [order] = await tx
    .select({ id: purchaseOrders.id })
    .from(purchaseOrders)
    .where(
      and(
        eq(purchaseOrders.supplierId, p.supplierId),
        eq(purchaseOrders.status, "open"),
      ),
    )
    .for("update");

  const [row] = await tx
    .insert(purchaseOrderLines)
    .values({
      orderId: order.id,
      itemCode: p.itemCode,
      qty: String(p.qty),
      unit: p.unit,
      nameAtTime: p.name,
      packAtTime: p.pack,
      addedByUserId: user.id,
      addedByName: user.name,
    })
    .onConflictDoUpdate({
      target: [
        purchaseOrderLines.orderId,
        purchaseOrderLines.itemCode,
        purchaseOrderLines.unit,
      ],
      set: {
        qty: sql`purchase_order_lines.qty + excluded.qty`,
        updatedAt: new Date(),
      },
    })
    .returning({
      qty: purchaseOrderLines.qty,
      // xmax is non-zero only on the row an upsert updated.
      merged: sql<boolean>`(xmax::text <> '0')`,
    });

  await tx
    .update(purchaseOrders)
    .set({ updatedAt: new Date() })
    .where(eq(purchaseOrders.id, order.id));

  return {
    supplierName: p.supplierName,
    name: p.name,
    pack: p.pack,
    unit: p.unit,
    qty: Number(row.qty),
    merged: Boolean(row.merged),
  };
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export async function searchPurchaseCatalog(
  query: string,
): Promise<PurchaseHit[]> {
  await requireBuyer();
  if (!query || query.trim().length < 2) return [];
  return searchPurchaseHits(query);
}

export async function listPurchaseSuppliers(): Promise<SupplierOption[]> {
  await requireBuyer();
  return listSupplierOptions();
}

export async function listPurchaseSections(): Promise<string[]> {
  await requireBuyer();
  return listCatalogSections();
}

// ---------------------------------------------------------------------------
// The buyer card
// ---------------------------------------------------------------------------

export async function addPurchaseLine(
  input: AddLineInput,
): Promise<AddLineResult> {
  const user = await requireBuyer();

  const check = checkLineInput(input?.qty, input?.unit);
  if (!check.ok) {
    return { status: "ask", field: check.field, message: check.message };
  }

  const typed = String(input.typed ?? "").trim();
  let hits: PurchaseHit[];
  let resolution;
  if (input.itemCode) {
    const hit = await getPurchaseHit(input.itemCode);
    if (!hit) {
      return {
        status: "error",
        message: "That product is no longer in the catalogue. Search again.",
      };
    }
    hits = [hit];
    resolution = resolvePicked(hitToEntry(hit));
  } else {
    if (!typed) {
      return { status: "ask", field: "product", message: "Type a product." };
    }
    hits = await resolutionCandidates(typed);
    resolution = resolveTyped(typed, hits.map(hitToEntry));
  }
  const byCode = new Map(hits.map((h) => [h.code, h]));

  switch (resolution.kind) {
    case "needs-sourcing":
      return { status: "needs-sourcing", product: byCode.get(resolution.entry.code)! };
    case "choose":
      return {
        status: "choose",
        typed,
        products: resolution.entries.map((e) => byCode.get(e.code)!),
      };
    case "similar":
      return {
        status: "similar",
        typed,
        products: resolution.entries.map((e) => byCode.get(e.code)!),
      };
    case "none":
      return { status: "none", typed };
    case "ready": {
      const { entry, sourcing } = resolution;
      // Typed without looking at the unit box: show where it goes and in what
      // unit before anything is added, rather than order 1 "each" of a pallet item.
      if (
        !input.itemCode &&
        !input.unitChosen &&
        sourcing.purchaseUnit !== null &&
        sourcing.purchaseUnit !== check.unit
      ) {
        return { status: "check-unit", product: byCode.get(entry.code)! };
      }
      const line = await db.transaction((tx) =>
        placeLine(tx, user, {
          supplierId: sourcing.supplierId,
          supplierName: sourcing.supplierName,
          itemCode: entry.code,
          qty: check.qty,
          unit: check.unit,
          name: entry.name,
          pack: sourcing.purchasePack,
        }),
      );
      await announce();
      return { status: "added", line };
    }
  }
}

/**
 * Case (b): the product has no supplier yet. Records who we buy it from on the
 * catalogue product itself, then adds the line — both or neither.
 */
export async function assignSupplierAndAdd(
  input: AssignInput,
): Promise<AssignResult> {
  const user = await requireBuyer();

  const line = checkLineInput(input?.qty, input?.unit);
  if (!line.ok) return { status: "ask", field: line.field, message: line.message };
  const sourcing = checkSourcingInput(input);
  if (!sourcing.ok) {
    return { status: "ask", field: sourcing.field, message: sourcing.message };
  }

  const hit = await getPurchaseHit(String(input.itemCode ?? ""));
  if (!hit) {
    return { status: "error", message: "That product is no longer in the catalogue." };
  }
  if (hit.supplierId !== null) return { status: "already-assigned", product: hit };

  const typedName = input.newSupplier?.name?.trim() ?? "";
  if (!input.supplierId && !typedName) {
    return {
      status: "ask",
      field: "supplier",
      message: "Choose the supplier, or add a new one.",
    };
  }

  // A typed "new" supplier is checked against the list before anything is
  // written, so a near miss can go back to the buyer.
  if (!input.supplierId) {
    const all = await db.select().from(suppliers);
    const match = matchSupplierName(typedName, all);
    if (match.kind === "similar" && !input.confirmNewSupplier) {
      return {
        status: "supplier-similar",
        typed: typedName,
        suppliers: match.suppliers.map((s) => ({
          id: s.id,
          name: s.name,
          contact: s.contact,
          email: s.email,
        })),
      };
    }
  }

  try {
    const result = await db.transaction(async (tx) => {
      let supplier: Supplier | undefined;
      let matchedExisting: string | null = null;
      let createdSupplier = false;

      if (input.supplierId) {
        [supplier] = await tx
          .select()
          .from(suppliers)
          .where(eq(suppliers.id, Number(input.supplierId)));
        if (!supplier) return null;
      } else {
        // Re-match under a lock: two buyers adding the same new supplier at
        // once must end up on one record.
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext('suppliers'))`,
        );
        const all = await tx.select().from(suppliers);
        const match = matchSupplierName(typedName, all);
        const contact = input.newSupplier?.contact?.trim() ?? "";
        const email = input.newSupplier?.email?.trim() ?? "";
        if (match.kind === "existing") {
          supplier = match.supplier;
          if (supplier.name !== typedName) matchedExisting = supplier.name;
          // Fill in contact details the record is missing; never overwrite.
          const fill = {
            ...(contact && !supplier.contact ? { contact } : {}),
            ...(email && !supplier.email ? { email } : {}),
          };
          if (Object.keys(fill).length > 0) {
            await tx
              .update(suppliers)
              .set({ ...fill, updatedAt: new Date() })
              .where(eq(suppliers.id, supplier.id));
          }
        } else {
          supplier = await insertSupplier(
            tx,
            { name: typedName, contact, email },
            user,
          );
          createdSupplier = true;
        }
      }

      await tx.insert(itemSourcing).values({
        itemCode: hit.code,
        supplierId: supplier.id,
        supplierSku: sourcing.supplierSku,
        purchasePack: sourcing.purchasePack,
        purchaseUnit: sourcing.purchaseUnit,
        preferred: true,
        assignedBy: user.id,
        assignedByName: user.name,
      });
      await logAudit(tx, user, [
        {
          action: "create",
          recordType: "item_sourcing",
          recordId: hit.code,
          newValue: {
            supplierId: supplier.id,
            supplierName: supplier.name,
            supplierSku: sourcing.supplierSku,
            purchasePack: sourcing.purchasePack,
            purchaseUnit: sourcing.purchaseUnit,
          },
        },
      ]);

      const placed = await placeLine(tx, user, {
        supplierId: supplier.id,
        supplierName: supplier.name,
        itemCode: hit.code,
        qty: line.qty,
        unit: line.unit,
        name: hit.name,
        pack: sourcing.purchasePack,
      });
      return { matchedExisting, createdSupplier, line: placed };
    });

    if (!result) {
      return { status: "error", message: "That supplier is no longer on file. Choose again." };
    }
    await announce();
    return { status: "assigned", ...result };
  } catch (err) {
    const { code, constraint } = pgError(err);
    if (
      code === "23505" &&
      (constraint === "item_sourcing_one_preferred" ||
        constraint === "item_sourcing_item_supplier_unique")
    ) {
      // Someone assigned it a moment ago; nothing of ours was saved.
      const fresh = await getPurchaseHit(hit.code);
      if (fresh) return { status: "already-assigned", product: fresh };
    }
    throw err;
  }
}

/**
 * Case (e): a product the catalogue doesn't have. Everything is typed by the
 * buyer; an exact duplicate is refused and a similar one is asked about.
 */
export async function createCatalogProduct(
  input: CreateProductInput,
): Promise<CreateProductResult> {
  const user = await requireBuyer();

  const code = String(input?.code ?? "").trim();
  const description = String(input?.description ?? "").trim();
  const section = String(input?.section ?? "").trim();
  if (!code || /\s/.test(code) || code.length > 64) {
    return {
      status: "ask",
      field: "code",
      message: "Enter the product code (no spaces), e.g. TOMROSSO100.",
    };
  }
  if (!normalizeName(description)) {
    return { status: "ask", field: "description", message: "Enter the product description." };
  }
  if (!section) {
    return { status: "ask", field: "section", message: "Enter the catalogue section." };
  }

  const [taken] = await db
    .select({ code: inventoryItems.code })
    .from(inventoryItems)
    .where(sql`upper(${inventoryItems.code}) = ${code.toUpperCase()}`)
    .limit(1);
  if (taken) {
    const product = await getPurchaseHit(taken.code);
    if (product) return { status: "code-taken", product };
  }

  const candidates = await resolutionCandidates(description, { activeOnly: false });
  const key = normalizeName(description);
  const duplicates = candidates.filter((c) => normalizeName(c.name) === key);
  if (duplicates.length > 0) return { status: "duplicate", products: duplicates };
  if (!input.confirmSimilar) {
    const similar = candidates
      .filter((c) => looksSimilar(c.name, description))
      .slice(0, 6);
    if (similar.length > 0) return { status: "similar", products: similar };
  }

  try {
    await db.transaction(async (tx) => {
      await tx.insert(inventoryItems).values({ code, description, section });
      await logAudit(tx, user, [
        {
          action: "create",
          recordType: "inventory_item",
          recordId: code,
          newValue: { code, description, section, via: "purchase-orders" },
        },
      ]);
    });
  } catch (err) {
    if (pgError(err).code === "23505") {
      const product = await getPurchaseHit(code);
      if (product) return { status: "code-taken", product };
    }
    throw err;
  }

  const product = await getPurchaseHit(code);
  if (!product) return { status: "error", message: "The product could not be read back." };
  await announce();
  return { status: "created", product };
}

// ---------------------------------------------------------------------------
// Open orders
// ---------------------------------------------------------------------------

const openOrder = (orderId: number) =>
  and(eq(purchaseOrders.id, orderId), eq(purchaseOrders.status, "open"));

export async function setOrderMethod(
  orderId: number,
  method: string,
): Promise<PurchaseActionResult> {
  await requireBuyer();
  if (!isPurchaseMethod(method)) return { ok: false, error: "Choose delivery or pickup." };
  const updated = await db
    .update(purchaseOrders)
    .set({ method, updatedAt: new Date() })
    .where(openOrder(Number(orderId)))
    .returning({ id: purchaseOrders.id });
  if (updated.length === 0) return { ok: false, error: "That order is no longer open." };
  await announce();
  return { ok: true };
}

export async function setOrderWantedFor(
  orderId: number,
  wantedFor: string,
): Promise<PurchaseActionResult> {
  await requireBuyer();
  const value = String(wantedFor ?? "").trim();
  if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { ok: false, error: "Pick a date, or clear it." };
  }
  const updated = await db
    .update(purchaseOrders)
    .set({ wantedFor: value || null, updatedAt: new Date() })
    .where(openOrder(Number(orderId)))
    .returning({ id: purchaseOrders.id });
  if (updated.length === 0) return { ok: false, error: "That order is no longer open." };
  await announce();
  return { ok: true };
}

export async function setSupplierContact(
  supplierId: number,
  field: "contact" | "email",
  value: string,
): Promise<PurchaseActionResult> {
  await requireBuyer();
  if (field !== "contact" && field !== "email") {
    return { ok: false, error: "Unknown field." };
  }
  const clean = String(value ?? "").trim().slice(0, 200);
  await db
    .update(suppliers)
    .set({ [field]: clean, updatedAt: new Date() })
    .where(eq(suppliers.id, Number(supplierId)));
  await announce();
  return { ok: true };
}

/** Only lines on an open order can change; history is never rewritten. */
const lineOnOpenOrder = (lineId: string) =>
  and(
    eq(purchaseOrderLines.id, lineId),
    sql`${purchaseOrderLines.orderId} in (select id from purchase_orders where status = 'open')`,
  );

export async function setLineQty(
  lineId: string,
  qty: string,
): Promise<PurchaseActionResult> {
  await requireBuyer();
  const check = checkLineInput(qty, "each");
  if (!check.ok) return { ok: false, error: check.message };
  const updated = await db
    .update(purchaseOrderLines)
    .set({ qty: String(check.qty), updatedAt: new Date() })
    .where(lineOnOpenOrder(String(lineId)))
    .returning({ id: purchaseOrderLines.id });
  if (updated.length === 0) return { ok: false, error: "That line is no longer on an open order." };
  await announce();
  return { ok: true };
}

export async function removeOrderLine(
  lineId: string,
): Promise<PurchaseActionResult> {
  await requireBuyer();
  await db.delete(purchaseOrderLines).where(lineOnOpenOrder(String(lineId)));
  await announce();
  return { ok: true };
}

/**
 * Changes the unit on one open line. If the product already has a line at the
 * new unit on that order, the two are joined (quantities summed) — the same
 * one-line-per-product-per-unit rule as adding.
 */
export async function setLineUnit(
  lineId: string,
  unit: string,
): Promise<LineUnitResult> {
  await requireBuyer();
  if (!isPurchaseUnit(unit)) {
    return { ok: false, error: "Choose pallet, case, box, bag or each." };
  }

  const [target] = await db
    .select({ supplierId: purchaseOrders.supplierId })
    .from(purchaseOrderLines)
    .innerJoin(purchaseOrders, eq(purchaseOrders.id, purchaseOrderLines.orderId))
    .where(lineOnOpenOrder(String(lineId)));
  if (!target) return { ok: false, error: "That line is no longer on an open order." };

  const result = await db.transaction(async (tx): Promise<LineUnitResult> => {
    await lockSupplierOrders(tx, target.supplierId);
    const [line] = await tx
      .select()
      .from(purchaseOrderLines)
      .where(lineOnOpenOrder(String(lineId)))
      .for("update");
    if (!line) return { ok: false, error: "That line is no longer on an open order." };
    if (line.unit === unit) return { ok: true, merged: false, qty: Number(line.qty) };

    const [same] = await tx
      .select()
      .from(purchaseOrderLines)
      .where(
        and(
          eq(purchaseOrderLines.orderId, line.orderId),
          eq(purchaseOrderLines.itemCode, line.itemCode),
          eq(purchaseOrderLines.unit, unit),
        ),
      )
      .for("update");

    if (!same) {
      await tx
        .update(purchaseOrderLines)
        .set({ unit, updatedAt: new Date() })
        .where(eq(purchaseOrderLines.id, line.id));
      return { ok: true, merged: false, qty: Number(line.qty) };
    }

    const [joined] = await tx
      .update(purchaseOrderLines)
      .set({
        qty: sql`${purchaseOrderLines.qty} + ${line.qty}`,
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrderLines.id, same.id))
      .returning({ qty: purchaseOrderLines.qty });
    await tx.delete(purchaseOrderLines).where(eq(purchaseOrderLines.id, line.id));
    return { ok: true, merged: true, qty: Number(joined.qty) };
  });

  if (result.ok) await announce();
  return result;
}

/**
 * Moves an open order into History. The buyer confirmed a line count; if a
 * teammate changed the order since, nothing happens and they are told.
 */
export async function markOrderOrdered(
  orderId: number,
  expectedLines: number,
): Promise<MarkOrderedResult> {
  const user = await requireBuyer();

  const result = await db.transaction(async (tx) => {
    const [order] = await tx
      .select({ id: purchaseOrders.id, supplierName: suppliers.name })
      .from(purchaseOrders)
      .innerJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
      .where(openOrder(Number(orderId)))
      .for("update", { of: purchaseOrders });
    if (!order) return { ok: false as const, error: "That order is no longer open." };

    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(purchaseOrderLines)
      .where(eq(purchaseOrderLines.orderId, order.id));
    if (n === 0) return { ok: false as const, error: "That order has no lines." };
    if (n !== Number(expectedLines)) {
      return {
        ok: false as const,
        error: `${order.supplierName}'s order changed while you were looking — it has ${n} line${n === 1 ? "" : "s"} now. Check it and try again.`,
      };
    }

    const [done] = await tx
      .update(purchaseOrders)
      .set({
        status: "ordered",
        orderedOn: new Date(),
        orderedByUserId: user.id,
        orderedByName: user.name,
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, order.id))
      .returning({
        date: sql<string>`to_char(ordered_on at time zone 'America/Montreal', 'YYYY-MM-DD')`,
      });
    await logAudit(tx, user, [
      {
        action: "update:status",
        recordType: "purchase_order",
        recordId: order.id,
        oldValue: { status: "open" },
        newValue: { status: "ordered", lines: n },
      },
    ]);
    return { ok: true as const, supplierName: order.supplierName, date: done.date };
  });

  if (result.ok) await announce();
  return result;
}

/**
 * Puts an ordered PO back on the supplier's next order and removes it from
 * History. Lines merge into what is already open by the same identity rule;
 * method and wanted-for date come back from the ordered record. The buyer was
 * warned about `expectedOpenLines`; a different count stops and re-warns.
 */
export async function undoOrderOrdered(
  orderId: number,
  expectedOpenLines: number,
): Promise<UndoOrderResult> {
  const user = await requireBuyer();

  const [target] = await db
    .select({ supplierId: purchaseOrders.supplierId })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, Number(orderId)));
  if (!target) return { ok: false, error: "That order is no longer in History." };

  const result = await db.transaction(async (tx): Promise<UndoOrderResult> => {
    await lockSupplierOrders(tx, target.supplierId);

    const [ordered] = await tx
      .select({
        id: purchaseOrders.id,
        method: purchaseOrders.method,
        wantedFor: purchaseOrders.wantedFor,
        supplierName: suppliers.name,
      })
      .from(purchaseOrders)
      .innerJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
      .where(
        and(
          eq(purchaseOrders.id, Number(orderId)),
          eq(purchaseOrders.status, "ordered"),
        ),
      )
      .for("update", { of: purchaseOrders });
    if (!ordered) return { ok: false, error: "That order is no longer in History." };

    const [open] = await tx
      .select({ id: purchaseOrders.id })
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.supplierId, target.supplierId),
          eq(purchaseOrders.status, "open"),
        ),
      )
      .for("update");

    let openLines = 0;
    if (open) {
      [{ n: openLines }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(purchaseOrderLines)
        .where(eq(purchaseOrderLines.orderId, open.id));
    }
    if (openLines !== Number(expectedOpenLines)) {
      return {
        ok: false,
        openLines,
        error:
          openLines === 0
            ? `${ordered.supplierName}'s next order changed while you were looking. Try again.`
            : `${ordered.supplierName} now has ${openLines} open line${openLines === 1 ? "" : "s"}; the History lines would merge into them.`,
      };
    }

    if (!open) {
      await tx
        .update(purchaseOrders)
        .set({
          status: "open",
          orderedOn: null,
          orderedByUserId: null,
          orderedByName: "",
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrders.id, ordered.id));
    } else {
      await tx.execute(sql`
        insert into purchase_order_lines
          (order_id, item_code, qty, unit, name_at_time, pack_at_time,
           added_by_user_id, added_by_name, created_at)
        select ${open.id}, item_code, qty, unit, name_at_time, pack_at_time,
               added_by_user_id, added_by_name, created_at
          from purchase_order_lines
         where order_id = ${ordered.id}
        on conflict (order_id, item_code, unit)
        do update set qty = purchase_order_lines.qty + excluded.qty,
                      updated_at = now()
      `);
      await tx
        .update(purchaseOrders)
        .set({
          method: ordered.method,
          wantedFor: ordered.wantedFor,
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrders.id, open.id));
      await tx.delete(purchaseOrders).where(eq(purchaseOrders.id, ordered.id));
    }

    await logAudit(tx, user, [
      {
        action: "update:undo_ordered",
        recordType: "purchase_order",
        recordId: ordered.id,
        oldValue: { status: "ordered" },
        newValue: { status: "open", mergedInto: open?.id ?? null },
      },
    ]);
    return { ok: true, supplierName: ordered.supplierName };
  });

  if (result.ok) await announce();
  return result;
}

// ---------------------------------------------------------------------------
// Suppliers view (SUPPLIERS-TAB-SPEC.md) — where sourcing data is maintained
// ---------------------------------------------------------------------------

/** YYYY-MM-DD in Montreal, the date stamped as "cost set". */
function todayMontreal(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Montreal" });
}

/** Serialises supplier links for one catalogue product within a transaction. */
async function lockItemSourcing(tx: Tx, itemCode: string) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext('item_sourcing'), hashtext(${itemCode}))`,
  );
}

async function sourcingRow(tx: Tx, sourcingId: string) {
  const [row] = await tx
    .select()
    .from(itemSourcing)
    .where(eq(itemSourcing.id, sourcingId))
    .for("update");
  return row;
}

const numericOrNull = (value: number | null) =>
  value === null ? null : String(value);

/** Cost or sell for one product from one supplier. A cost change is recorded. */
export async function setSourcingPrice(
  sourcingId: string,
  field: "cost" | "sell",
  text: string,
): Promise<PriceEditResult> {
  const user = await requireBuyer();
  if (field !== "cost" && field !== "sell") return { ok: false, error: "Unknown field." };
  const price = checkPrice(text);
  if (!price.ok) return { ok: false, error: price.message };

  const result = await db.transaction(async (tx): Promise<PriceEditResult> => {
    const row = await sourcingRow(tx, String(sourcingId));
    if (!row) return { ok: false, error: "That product is no longer on this supplier." };

    if (field === "sell") {
      const current = row.sell === null ? null : Number(row.sell);
      if (current !== price.value) {
        await tx
          .update(itemSourcing)
          .set({ sell: numericOrNull(price.value), updatedAt: new Date() })
          .where(eq(itemSourcing.id, row.id));
      }
      return { ok: true, costSetOn: row.costSetOn };
    }

    const current = row.cost === null ? null : Number(row.cost);
    const change = applyCostChange(
      { cost: current, costSetOn: row.costSetOn },
      price.value,
      todayMontreal(),
    );
    if (change.changed) {
      await tx
        .update(itemSourcing)
        .set({
          cost: numericOrNull(change.cost),
          costSetOn: change.costSetOn,
          updatedAt: new Date(),
        })
        .where(eq(itemSourcing.id, row.id));
      await tx.insert(itemSourcingCostHistory).values({
        sourcingId: row.id,
        itemCode: row.itemCode,
        supplierId: row.supplierId,
        oldCost: numericOrNull(current),
        newCost: numericOrNull(change.cost),
        changedBy: user.id,
        changedByName: user.name,
      });
    }
    return { ok: true, costSetOn: change.costSetOn };
  });

  if (result.ok) await announce();
  return result;
}

/**
 * Renames the catalogue product or changes the purchase pack on one supplier
 * row. Refused when it would land on another product. The new wording reaches
 * open order lines (and pallet cards and Product Lists); history keeps its own.
 */
export async function editSupplierProduct(
  sourcingId: string,
  next: { name: string; pack: string },
): Promise<SupplierEditResult> {
  const user = await requireBuyer();
  const name = String(next?.name ?? "").trim();
  const pack = String(next?.pack ?? "").trim();

  const result = await db.transaction(async (tx) => {
    const row = await sourcingRow(tx, String(sourcingId));
    if (!row) return { ok: false as const, error: "That product is no longer on this supplier." };
    const siblings = await getSupplierProducts(row.supplierId, tx);
    const current = siblings.find((x) => x.sourcingId === row.id);
    if (!current) return { ok: false as const, error: "That product is no longer in the catalogue." };

    const check = checkProductEdit(
      current,
      { name, pack },
      siblings,
      await catalogueNamesMatching(name, tx),
    );
    if (check.kind === "blank") {
      return { ok: false as const, error: "A product needs a name, so that change was not applied." };
    }
    // A pack that was on file can't be blanked; one that never was can stay blank.
    if (!pack && current.pack) {
      return { ok: false as const, error: "A purchase pack is needed, so that change was not applied." };
    }
    if (check.kind === "clash") {
      return {
        ok: false as const,
        error: `That is already another product: ${check.name}${check.pack ? ` (${check.pack})` : ""}. Two entries for the same item at the same pack is what the matching rule prevents, so this change was not applied.`,
      };
    }

    const renamed = name !== current.name;
    const repacked = pack !== current.pack;
    let openLinesUpdated = 0;

    if (renamed) {
      await tx
        .update(inventoryItems)
        .set({ description: name, updatedAt: new Date() })
        .where(eq(inventoryItems.code, row.itemCode));
      await logAudit(tx, user, [
        {
          action: "update:description",
          recordType: "inventory_item",
          recordId: row.itemCode,
          oldValue: { description: current.name },
          newValue: { description: name, via: "suppliers-view" },
        },
      ]);
    }
    if (repacked) {
      await tx
        .update(itemSourcing)
        .set({ purchasePack: pack, updatedAt: new Date() })
        .where(eq(itemSourcing.id, row.id));
      // Only this supplier's open order buys it in this pack.
      const moved = await tx
        .update(purchaseOrderLines)
        .set({ packAtTime: pack, updatedAt: new Date() })
        .where(
          and(
            eq(purchaseOrderLines.itemCode, row.itemCode),
            sql`${purchaseOrderLines.orderId} in (select id from purchase_orders where status = 'open' and supplier_id = ${row.supplierId})`,
          ),
        )
        .returning({ id: purchaseOrderLines.id });
      openLinesUpdated += moved.length;
      await logAudit(tx, user, [
        {
          action: "update:purchase_pack",
          recordType: "item_sourcing",
          recordId: row.itemCode,
          oldValue: { supplierId: row.supplierId, purchasePack: current.pack },
          newValue: { supplierId: row.supplierId, purchasePack: pack },
        },
      ]);
    }
    return {
      ok: true as const,
      code: row.itemCode,
      renamed,
      inPriceFile: !!current.inPriceFile,
      openLinesUpdated,
    };
  });

  if (!result.ok) return result;

  let { openLinesUpdated } = result;
  if (result.renamed) {
    const synced = await syncCatalogWording([result.code]);
    openLinesUpdated += synced.openOrderLinesSynced;
    revalidatePath("/buyer/product-lists");
    await notifyProductListsChanged();
  }
  await announce();
  return {
    ok: true,
    openLinesUpdated,
    note:
      result.renamed && result.inPriceFile
        ? "This product is in the uploaded price file, so the next price upload will put the file's wording back."
        : null,
  };
}

/**
 * Adds a product to a supplier, following the Order Book's matchProduct: the
 * same product at the same pack is updated rather than duplicated, a similar
 * one at the same pack is asked about, a different pack is a new product.
 */
export async function addSupplierProduct(
  input: AddSupplierProductInput,
): Promise<AddSupplierProductResult> {
  const user = await requireBuyer();

  const cost = checkPrice(input?.cost);
  if (!cost.ok) return { status: "ask", field: "cost", message: `Cost: ${cost.message}` };
  const sell = checkPrice(input?.sell);
  if (!sell.ok) return { status: "ask", field: "sell", message: `Sell: ${sell.message}` };

  const supplierId = Number(input?.supplierId);
  const [supplier] = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(eq(suppliers.id, supplierId));
  if (!supplier) return { status: "error", message: "That supplier is no longer on file." };

  // Which catalogue product is this?
  let product: PurchaseHit;
  if (input.itemCode) {
    const hit = await getPurchaseHit(input.itemCode);
    if (!hit) return { status: "error", message: "That product is no longer in the catalogue." };
    product = hit;
  } else {
    const typed = String(input.typed ?? "").trim();
    if (!typed) return { status: "ask", field: "product", message: "Type the product." };
    const hits = await resolutionCandidates(typed);
    const resolution = resolveTyped(typed, hits.map(hitToEntry));
    const byCode = new Map(hits.map((h) => [h.code, h]));
    if (resolution.kind === "none") return { status: "none", typed };
    if (resolution.kind === "choose") {
      return { status: "choose", products: resolution.entries.map((e) => byCode.get(e.code)!) };
    }
    if (resolution.kind === "similar") {
      return {
        status: "similar-catalogue",
        products: resolution.entries.map((e) => byCode.get(e.code)!),
      };
    }
    product = byCode.get(resolution.entry.code)!;
  }

  const sourcing = checkSourcingInput({
    purchasePack: input?.pack,
    purchaseUnit: input?.unit,
  });
  if (!sourcing.ok) return { status: "ask", field: sourcing.field, message: sourcing.message };

  const today = todayMontreal();
  const result = await db.transaction(async (tx): Promise<AddSupplierProductResult> => {
    await lockItemSourcing(tx, product.code);
    const rows = await getSupplierProducts(supplierId, tx);

    // "Update cost and sell if supplied": a blank box leaves the price alone.
    const updatePrices = async (target: (typeof rows)[number]) => {
      const set: Partial<typeof itemSourcing.$inferInsert> = {};
      if (sell.value !== null && sell.value !== target.sell) set.sell = String(sell.value);
      if (cost.value !== null && cost.value !== target.cost) {
        set.cost = String(cost.value);
        set.costSetOn = today;
        await tx.insert(itemSourcingCostHistory).values({
          sourcingId: target.sourcingId,
          itemCode: target.code,
          supplierId,
          oldCost: numericOrNull(target.cost),
          newCost: String(cost.value),
          changedBy: user.id,
          changedByName: user.name,
        });
      }
      if (Object.keys(set).length > 0) {
        await tx
          .update(itemSourcing)
          .set({ ...set, updatedAt: new Date() })
          .where(eq(itemSourcing.id, target.sourcingId));
      }
      return { status: "updated" as const, name: target.name, pack: target.pack };
    };

    const decision = input.decision ?? null;
    if (decision?.kind === "same") {
      const target = rows.find((r) => r.sourcingId === decision.sourcingId);
      if (!target) return { status: "error", message: "That product is no longer on this supplier." };
      return updatePrices(target);
    }

    const match = matchSupplierProduct(rows, {
      code: product.code,
      name: product.name,
      pack: sourcing.purchasePack,
    });
    if (match.kind === "exact") return updatePrices(match.product);
    if (match.kind === "pack-conflict") return { status: "pack-conflict", existing: match.product };
    if (match.kind === "similar" && decision?.kind !== "separate") {
      return { status: "similar", existing: match.product };
    }

    // The first supplier a product gets is the one the Buyer card uses.
    const [{ n: preferredLinks }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(itemSourcing)
      .where(and(eq(itemSourcing.itemCode, product.code), eq(itemSourcing.preferred, true)));
    const preferred = preferredLinks === 0;

    const [created] = await tx
      .insert(itemSourcing)
      .values({
        itemCode: product.code,
        supplierId,
        purchasePack: sourcing.purchasePack,
        purchaseUnit: sourcing.purchaseUnit,
        preferred,
        cost: numericOrNull(cost.value),
        sell: numericOrNull(sell.value),
        costSetOn: cost.value === null ? null : today,
        assignedBy: user.id,
        assignedByName: user.name,
      })
      .returning({ id: itemSourcing.id });
    if (cost.value !== null) {
      await tx.insert(itemSourcingCostHistory).values({
        sourcingId: created.id,
        itemCode: product.code,
        supplierId,
        oldCost: null,
        newCost: String(cost.value),
        changedBy: user.id,
        changedByName: user.name,
      });
    }
    await logAudit(tx, user, [
      {
        action: "create",
        recordType: "item_sourcing",
        recordId: product.code,
        newValue: {
          supplierId,
          purchasePack: sourcing.purchasePack,
          purchaseUnit: sourcing.purchaseUnit,
          preferred,
          via: "suppliers-view",
        },
      },
    ]);
    return { status: "added", name: product.name, pack: sourcing.purchasePack, preferred };
  });

  if (result.status === "added" || result.status === "updated") await announce();
  return result;
}

/** Name only; "fra di" finds "Fra-Di" instead of creating a second record. */
export async function addSupplierByName(
  name: string,
  confirmNew = false,
): Promise<AddSupplierResult> {
  const user = await requireBuyer();
  const typed = String(name ?? "").trim();
  if (!typed) return { status: "ask", field: "supplier", message: "Type the supplier's name." };

  const option = (s: Supplier): SupplierOption => ({
    id: s.id,
    name: s.name,
    contact: s.contact,
    email: s.email,
  });

  const result = await db.transaction(async (tx): Promise<AddSupplierResult> => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('suppliers'))`);
    const all = await tx.select().from(suppliers);
    const match = matchSupplierName(typed, all);
    if (match.kind === "empty") {
      return { status: "ask", field: "supplier", message: "Type the supplier's name." };
    }
    if (match.kind === "existing") {
      if (!match.supplier.active) {
        await tx
          .update(suppliers)
          .set({ active: true, updatedAt: new Date() })
          .where(eq(suppliers.id, match.supplier.id));
      }
      return { status: "existing", supplier: option(match.supplier) };
    }
    if (match.kind === "similar" && !confirmNew) {
      return { status: "similar", typed, suppliers: match.suppliers.map(option) };
    }
    const created = await insertSupplier(tx, { name: typed }, user);
    return { status: "created", supplier: option(created) };
  });

  if (result.status === "created" || result.status === "existing") await announce();
  return result;
}

/**
 * Takes a product off a supplier. The catalogue product stays, and past
 * orders are untouched. When it was the supplier the Buyer card uses and other
 * suppliers remain, the buyer says which one takes over — never a guess.
 */
export async function removeSupplierProduct(
  sourcingId: string,
  promoteSourcingId: string | null = null,
): Promise<RemoveSupplierProductResult> {
  const user = await requireBuyer();

  const [target] = await db
    .select({ itemCode: itemSourcing.itemCode })
    .from(itemSourcing)
    .where(eq(itemSourcing.id, String(sourcingId)));
  if (!target) return { ok: false, error: "That product is no longer on this supplier." };

  const result = await db.transaction(async (tx): Promise<RemoveSupplierProductResult> => {
    await lockItemSourcing(tx, target.itemCode);
    const row = await sourcingRow(tx, String(sourcingId));
    if (!row) return { ok: false, error: "That product is no longer on this supplier." };

    if (row.preferred) {
      const others = await tx
        .select({
          sourcingId: itemSourcing.id,
          supplierName: suppliers.name,
          pack: itemSourcing.purchasePack,
        })
        .from(itemSourcing)
        .innerJoin(suppliers, eq(suppliers.id, itemSourcing.supplierId))
        .where(and(eq(itemSourcing.itemCode, row.itemCode), ne(itemSourcing.id, row.id)));
      if (others.length > 0 && !others.some((o) => o.sourcingId === promoteSourcingId)) {
        return {
          ok: false,
          error:
            "Other suppliers carry this product. Choose which one the Buyer card should use from now on.",
          choosePreferred: others,
        };
      }
    }

    await tx.delete(itemSourcing).where(eq(itemSourcing.id, row.id));
    if (row.preferred && promoteSourcingId) {
      await tx
        .update(itemSourcing)
        .set({ preferred: true, updatedAt: new Date() })
        .where(eq(itemSourcing.id, promoteSourcingId));
    }
    await logAudit(tx, user, [
      {
        action: "delete",
        recordType: "item_sourcing",
        recordId: row.itemCode,
        oldValue: {
          supplierId: row.supplierId,
          purchasePack: row.purchasePack,
          purchaseUnit: row.purchaseUnit,
          cost: row.cost,
          sell: row.sell,
          preferred: row.preferred,
        },
        newValue: { promotedSourcingId: promoteSourcingId },
      },
    ]);
    return { ok: true };
  });

  if (result.ok) await announce();
  return result;
}

// ---------------------------------------------------------------------------
// Manage supplier — SUPPLIERS-TAB-SPEC.md §11 (rename, address, delete/hide)
// ---------------------------------------------------------------------------

/**
 * Renames a supplier and corrects its address. The rename is refused when it
 * lands on another supplier, and the old spelling is kept as an alias so the
 * pickup form, which matches typed names, goes on finding this record instead
 * of quietly filing a second one.
 */
export async function editSupplier(
  supplierId: number,
  next: { name: string; address: string },
): Promise<PurchaseActionResult> {
  const user = await requireBuyer();
  const id = Number(supplierId);

  const result = await db.transaction(async (tx): Promise<PurchaseActionResult> => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('suppliers'))`);
    const [row] = await tx.select().from(suppliers).where(eq(suppliers.id, id));
    if (!row) return { ok: false, error: "That supplier is no longer on file." };

    const all = await tx
      .select({ id: suppliers.id, name: suppliers.name, aliases: suppliers.aliases })
      .from(suppliers);
    const check = checkSupplierEdit(id, next, all);
    if (check.kind === "blank") return { ok: false, error: "The supplier needs a name." };
    if (check.kind === "clash") {
      return {
        ok: false,
        error: `“${check.supplier.name}” already goes by that name. Two records for one supplier split its prices and orders, so this one keeps its name.`,
      };
    }

    const renamed = supplierKey(check.name) !== supplierKey(row.name);
    if (!renamed && check.name === row.name && check.address === row.address) {
      return { ok: true };
    }
    // Every spelling this supplier has answered to, without duplicates.
    const aliases = renamed
      ? [...row.aliases, row.name].filter(
          (a, i, list) =>
            supplierKey(a) !== supplierKey(check.name) &&
            list.findIndex((b) => supplierKey(b) === supplierKey(a)) === i,
        )
      : row.aliases;

    await tx
      .update(suppliers)
      .set({
        name: check.name,
        address: check.address,
        aliases,
        updatedAt: new Date(),
      })
      .where(eq(suppliers.id, id));
    await logAudit(tx, user, [
      {
        action: "update",
        recordType: "supplier",
        recordId: id,
        oldValue: { name: row.name, address: row.address, aliases: row.aliases },
        newValue: { name: check.name, address: check.address, aliases },
      },
    ]);
    return { ok: true };
  });

  if (result.ok) await announce();
  return result;
}

/**
 * Deletes a supplier nothing points at. One that carries products, orders or
 * pickups is never deleted — that would take the history with it — so the
 * buyer is told what holds it and can hide it instead: hidden suppliers drop
 * out of every list, and adding the name back brings the same record, with its
 * history, straight back.
 */
export async function deleteSupplier(
  supplierId: number,
  hideIfInUse = false,
): Promise<DeleteSupplierResult> {
  const user = await requireBuyer();
  const id = Number(supplierId);

  const result = await db.transaction(async (tx): Promise<DeleteSupplierResult> => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('suppliers'))`);
    await lockSupplierOrders(tx, id);
    const [row] = await tx.select().from(suppliers).where(eq(suppliers.id, id));
    if (!row) return { ok: false, error: "That supplier is no longer on file." };

    const [counts] = await tx.execute<Record<string, number>>(sql`
      select
        (select count(*) from item_sourcing where supplier_id = ${id})::int as products,
        (select count(*) from purchase_orders where supplier_id = ${id})::int as orders,
        (select count(*) from purchase_orders where supplier_id = ${id} and status = 'open')::int as "openOrders",
        (select count(*) from pickups where supplier_id = ${id})::int as pickups
    `);
    const use: SupplierUse = {
      products: Number(counts.products),
      orders: Number(counts.orders),
      openOrders: Number(counts.openOrders),
      pickups: Number(counts.pickups),
    };
    const held = use.products + use.orders + use.pickups > 0;

    if (held && !hideIfInUse) {
      return { ok: false, error: `${row.name} is still in use.`, inUse: use };
    }

    if (held) {
      if (!row.active) return { ok: true, removed: "hidden", name: row.name };
      await tx
        .update(suppliers)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(suppliers.id, id));
      await logAudit(tx, user, [
        {
          action: "update:active",
          recordType: "supplier",
          recordId: id,
          oldValue: { active: true },
          newValue: { active: false, held: use },
        },
      ]);
      return { ok: true, removed: "hidden", name: row.name };
    }

    await tx.delete(suppliers).where(eq(suppliers.id, id));
    await logAudit(tx, user, [
      {
        action: "delete",
        recordType: "supplier",
        recordId: id,
        oldValue: {
          name: row.name,
          address: row.address,
          contact: row.contact,
          email: row.email,
          aliases: row.aliases,
          externalId: row.externalId,
        },
      },
    ]);
    return { ok: true, removed: "deleted", name: row.name };
  });

  if (result.ok) await announce();
  return result;
}
