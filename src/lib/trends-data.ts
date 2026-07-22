import "server-only";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderLines } from "@/db/schema";
import { businessToday } from "@/lib/buyer-data";

// Historical product trends for the buyer's projection graph.
//
// Only what the buyer actually *buys* is a series — the transform (skin,
// fingers, portioning, etc.) happens in-house, so those specs are ignored:
//   • Chicken Breast → split by Trim (Standard / Full Trim), measured in kg.
//   • Salmon        → split by Size, measured in NUMBER OF FISH.
//   • Other fish    → one series, number of fish.
//   • Beef / Pork / other meat cuts → one series each, no spec, measured in kg.
//   • "Other" free-text and the Other Preorders section are excluded.

export type TrendUnit = "kg" | "fish";

export interface TrendSeries {
  key: string; // e.g. "Chicken Breast — Full Trim", "Salmon 10/12", "Beef Shoulder"
  category: "Meat" | "Fish";
  unit: TrendUnit;
  total: number; // total over the fetched window (for default sort/selection)
  byDate: Record<string, number>; // delivery date (YYYY-MM-DD) → quantity
}

export interface ProductTrends {
  windowStart: string; // earliest date fetched (min for the date pickers)
  windowEnd: string; // latest date fetched (today)
  series: TrendSeries[];
}

/** How far back we fetch, so the date pickers can roam without a refetch. */
const WINDOW_DAYS = 180;

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toLocaleDateString(
    "en-CA",
    { timeZone: "America/Montreal" },
  );
}

export async function getProductTrends(): Promise<ProductTrends> {
  const windowEnd = businessToday();
  const windowStart = isoDaysAgo(WINDOW_DAYS);

  const rows = await db
    .select({
      deliveryDate: orders.deliveryDate,
      department: orders.department,
      product: orderLines.product,
      specsJson: orderLines.specsJson,
      quantity: orderLines.quantity,
      weight: orderLines.weight,
    })
    .from(orderLines)
    .innerJoin(orders, eq(orderLines.orderId, orders.id))
    .where(
      and(
        inArray(orders.department, ["meat", "fish"]),
        gte(orders.deliveryDate, windowStart),
        lte(orders.deliveryDate, windowEnd),
      ),
    );

  const map = new Map<string, TrendSeries>();

  for (const r of rows) {
    if (r.product === "Other") continue;
    const specs = (r.specsJson ?? {}) as Record<string, string>;

    let key: string;
    let unit: TrendUnit;
    let category: "Meat" | "Fish";
    let value: number;

    if (r.department === "fish") {
      category = "Fish";
      unit = "fish";
      value = r.quantity ?? 0;
      key =
        r.product === "Salmon" ? `Salmon ${specs.size ?? "?"}` : r.product;
    } else {
      category = "Meat";
      unit = "kg";
      value = r.weight ? Number.parseFloat(r.weight) : 0;
      if (!Number.isFinite(value)) value = 0;
      key =
        r.product === "Chicken Breast"
          ? `Chicken Breast — ${specs.trim ?? "Standard"}`
          : r.product;
    }

    if (value <= 0) continue;

    let s = map.get(key);
    if (!s) {
      s = { key, category, unit, total: 0, byDate: {} };
      map.set(key, s);
    }
    s.total += value;
    s.byDate[r.deliveryDate] = (s.byDate[r.deliveryDate] ?? 0) + value;
  }

  const series = [...map.values()].sort((a, b) => b.total - a.total);
  return { windowStart, windowEnd, series };
}
