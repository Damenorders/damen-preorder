"use client";

// Buyer Table — Forecast view. One row per product + specs, totals per time
// window (Today, Tomorrow, Rest of week = tomorrow → closest Sunday, Full
// week). Each of the
// first three columns has a tick in its header: unticked, it is left out of
// the Full week total.

import { useState } from "react";
import { DEPARTMENTS, departmentLabels, weightUnit } from "@/lib/labels";
import { formatDate } from "@/lib/dates";
import {
  FORECAST_WINDOWS,
  sumDates,
  weekDates,
  windowDates,
  type ForecastGroup,
  type ForecastPart,
  type ForecastTotal,
  type ForecastWindow,
} from "@/lib/forecast";
import type { Department } from "@/db/schema";

const fmtWeight = (n: number) =>
  Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");

function Cell({ total, department }: { total: ForecastTotal; department: Department }) {
  if (total.lines === 0) return <span className="text-neutral-300">—</span>;
  return (
    <span className="flex flex-col items-end leading-tight">
      {total.quantity > 0 && (
        <span className="text-base font-semibold tabular-nums">{total.quantity}x</span>
      )}
      {total.weight > 0 && (
        <span
          className={`tabular-nums ${total.quantity > 0 ? "text-xs text-neutral-500" : "text-base font-semibold"}`}
        >
          {fmtWeight(total.weight)} {weightUnit(department)}
        </span>
      )}
      {total.quantity === 0 && total.weight === 0 && (
        <span className="text-xs text-neutral-500">
          {total.lines} line{total.lines === 1 ? "" : "s"}, no qty
        </span>
      )}
    </span>
  );
}

export default function BuyerForecast({
  groups,
  today,
  tomorrow,
  weekEnd,
}: {
  groups: ForecastGroup[];
  today: string;
  tomorrow: string;
  weekEnd: string;
}) {
  const short = (date: string) =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
      timeZone: "UTC",
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  const [included, setIncluded] = useState<Record<ForecastPart, boolean>>({
    today: true,
    tomorrow: true,
    rest: true,
  });
  const windows = windowDates(today, tomorrow, weekEnd);
  const fullWeek = weekDates(windows, included);
  const datesFor = (w: ForecastWindow) => (w === "week" ? fullWeek : windows[w]);
  // A column is faded when none of its dates are in the Full week total.
  const countsInWeek = (w: ForecastPart) => windows[w].some((d) => fullWeek.includes(d));
  const excluded = (["today", "tomorrow", "rest"] as ForecastPart[]).filter(
    (w) => !included[w],
  );

  const headers: Record<ForecastWindow, { title: string; sub: string }> = {
    today: { title: "Today", sub: short(today) },
    tomorrow: { title: "Tomorrow", sub: short(tomorrow) },
    rest: {
      title: "Rest of week",
      sub: tomorrow === weekEnd ? short(weekEnd) : `${short(tomorrow)} – ${short(weekEnd)}`,
    },
    week: {
      title: "Full week",
      sub: excluded.length
        ? `to ${short(weekEnd)} · without ${excluded
            .map((w) => (w === "rest" ? "rest of week" : w))
            .join(", ")}`
        : `to ${short(weekEnd)}`,
    },
  };

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-10 text-center text-neutral-500">
        Nothing going out between {formatDate(today)} and {formatDate(weekEnd)} for these
        filters.
      </div>
    );
  }

  const th = "px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500";

  return (
    <div className="flex flex-col gap-5">
      {DEPARTMENTS.map((dep) => {
        const list = groups.filter((g) => g.department === dep);
        if (list.length === 0) return null;
        return (
          <section
            key={dep}
            className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm"
          >
            <h2 className="border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-semibold">
              {departmentLabels[dep]}{" "}
              <span className="font-normal text-neutral-500">
                · {list.length} product{list.length === 1 ? "" : "s"}
              </span>
            </h2>
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Product · Specs
                  </th>
                  {FORECAST_WINDOWS.map((w) => (
                    <th
                      key={w}
                      className={`${th} ${w === "week" ? "border-l border-neutral-200 bg-accent-50" : ""}`}
                    >
                      {w === "week" ? (
                        headers[w].title
                      ) : (
                        <label
                          className="inline-flex cursor-pointer items-center justify-end gap-1.5"
                          title="Include in Full week"
                        >
                          <input
                            type="checkbox"
                            checked={included[w]}
                            onChange={() =>
                              setIncluded((prev) => ({ ...prev, [w]: !prev[w] }))
                            }
                            aria-label={`Include ${headers[w].title} in Full week`}
                            className="h-4 w-4 cursor-pointer accent-accent-600"
                          />
                          {headers[w].title}
                        </label>
                      )}
                      <span className="block text-[11px] font-normal normal-case tracking-normal text-neutral-400">
                        {headers[w].sub}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((g, i) => (
                  <tr
                    key={`${g.product}||${g.specs}`}
                    className={i % 2 === 1 ? "bg-neutral-50" : "bg-white"}
                  >
                    <td className="border-b border-neutral-100 px-3 py-2 align-top">
                      <span className="font-medium">{g.product}</span>
                      {g.specs && (
                        <span className="block text-sm text-neutral-600">{g.specs}</span>
                      )}
                    </td>
                    {FORECAST_WINDOWS.map((w) => (
                      <td
                        key={w}
                        className={`border-b border-neutral-100 px-3 py-2 text-right align-top ${
                          w === "week"
                            ? "border-l border-neutral-200 bg-accent-50/60"
                            : included[w] && countsInWeek(w)
                              ? ""
                              : "opacity-40"
                        }`}
                      >
                        <Cell
                          total={sumDates(g, datesFor(w))}
                          department={g.department}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
