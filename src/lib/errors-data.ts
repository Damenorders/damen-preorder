import "server-only";
import { and, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { orderErrors, type OrderError } from "@/db/schema";
import { isDepartment, isErrorType } from "@/lib/labels";

export interface ErrorFilters {
  department?: string;
  errorType?: string;
  clientName?: string;
  date?: string; // error date
}

// The dedicated Order Errors table — buyer/admin only (gated at the page).
export async function getOrderErrors(
  filters: ErrorFilters,
): Promise<OrderError[]> {
  const conditions: SQL[] = [];
  if (filters.department && isDepartment(filters.department)) {
    conditions.push(eq(orderErrors.department, filters.department));
  }
  if (filters.errorType && isErrorType(filters.errorType)) {
    conditions.push(eq(orderErrors.errorType, filters.errorType));
  }
  if (filters.clientName) {
    conditions.push(eq(orderErrors.customerName, filters.clientName));
  }
  if (filters.date && /^\d{4}-\d{2}-\d{2}$/.test(filters.date)) {
    conditions.push(eq(orderErrors.errorDate, filters.date));
  }

  return db.query.orderErrors.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: [desc(orderErrors.errorDate), desc(orderErrors.createdAt)],
  });
}

export async function getErrorFilterOptions() {
  const rows = await db
    .selectDistinct({ customerName: orderErrors.customerName })
    .from(orderErrors)
    .orderBy(orderErrors.customerName);
  return { customers: rows.map((r) => r.customerName) };
}
