"use server";

// Deliveries — buyer/admin only. A lighter companion to pickups: just supplier
// + date, to track what's coming in. Shares the self-learning supplier list.

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { deliveries, type DeliveryStatus } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { resolveSupplier } from "@/lib/suppliers";
import { notifyNewDelivery } from "@/lib/push-server";
import { formatExternalId } from "@/db/external-id";

export interface DeliveryInput {
  supplierName: string;
  deliveryDate: string; // YYYY-MM-DD
}

export type DeliveryActionResult =
  | { ok: true; id: number }
  | { ok: false; error: string };

export async function createDelivery(
  input: DeliveryInput,
): Promise<DeliveryActionResult> {
  const user = await requireRole("buyer", "dispatch", "owner");

  const supplierName = input.supplierName?.trim();
  if (!supplierName) return { ok: false, error: "Enter a supplier name." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.deliveryDate)) {
    return { ok: false, error: "Choose a date." };
  }

  // Reuse the shared supplier list (address optional for deliveries).
  const supplier = await resolveSupplier(supplierName, "", user);

  const id = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(deliveries)
      .values({
        supplierId: supplier.id,
        supplierName: supplier.name,
        deliveryDate: input.deliveryDate,
        createdByUserId: user.id,
        createdByName: user.name,
      })
      .returning({ id: deliveries.id });

    await tx
      .update(deliveries)
      .set({ externalId: formatExternalId("delivery", created.id) })
      .where(eq(deliveries.id, created.id));

    await logAudit(tx, user, [
      {
        action: "create",
        recordType: "delivery",
        recordId: created.id,
        newValue: { supplier: supplier.name, deliveryDate: input.deliveryDate },
      },
    ]);

    return created.id;
  });

  revalidatePath("/buyer/pickups");
  await notifyNewDelivery({
    deliveryId: id,
    supplierName: supplier.name,
    deliveryDate: input.deliveryDate,
  });
  return { ok: true, id };
}

export async function updateDelivery(
  id: number,
  input: DeliveryInput,
): Promise<DeliveryActionResult> {
  const user = await requireRole("buyer", "dispatch", "owner");

  const supplierName = input.supplierName?.trim();
  if (!supplierName) return { ok: false, error: "Enter a supplier name." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.deliveryDate)) {
    return { ok: false, error: "Choose a date." };
  }

  const [existing] = await db
    .select()
    .from(deliveries)
    .where(eq(deliveries.id, id))
    .limit(1);
  if (!existing) return { ok: false, error: "Delivery not found." };

  const supplier = await resolveSupplier(supplierName, "", user);

  await db.transaction(async (tx) => {
    await tx
      .update(deliveries)
      .set({
        supplierId: supplier.id,
        supplierName: supplier.name,
        deliveryDate: input.deliveryDate,
        updatedAt: new Date(),
      })
      .where(eq(deliveries.id, id));

    await logAudit(tx, user, [
      {
        action: "update",
        recordType: "delivery",
        recordId: id,
        oldValue: {
          supplier: existing.supplierName,
          deliveryDate: existing.deliveryDate,
        },
        newValue: { supplier: supplier.name, deliveryDate: input.deliveryDate },
      },
    ]);
  });

  revalidatePath("/buyer/pickups");
  return { ok: true, id };
}

export async function setDeliveryStatus(
  id: number,
  status: DeliveryStatus,
): Promise<DeliveryActionResult> {
  const user = await requireRole("buyer", "dispatch", "owner");
  if (status !== "pending" && status !== "delivered") {
    return { ok: false, error: "Invalid status." };
  }
  await db.transaction(async (tx) => {
    await tx
      .update(deliveries)
      .set({ status, updatedAt: new Date() })
      .where(eq(deliveries.id, id));
    await logAudit(tx, user, [
      {
        action: "update:status",
        recordType: "delivery",
        recordId: id,
        newValue: { status },
      },
    ]);
  });
  revalidatePath("/buyer/pickups");
  return { ok: true, id };
}

/** Mark every (still-pending) delivery on a given day as delivered. */
export async function markDayDeliveriesDelivered(
  date: string,
): Promise<DeliveryActionResult> {
  const user = await requireRole("buyer", "dispatch", "owner");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "Invalid date." };
  }
  const count = await db.transaction(async (tx) => {
    const rows = await tx
      .update(deliveries)
      .set({ status: "delivered", updatedAt: new Date() })
      .where(
        and(eq(deliveries.deliveryDate, date), ne(deliveries.status, "delivered")),
      )
      .returning({ id: deliveries.id });
    if (rows.length > 0) {
      await logAudit(
        tx,
        user,
        rows.map((r) => ({
          action: "update:status",
          recordType: "delivery" as const,
          recordId: r.id,
          newValue: { status: "delivered" },
        })),
      );
    }
    return rows.length;
  });
  revalidatePath("/buyer/pickups");
  return { ok: true, id: count };
}

export async function deleteDelivery(
  id: number,
): Promise<DeliveryActionResult> {
  const user = await requireRole("buyer", "dispatch", "owner");
  await db.transaction(async (tx) => {
    await tx.delete(deliveries).where(eq(deliveries.id, id));
    await logAudit(tx, user, [
      { action: "delete", recordType: "delivery", recordId: id },
    ]);
  });
  revalidatePath("/buyer/pickups");
  return { ok: true, id };
}

/** A single delivery by id, or null (the edit page reads this). */
export async function getDelivery(id: number) {
  await requireRole("buyer", "dispatch", "owner");
  const [row] = await db
    .select()
    .from(deliveries)
    .where(eq(deliveries.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * All deliveries. Pending first (closest date at the top), then delivered
 * rows at the bottom — completed deliveries drop out of the way automatically.
 */
export async function listDeliveries() {
  await requireRole("buyer", "dispatch", "owner");
  return db
    .select()
    .from(deliveries)
    .orderBy(
      // false (pending) sorts before true (delivered)
      sql`${deliveries.status} = 'delivered'`,
      asc(deliveries.deliveryDate),
      desc(deliveries.id),
    );
}
