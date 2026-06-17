"use server";

// Order Errors form — submit a standalone error report (SPEC: separate from
// orders, never in the buyer table). Admin/buyer/rep can submit; the table is
// buyer/admin only (enforced where it's read, not here).

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orderErrors } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { resolveClient } from "@/lib/clients";
import { formatExternalId } from "@/db/external-id";
import { isErrorDepartment, isErrorType } from "@/lib/labels";

export interface OrderErrorInput {
  customerName: string;
  errorDate: string; // YYYY-MM-DD
  orderNumber: string;
  errorType: string;
  department: string;
  note: string;
}

export type ErrorActionResult =
  | { ok: true; id: number }
  | { ok: false; error: string };

export async function createOrderError(
  input: OrderErrorInput,
): Promise<ErrorActionResult> {
  const user = await requireRole("rep", "buyer");

  const customerName = input.customerName?.trim();
  if (!customerName) return { ok: false, error: "Enter a customer name." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.errorDate)) {
    return { ok: false, error: "Choose a date." };
  }
  if (!isErrorType(input.errorType)) {
    return { ok: false, error: "Choose an error type." };
  }
  if (!isErrorDepartment(input.department)) {
    return { ok: false, error: "Choose a department." };
  }
  const errorType = input.errorType;
  const department = input.department;

  // Reuse the self-learning client list (find-or-create, canonical spelling)
  const client = await resolveClient(customerName, user);

  const id = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(orderErrors)
      .values({
        customerName: client.clientName,
        customerExternalId: client.externalId,
        errorDate: input.errorDate,
        orderNumber: input.orderNumber?.trim() || null,
        errorType,
        department,
        note: input.note?.trim() || null,
        submittedByUserId: user.id,
        submittedByName: user.name,
      })
      .returning({ id: orderErrors.id });

    await tx
      .update(orderErrors)
      .set({ externalId: formatExternalId("order_error", created.id) })
      .where(eq(orderErrors.id, created.id));

    await logAudit(tx, user, [
      {
        action: "create",
        recordType: "order_error",
        recordId: created.id,
        newValue: {
          customer: client.clientName,
          errorType: input.errorType,
          department: input.department,
          orderNumber: input.orderNumber,
        },
      },
    ]);

    return created.id;
  });

  revalidatePath("/buyer/errors");
  return { ok: true, id };
}
