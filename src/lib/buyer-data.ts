import "server-only";
import {
  and,
  desc,
  eq,
  inArray,
  sql,
  type AnyColumn,
  type SQL,
} from "drizzle-orm";
import { db } from "@/db";
import {
  orders,
  orderLines,
  products,
  type BuyerTableStatus,
  type Department,
  type SubmissionStatus,
} from "@/db/schema";
import { isDepartment } from "@/lib/labels";
import type { SubmissionView } from "@/lib/orders-data";

// Today/tomorrow in the business timezone (SPEC.md §18 default view).
export function businessToday(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Montreal",
  });
}
export function businessTomorrow(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Montreal" });
}

function onBusinessDate(column: AnyColumn, date: string): SQL {
  return sql`(${column} at time zone 'America/Montreal')::date = ${date}`;
}

// ---------------------------------------------------------------------------
// All Submissions — SPEC.md §14
// ---------------------------------------------------------------------------

export interface SubmissionFilters {
  department?: string;
  status?: string; // submission status
  clientName?: string;
  repName?: string;
  product?: string;
  deliveryDate?: string;
  createdDate?: string; // "submission date"
  updatedDate?: string;
  hasNotes?: boolean;
}

export async function getAllSubmissions(
  filters: SubmissionFilters,
): Promise<SubmissionView[]> {
  const conditions: SQL[] = [];
  if (filters.department && isDepartment(filters.department)) {
    conditions.push(eq(orders.department, filters.department));
  }
  if (
    filters.status &&
    ["pending", "ready", "shipped"].includes(filters.status)
  ) {
    conditions.push(
      eq(orders.submissionStatus, filters.status as SubmissionStatus),
    );
  }
  if (filters.clientName) conditions.push(eq(orders.clientName, filters.clientName));
  if (filters.repName) conditions.push(eq(orders.repName, filters.repName));
  if (filters.deliveryDate) conditions.push(eq(orders.deliveryDate, filters.deliveryDate));
  if (filters.createdDate) conditions.push(onBusinessDate(orders.createdAt, filters.createdDate));
  if (filters.updatedDate) conditions.push(onBusinessDate(orders.updatedAt, filters.updatedDate));

  const orderRows = await db.query.orders.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    // earliest delivery first; newest submission within the same day
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

  const productRows = await db.query.products.findMany({
    columns: { id: true, productName: true },
  });
  const idMap = new Map(productRows.map((p) => [p.productName, p.id]));

  let views: SubmissionView[] = orderRows.map((o) => ({
    id: o.id,
    externalId: o.externalId,
    department: o.department,
    clientName: o.clientName,
    deliveryDate: o.deliveryDate,
    repName: o.repName,
    submissionStatus: o.submissionStatus,
    notes: o.notes,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    lines: lineRows
      .filter((l) => l.orderId === o.id)
      .map((l) => ({
        id: l.id,
        product: l.product,
        specs: l.specs,
        specsJson: l.specsJson as Record<string, string>,
        quantity: l.quantity,
        weight: l.weight,
        notes: l.notes,
        productId: idMap.get(l.product) ?? null,
      })),
  }));

  if (filters.product) {
    views = views.filter((v) =>
      v.lines.some((l) => l.product === filters.product),
    );
  }
  if (filters.hasNotes) {
    views = views.filter(
      (v) => v.notes || v.lines.some((l) => l.notes),
    );
  }
  return views;
}

// ---------------------------------------------------------------------------
// Buyer Table — SPEC.md §17–19. One row per order line; status lives on the
// parent order. Sorted: delivery date → status priority → updated time.
// ---------------------------------------------------------------------------

export interface BuyerTableFilters {
  status?: string; // buyer table status | "all"
  delivery?: string; // "today_tomorrow" (default) | "today" | "tomorrow" | "all" | YYYY-MM-DD
  departments?: string[]; // any combination of meat | fish | other
  clientName?: string;
  repName?: string;
  product?: string;
  createdDate?: string;
  updatedDate?: string;
  hasNotes?: boolean;
  /**
   * Two independent, combinable sort toggles:
   * - statusFirst: status priority becomes the primary key (Pending top,
   *   Received bottom); off = SPEC.md §19 (delivery date first).
   * - newestFirst: delivery dates run newest → oldest; off = soonest first.
   */
  statusFirst?: boolean;
  newestFirst?: boolean;
}

export interface BuyerTableRow {
  lineId: number;
  orderId: number;
  orderExternalId: string | null;
  clientName: string;
  status: BuyerTableStatus;
  deliveryDate: string;
  department: Department;
  product: string;
  specs: string;
  quantity: number;
  weight: string | null;
  lineNotes: string | null;
  orderNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  repName: string;
}

const BUYER_STATUSES: BuyerTableStatus[] = [
  "pending",
  "ordered",
  "received",
  "pending_delivery",
  "pending_pickup",
];

// SPEC.md §19 — Pending first, Received always last.
const STATUS_PRIORITY = sql`case ${orders.buyerTableStatus}
  when 'pending' then 1
  when 'ordered' then 2
  when 'pending_delivery' then 3
  when 'pending_pickup' then 4
  when 'received' then 5
  else 6 end`;

export async function getBuyerTable(
  filters: BuyerTableFilters,
): Promise<BuyerTableRow[]> {
  const conditions: SQL[] = [];

  if (filters.status && filters.status !== "all") {
    if (BUYER_STATUSES.includes(filters.status as BuyerTableStatus)) {
      conditions.push(
        eq(orders.buyerTableStatus, filters.status as BuyerTableStatus),
      );
    }
  }

  const delivery = filters.delivery ?? "today_tomorrow";
  if (delivery === "today_tomorrow") {
    conditions.push(
      inArray(orders.deliveryDate, [businessToday(), businessTomorrow()]),
    );
  } else if (delivery === "today") {
    conditions.push(eq(orders.deliveryDate, businessToday()));
  } else if (delivery === "tomorrow") {
    conditions.push(eq(orders.deliveryDate, businessTomorrow()));
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(delivery)) {
    conditions.push(eq(orders.deliveryDate, delivery));
  }
  // "all" → no delivery condition

  const departments = (filters.departments ?? []).filter(isDepartment);
  if (departments.length > 0) {
    conditions.push(inArray(orders.department, departments));
  }
  if (filters.clientName) conditions.push(eq(orders.clientName, filters.clientName));
  if (filters.repName) conditions.push(eq(orders.repName, filters.repName));
  if (filters.product) conditions.push(eq(orderLines.product, filters.product));
  if (filters.createdDate) conditions.push(onBusinessDate(orders.createdAt, filters.createdDate));
  if (filters.updatedDate) conditions.push(onBusinessDate(orders.updatedAt, filters.updatedDate));
  if (filters.hasNotes) {
    conditions.push(
      sql`(${orders.notes} is not null or ${orderLines.notes} is not null)`,
    );
  }

  const rows = await db
    .select({
      lineId: orderLines.id,
      orderId: orders.id,
      orderExternalId: orders.externalId,
      clientName: orders.clientName,
      status: orders.buyerTableStatus,
      deliveryDate: orders.deliveryDate,
      department: orders.department,
      product: orderLines.product,
      specs: orderLines.specs,
      quantity: orderLines.quantity,
      weight: orderLines.weight,
      lineNotes: orderLines.notes,
      orderNotes: orders.notes,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
      repName: orders.repName,
    })
    .from(orderLines)
    .innerJoin(orders, eq(orderLines.orderId, orders.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(
      ...(() => {
        const dateKey = filters.newestFirst
          ? desc(orders.deliveryDate)
          : orders.deliveryDate;
        return filters.statusFirst
          ? [STATUS_PRIORITY, dateKey, desc(orders.updatedAt), orderLines.id]
          : [dateKey, STATUS_PRIORITY, desc(orders.updatedAt), orderLines.id];
      })(),
    );

  return rows;
}

// ---------------------------------------------------------------------------
// Filter dropdown options
// ---------------------------------------------------------------------------

export async function getFilterOptions() {
  const [clientRows, repRows, productRows] = await Promise.all([
    db
      .selectDistinct({ clientName: orders.clientName })
      .from(orders)
      .orderBy(orders.clientName),
    db
      .selectDistinct({ repName: orders.repName })
      .from(orders)
      .orderBy(orders.repName),
    db.query.products.findMany({
      where: eq(products.active, true),
      orderBy: products.productName,
      columns: { productName: true },
    }),
  ]);
  return {
    clients: clientRows.map((r) => r.clientName),
    reps: repRows.map((r) => r.repName),
    // names can repeat across departments (e.g. "Other") — list each once
    products: [...new Set(productRows.map((p) => p.productName))],
  };
}

export type { SubmissionView };
