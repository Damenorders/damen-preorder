"use server";

// Status management — buyer/admin only (SPEC.md §11–12).
// Reps can never call these: requireRole redirects them away.

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  orders,
  type BuyerTableStatus,
  type SubmissionStatus,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyOrdersChanged } from "@/lib/realtime-server";

const SUBMISSION_STATUSES: SubmissionStatus[] = [
  "pending",
  "ready",
  "shipped",
  "invoiced",
  "ordered",
];
const BUYER_TABLE_STATUSES: BuyerTableStatus[] = [
  "pending",
  "ordered",
  "received",
  "pending_delivery",
  "pending_pickup",
];

export async function setSubmissionStatus(
  orderId: number,
  status: SubmissionStatus,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole("buyer", "scheduling", "butcher");
  if (!SUBMISSION_STATUSES.includes(status)) {
    return { ok: false, error: "Invalid status." };
  }

  const existing = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
  });
  if (!existing) return { ok: false, error: "Order not found." };
  if (status === "invoiced" && existing.department !== "fish") {
    return { ok: false, error: "Invoiced is for fish orders only." };
  }
  if (status === "ordered" && existing.department !== "other") {
    return { ok: false, error: "Ordered is for Other orders only." };
  }
  if (existing.submissionStatus === status) return { ok: true };

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({
        submissionStatus: status,
        updatedAt: new Date(),
        // Moving to Ready clears the "Edited" flag — the edit has been actioned.
        ...(status === "ready" ? { editedAt: null, editSummary: null } : {}),
      })
      .where(eq(orders.id, orderId));
    await logAudit(tx, user, [
      {
        action: "update:submission_status",
        recordType: "order",
        recordId: orderId,
        oldValue: existing.submissionStatus,
        newValue: status,
      },
    ]);
  });

  revalidatePath("/", "layout");
  await notifyOrdersChanged();
  return { ok: true };
}

/** Buyer Table bulk change: one status for many orders, in one transaction. */
export async function setBuyerTableStatusBulk(
  orderIds: number[],
  status: BuyerTableStatus,
): Promise<{ ok: boolean; changed?: number; error?: string }> {
  const user = await requireRole("buyer", "butcher");
  if (!BUYER_TABLE_STATUSES.includes(status)) {
    return { ok: false, error: "Invalid status." };
  }
  const ids = [...new Set(orderIds)].filter((id) => Number.isInteger(id));
  if (ids.length === 0) return { ok: false, error: "No orders selected." };

  const existing = await db.query.orders.findMany({
    where: inArray(orders.id, ids),
    columns: { id: true, buyerTableStatus: true },
  });
  if (existing.length !== ids.length) {
    return { ok: false, error: "Some orders no longer exist. Refresh and try again." };
  }
  const toChange = existing.filter((o) => o.buyerTableStatus !== status);
  if (toChange.length === 0) return { ok: true, changed: 0 };

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({ buyerTableStatus: status, updatedAt: new Date() })
      .where(inArray(orders.id, toChange.map((o) => o.id)));
    await logAudit(
      tx,
      user,
      toChange.map((o) => ({
        action: "update:buyer_table_status",
        recordType: "order",
        recordId: o.id,
        oldValue: o.buyerTableStatus,
        newValue: status,
      })),
    );
  });

  revalidatePath("/", "layout");
  await notifyOrdersChanged();
  return { ok: true, changed: toChange.length };
}

export async function setBuyerTableStatus(
  orderId: number,
  status: BuyerTableStatus,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole("buyer", "butcher");
  if (!BUYER_TABLE_STATUSES.includes(status)) {
    return { ok: false, error: "Invalid status." };
  }

  const existing = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
  });
  if (!existing) return { ok: false, error: "Order not found." };
  if (existing.buyerTableStatus === status) return { ok: true };

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({ buyerTableStatus: status, updatedAt: new Date() })
      .where(eq(orders.id, orderId));
    await logAudit(tx, user, [
      {
        action: "update:buyer_table_status",
        recordType: "order",
        recordId: orderId,
        oldValue: existing.buyerTableStatus,
        newValue: status,
      },
    ]);
  });

  revalidatePath("/", "layout");
  await notifyOrdersChanged();
  return { ok: true };
}
