"use server";

// Status management — buyer/admin only (SPEC.md §11–12).
// Reps can never call these: requireRole redirects them away.

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  orders,
  type BuyerTableStatus,
  type SubmissionStatus,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyOrdersChanged } from "@/lib/realtime-server";

const SUBMISSION_STATUSES: SubmissionStatus[] = ["pending", "ready", "shipped"];
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
