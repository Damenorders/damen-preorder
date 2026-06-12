import "server-only";
import { and, eq, inArray, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  orders,
  orderLines,
  type BuyerTableStatus,
  type Department,
} from "@/db/schema";
import { isDepartment } from "@/lib/labels";
import { businessToday, businessTomorrow } from "@/lib/buyer-data";

// Grouped buying sheet — SPEC.md §20. Groups order lines by delivery date +
// product + specs and totals them, so the buyer never adds quantities by hand.

export interface BuyingSheetFilters {
  delivery?: string; // "today_tomorrow" (default) | "today" | "tomorrow" | "all" | YYYY-MM-DD
  status?: string; // buyer table status | "all" (default "pending" = still to buy)
  department?: string;
}

export interface BuyingSheetGroup {
  deliveryDate: string;
  department: Department;
  product: string;
  specs: string;
  totalQuantity: number;
  totalWeight: number;
  clientCount: number;
  clients: string[];
}

const BUYER_STATUSES: BuyerTableStatus[] = [
  "pending",
  "ordered",
  "received",
  "pending_delivery",
  "pending_pickup",
];

export async function getBuyingSheet(
  filters: BuyingSheetFilters,
): Promise<BuyingSheetGroup[]> {
  const conditions: SQL[] = [];

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

  const status = filters.status ?? "pending";
  if (status !== "all" && BUYER_STATUSES.includes(status as BuyerTableStatus)) {
    conditions.push(eq(orders.buyerTableStatus, status as BuyerTableStatus));
  }
  if (filters.department && isDepartment(filters.department)) {
    conditions.push(eq(orders.department, filters.department));
  }

  const rows = await db
    .select({
      deliveryDate: orders.deliveryDate,
      department: orderLines.department,
      product: orderLines.product,
      specs: orderLines.specs,
      quantity: orderLines.quantity,
      weight: orderLines.weight,
      clientName: orders.clientName,
    })
    .from(orderLines)
    .innerJoin(orders, eq(orderLines.orderId, orders.id))
    .where(conditions.length ? and(...conditions) : undefined);

  const groups = new Map<string, BuyingSheetGroup & { clientSet: Set<string> }>();
  for (const row of rows) {
    const key = `${row.deliveryDate}||${row.product}||${row.specs}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        deliveryDate: row.deliveryDate,
        department: row.department,
        product: row.product,
        specs: row.specs,
        totalQuantity: 0,
        totalWeight: 0,
        clientCount: 0,
        clients: [],
        clientSet: new Set<string>(),
      };
      groups.set(key, group);
    }
    group.totalQuantity += row.quantity;
    group.totalWeight += row.weight ? Number(row.weight) : 0;
    group.clientSet.add(row.clientName);
  }

  return [...groups.values()]
    .map(({ clientSet, ...g }) => ({
      ...g,
      clientCount: clientSet.size,
      clients: [...clientSet].sort(),
    }))
    .sort(
      (a, b) =>
        a.deliveryDate.localeCompare(b.deliveryDate) ||
        a.product.localeCompare(b.product) ||
        a.specs.localeCompare(b.specs),
    );
}
