"use server";

// Pickups — buyer/admin only. Create a pickup sheet (self-learning supplier
// list remembers each location's address) and list them for the table + print.

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { pickups, type PickupStatus } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { resolveSupplier } from "@/lib/suppliers";
import { notifyNewPickup } from "@/lib/push-server";
import { formatExternalId } from "@/db/external-id";

export interface PickupInput {
  supplierName: string;
  address: string;
  poNumber: string;
  pickupDate: string; // YYYY-MM-DD
  amountOfStock: string;
  note: string;
  driver: string;
}

export type PickupActionResult =
  | { ok: true; id: number }
  | { ok: false; error: string };

export async function createPickup(
  input: PickupInput,
): Promise<PickupActionResult> {
  // Buyer + admin only (admin passes requireRole automatically).
  const user = await requireRole("buyer", "dispatch");

  const supplierName = input.supplierName?.trim();
  if (!supplierName) return { ok: false, error: "Enter a pickup location." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.pickupDate)) {
    return { ok: false, error: "Choose a date." };
  }
  const poNumber = input.poNumber?.trim();
  if (!poNumber) return { ok: false, error: "Enter a PO number." };
  const amountOfStock = input.amountOfStock?.trim();
  if (!amountOfStock) return { ok: false, error: "Enter the amount of stock." };

  // Find-or-create the supplier and remember its address for next time.
  const supplier = await resolveSupplier(supplierName, input.address, user);

  const id = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(pickups)
      .values({
        supplierId: supplier.id,
        supplierName: supplier.name,
        address: input.address?.trim() || supplier.address,
        poNumber,
        pickupDate: input.pickupDate,
        amountOfStock,
        note: input.note?.trim() || null,
        driver: input.driver?.trim() || null,
        createdByUserId: user.id,
        createdByName: user.name,
      })
      .returning({ id: pickups.id });

    await tx
      .update(pickups)
      .set({ externalId: formatExternalId("pickup", created.id) })
      .where(eq(pickups.id, created.id));

    await logAudit(tx, user, [
      {
        action: "create",
        recordType: "pickup",
        recordId: created.id,
        newValue: {
          supplier: supplier.name,
          poNumber,
          pickupDate: input.pickupDate,
        },
      },
    ]);

    return created.id;
  });

  revalidatePath("/buyer/pickups");
  await notifyNewPickup({
    pickupId: id,
    supplierName: supplier.name,
    pickupDate: input.pickupDate,
  });
  return { ok: true, id };
}

export async function updatePickup(
  id: number,
  input: PickupInput,
): Promise<PickupActionResult> {
  const user = await requireRole("buyer", "dispatch");

  const supplierName = input.supplierName?.trim();
  if (!supplierName) return { ok: false, error: "Enter a pickup location." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.pickupDate)) {
    return { ok: false, error: "Choose a date." };
  }
  const poNumber = input.poNumber?.trim();
  if (!poNumber) return { ok: false, error: "Enter a PO number." };
  const amountOfStock = input.amountOfStock?.trim();
  if (!amountOfStock) return { ok: false, error: "Enter the amount of stock." };

  const [existing] = await db
    .select()
    .from(pickups)
    .where(eq(pickups.id, id))
    .limit(1);
  if (!existing) return { ok: false, error: "Pickup not found." };

  // Keep the supplier list learning from edits too (address corrections stick).
  const supplier = await resolveSupplier(supplierName, input.address, user);

  await db.transaction(async (tx) => {
    await tx
      .update(pickups)
      .set({
        supplierId: supplier.id,
        supplierName: supplier.name,
        address: input.address?.trim() || supplier.address,
        poNumber,
        pickupDate: input.pickupDate,
        amountOfStock,
        note: input.note?.trim() || null,
        driver: input.driver?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(pickups.id, id));

    await logAudit(tx, user, [
      {
        action: "update",
        recordType: "pickup",
        recordId: id,
        oldValue: {
          supplier: existing.supplierName,
          poNumber: existing.poNumber,
          pickupDate: existing.pickupDate,
        },
        newValue: { supplier: supplier.name, poNumber, pickupDate: input.pickupDate },
      },
    ]);
  });

  revalidatePath("/buyer/pickups");
  return { ok: true, id };
}

export async function setPickupStatus(
  id: number,
  status: PickupStatus,
): Promise<PickupActionResult> {
  const user = await requireRole("buyer", "dispatch");
  if (status !== "pending" && status !== "picked_up") {
    return { ok: false, error: "Invalid status." };
  }
  await db.transaction(async (tx) => {
    await tx
      .update(pickups)
      .set({ status, updatedAt: new Date() })
      .where(eq(pickups.id, id));
    await logAudit(tx, user, [
      {
        action: `update:status`,
        recordType: "pickup",
        recordId: id,
        newValue: { status },
      },
    ]);
  });
  revalidatePath("/buyer/pickups");
  return { ok: true, id };
}

/** Mark every (still-pending) pickup on a given day as picked up. */
export async function markDayPickupsPickedUp(
  date: string,
): Promise<PickupActionResult> {
  const user = await requireRole("buyer", "dispatch");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "Invalid date." };
  }
  const count = await db.transaction(async (tx) => {
    const rows = await tx
      .update(pickups)
      .set({ status: "picked_up", updatedAt: new Date() })
      .where(
        and(eq(pickups.pickupDate, date), ne(pickups.status, "picked_up")),
      )
      .returning({ id: pickups.id });
    if (rows.length > 0) {
      await logAudit(
        tx,
        user,
        rows.map((r) => ({
          action: "update:status",
          recordType: "pickup" as const,
          recordId: r.id,
          newValue: { status: "picked_up" },
        })),
      );
    }
    return rows.length;
  });
  revalidatePath("/buyer/pickups");
  return { ok: true, id: count };
}

export async function deletePickup(id: number): Promise<PickupActionResult> {
  const user = await requireRole("buyer", "dispatch");
  await db.transaction(async (tx) => {
    await tx.delete(pickups).where(eq(pickups.id, id));
    await logAudit(tx, user, [
      { action: "delete", recordType: "pickup", recordId: id },
    ]);
  });
  revalidatePath("/buyer/pickups");
  return { ok: true, id };
}

/** A single pickup by id, or null (the edit page reads this). */
export async function getPickup(id: number) {
  await requireRole("buyer", "dispatch");
  const [row] = await db
    .select()
    .from(pickups)
    .where(eq(pickups.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * All pickups. Pending first, with the closest pickup date at the top running
 * down to the furthest, then picked-up sheets at the bottom — so completed
 * pickups drop out of the way automatically.
 */
export async function listPickups() {
  await requireRole("buyer", "dispatch");
  return db
    .select()
    .from(pickups)
    .orderBy(
      // false (pending) sorts before true (picked_up)
      sql`${pickups.status} = 'picked_up'`,
      asc(pickups.pickupDate),
      desc(pickups.id),
    );
}
