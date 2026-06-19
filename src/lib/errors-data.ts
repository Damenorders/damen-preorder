import "server-only";
import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { orderErrors, type OrderError } from "@/db/schema";
import { isErrorDepartment, isErrorType } from "@/lib/labels";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface ErrorFilters {
  department?: string;
  errorType?: string;
  clientName?: string;
  dateFrom?: string; // error date >= this
  dateTo?: string; // error date <= this
}

// The dedicated Order Errors table — buyer/admin only (gated at the page).
export async function getOrderErrors(
  filters: ErrorFilters,
): Promise<OrderError[]> {
  const conditions: SQL[] = [];
  if (filters.department && isErrorDepartment(filters.department)) {
    conditions.push(eq(orderErrors.department, filters.department));
  }
  if (filters.errorType && isErrorType(filters.errorType)) {
    conditions.push(eq(orderErrors.errorType, filters.errorType));
  }
  if (filters.clientName) {
    conditions.push(eq(orderErrors.customerName, filters.clientName));
  }
  if (filters.dateFrom && ISO_DATE.test(filters.dateFrom)) {
    conditions.push(gte(orderErrors.errorDate, filters.dateFrom));
  }
  if (filters.dateTo && ISO_DATE.test(filters.dateTo)) {
    conditions.push(lte(orderErrors.errorDate, filters.dateTo));
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
