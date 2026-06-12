import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  clients,
  orders,
  orderLines,
  products,
  type Department,
  type Order,
  type OrderLine,
  type SubmissionStatus,
  type User,
} from "@/db/schema";
import type { ProductFormConfig } from "@/lib/product-config";

export async function getActiveClients() {
  return db.query.clients.findMany({
    where: eq(clients.active, true),
    orderBy: clients.clientName,
    columns: { id: true, clientName: true, externalId: true },
  });
}

export async function getProductsForDepartment(department: Department) {
  const rows = await db.query.products.findMany({
    where: and(eq(products.department, department), eq(products.active, true)),
    orderBy: products.productName,
    columns: { id: true, productName: true, formConfig: true },
  });
  return rows.map((p) => ({
    id: p.id,
    productName: p.productName,
    formConfig: p.formConfig as ProductFormConfig,
  }));
}

// ---------------------------------------------------------------------------
// Submission views — what the submissions/edit pages render.
// IMPORTANT: buyer_table_status is intentionally ABSENT from this shape, so a
// rep can never receive it in any server payload (SPEC.md §12). The buyer
// table (Phase 3) uses its own buyer/admin-gated query.
// ---------------------------------------------------------------------------

export interface SubmissionLineView {
  id: number;
  product: string;
  specs: string;
  specsJson: Record<string, string>;
  quantity: number;
  weight: string | null;
  notes: string | null;
  productId: number | null;
}

export interface SubmissionView {
  id: number;
  externalId: string | null;
  department: Department;
  clientName: string;
  deliveryDate: string;
  repName: string;
  submissionStatus: SubmissionStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  lines: SubmissionLineView[];
}

function toSubmissionView(
  order: Order,
  lines: OrderLine[],
  productIdsByName: Map<string, number>,
): SubmissionView {
  return {
    id: order.id,
    externalId: order.externalId,
    department: order.department,
    clientName: order.clientName,
    deliveryDate: order.deliveryDate,
    repName: order.repName,
    submissionStatus: order.submissionStatus,
    notes: order.notes,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    lines: lines
      .filter((l) => l.orderId === order.id)
      .map((l) => ({
        id: l.id,
        product: l.product,
        specs: l.specs,
        specsJson: l.specsJson as Record<string, string>,
        quantity: l.quantity,
        weight: l.weight,
        notes: l.notes,
        productId: productIdsByName.get(l.product) ?? null,
      })),
  };
}

async function productIdMap(department: Department) {
  const rows = await db.query.products.findMany({
    where: eq(products.department, department),
    columns: { id: true, productName: true },
  });
  return new Map(rows.map((p) => [p.productName, p.id]));
}

/**
 * Submissions for one module (SPEC.md §13), earliest delivery date first
 * (per owner request, superseding the submission-date order), newest
 * submission first within the same delivery day.
 * Reps get only their own orders; buyers/admins get all.
 */
export async function getSubmissions(
  user: User,
  department: Department,
): Promise<SubmissionView[]> {
  const where =
    user.role === "rep"
      ? and(eq(orders.department, department), eq(orders.repUserId, user.id))
      : eq(orders.department, department);

  const orderRows = await db.query.orders.findMany({
    where,
    orderBy: [orders.deliveryDate, desc(orders.createdAt)],
  });
  if (orderRows.length === 0) return [];

  const lineRows = await db.query.orderLines.findMany({
    where: inArray(
      orderLines.orderId,
      orderRows.map((o) => o.id),
    ),
    orderBy: orderLines.id,
  });
  const idMap = await productIdMap(department);

  return orderRows.map((o) => toSubmissionView(o, lineRows, idMap));
}

/**
 * One order for the edit page, with permission verdict.
 * Rep edit rule (SPEC.md §16): own orders, Pending only.
 */
export async function getOrderForEdit(
  user: User,
  orderId: number,
): Promise<
  | { allowed: true; order: SubmissionView; clientId: number | null }
  | { allowed: false; reason: string }
> {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
  });
  if (!order) return { allowed: false, reason: "Order not found." };

  if (user.role === "rep") {
    if (order.repUserId !== user.id) {
      return { allowed: false, reason: "You can only edit your own submissions." };
    }
    if (order.submissionStatus !== "pending") {
      return {
        allowed: false,
        reason: "This order is no longer Pending, so it can't be edited. Contact the buyer if something must change.",
      };
    }
  }

  const lineRows = await db.query.orderLines.findMany({
    where: eq(orderLines.orderId, order.id),
    orderBy: orderLines.id,
  });
  const idMap = await productIdMap(order.department);
  const client = await db.query.clients.findFirst({
    where: eq(clients.clientName, order.clientName),
    columns: { id: true },
  });

  return {
    allowed: true,
    order: toSubmissionView(order, lineRows, idMap),
    clientId: client?.id ?? null,
  };
}
