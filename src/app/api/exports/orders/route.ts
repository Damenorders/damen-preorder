import { and, eq, inArray, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  orders,
  orderLines,
  type BuyerTableStatus,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { businessToday, businessTomorrow } from "@/lib/buyer-data";
import { isDepartment } from "@/lib/labels";
import { toCsv, csvResponse } from "@/lib/csv";

// Odoo-ready orders export — SPEC.md §21–23. One row per order line, flat.
// "id"-style columns carry the stable external IDs (§22) so repeated imports
// into Odoo never create duplicates. Buyer/admin only (§3.3: reps cannot
// export company data).

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role === "rep") {
    return new Response("Forbidden", { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const conditions: SQL[] = [];

  const delivery = params.get("delivery") ?? "all";
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

  const moduleParam = params.get("module");
  if (moduleParam && isDepartment(moduleParam)) {
    conditions.push(eq(orders.department, moduleParam));
  }
  const status = params.get("status");
  if (
    status &&
    ["pending", "ordered", "received", "pending_delivery", "pending_pickup"].includes(status)
  ) {
    conditions.push(eq(orders.buyerTableStatus, status as BuyerTableStatus));
  }

  const rows = await db
    .select({
      lineExternalId: orderLines.externalId,
      orderExternalId: orders.externalId,
      clientExternalId: orders.clientExternalId,
      department: orders.department,
      clientName: orders.clientName,
      deliveryDate: orders.deliveryDate,
      repName: orders.repName,
      repEmail: orders.repEmail,
      submissionStatus: orders.submissionStatus,
      buyerTableStatus: orders.buyerTableStatus,
      orderNotes: orders.notes,
      product: orderLines.product,
      specs: orderLines.specs,
      specsJson: orderLines.specsJson,
      quantity: orderLines.quantity,
      weight: orderLines.weight,
      lineNotes: orderLines.notes,
      odooId: orderLines.odooId,
      odooSyncStatus: orderLines.odooSyncStatus,
      lastSyncedAt: orderLines.lastSyncedAt,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    })
    .from(orderLines)
    .innerJoin(orders, eq(orderLines.orderId, orders.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(orders.deliveryDate, orders.id, orderLines.id);

  const headers = [
    "id", // line external_id → Odoo external id
    "order_id/id", // order external_id (sale.order)
    "partner_id/id", // client external_id (res.partner)
    "department",
    "client_name",
    "delivery_date",
    "rep_name",
    "rep_email",
    "submission_status",
    "buyer_table_status",
    "product",
    "specs",
    "specs_json",
    "quantity",
    "weight_kg",
    "line_notes",
    "order_notes",
    "odoo_id",
    "odoo_sync_status",
    "last_synced_at",
    "created_at",
    "updated_at",
  ];

  const csv = toCsv(
    headers,
    rows.map((r) => [
      r.lineExternalId,
      r.orderExternalId,
      r.clientExternalId,
      r.department,
      r.clientName,
      r.deliveryDate,
      r.repName,
      r.repEmail,
      r.submissionStatus,
      r.buyerTableStatus,
      r.product,
      r.specs,
      JSON.stringify(r.specsJson),
      r.quantity,
      r.weight,
      r.lineNotes,
      r.orderNotes,
      r.odooId,
      r.odooSyncStatus,
      r.lastSyncedAt?.toISOString(),
      r.createdAt.toISOString(),
      r.updatedAt.toISOString(),
    ]),
  );

  return csvResponse(`damen_orders_${businessToday()}.csv`, csv);
}
