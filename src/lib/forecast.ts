// Buyer Table "Forecast" view — what is going out, grouped by product + specs.
// Windows: Today, Tomorrow, Rest of week (tomorrow → the closest Sunday) and
// Full week. Rest of week overlaps Tomorrow, so the Full week total is built
// from the set of dates each ticked window covers — a date is never counted
// twice. Pure (no DB) so it can be tested.

import type { Department } from "@/db/schema";

export type ForecastWindow = "today" | "tomorrow" | "rest" | "week";
export const FORECAST_WINDOWS: ForecastWindow[] = ["today", "tomorrow", "rest", "week"];
export type ForecastPart = Exclude<ForecastWindow, "week">;

export interface ForecastTotal {
  quantity: number;
  weight: number;
  lines: number;
}

export interface ForecastGroup {
  department: Department;
  product: string;
  specs: string;
  /** Totals per delivery date (YYYY-MM-DD). */
  byDate: Record<string, ForecastTotal>;
}

export interface ForecastInputRow {
  department: Department;
  product: string;
  specs: string;
  deliveryDate: string;
  quantity: number | null;
  weight: string | null;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The closest Sunday on or after `date`. */
export function sundayOnOrAfter(date: string): string {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDays(date, (7 - day) % 7);
}

/** Every date from `from` to `to`, inclusive. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Dates each window covers. Rest of week = tomorrow → weekEnd. */
export function windowDates(
  today: string,
  tomorrow: string,
  weekEnd: string,
): Record<ForecastPart, string[]> {
  return {
    today: [today],
    tomorrow: [tomorrow],
    rest: dateRange(tomorrow, weekEnd),
  };
}

/**
 * Full week dates: the union of the ticked windows. An unticked Today or
 * Tomorrow always removes its day, even though Rest of week also covers
 * tomorrow — unticking a column must take it out of the total.
 */
export function weekDates(
  windows: Record<ForecastPart, string[]>,
  included: Record<ForecastPart, boolean>,
): string[] {
  const set = new Set<string>();
  for (const part of ["today", "tomorrow", "rest"] as ForecastPart[]) {
    if (included[part]) for (const d of windows[part]) set.add(d);
  }
  for (const part of ["today", "tomorrow"] as ForecastPart[]) {
    if (!included[part]) for (const d of windows[part]) set.delete(d);
  }
  return [...set];
}

export function sumDates(group: ForecastGroup, dates: string[]): ForecastTotal {
  const t: ForecastTotal = { quantity: 0, weight: 0, lines: 0 };
  for (const d of new Set(dates)) {
    const v = group.byDate[d];
    if (!v) continue;
    t.quantity += v.quantity;
    t.weight += v.weight;
    t.lines += v.lines;
  }
  return t;
}

export function buildForecast(rows: ForecastInputRow[]): ForecastGroup[] {
  const groups = new Map<string, ForecastGroup>();
  for (const row of rows) {
    const specs = row.specs.trim();
    const key = `${row.department}||${row.product}||${specs}`;
    let g = groups.get(key);
    if (!g) {
      g = { department: row.department, product: row.product, specs, byDate: {} };
      groups.set(key, g);
    }
    const t = (g.byDate[row.deliveryDate] ??= { quantity: 0, weight: 0, lines: 0 });
    const weight = row.weight ? Number(row.weight) : 0;
    t.quantity += row.quantity ?? 0;
    t.weight += Number.isFinite(weight) ? weight : 0;
    t.lines += 1;
  }
  return [...groups.values()].sort(
    (a, b) => a.product.localeCompare(b.product) || a.specs.localeCompare(b.specs),
  );
}
