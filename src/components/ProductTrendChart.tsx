"use client";

// Historical product-order graph for projecting weekly buying. A day-by-day
// line (one per selected product/variant) across a chosen date range, plus a
// "typical week" table: the average ordered per weekday (Mon–Sat) with a
// weekly total. Multi-select the products to compare — pick one for a simple
// view, several to overlay.

import { useMemo, useState } from "react";
import type { ProductTrends, TrendUnit } from "@/lib/trends-data";

const COLORS = [
  "#dc2626", // red
  "#2563eb", // blue
  "#16a34a", // green
  "#d97706", // amber
  "#7c3aed", // violet
  "#db2777", // pink
  "#0891b2", // cyan
  "#65a30d", // lime
];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// UTC date math so day arithmetic never drifts with the local timezone.
function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
/** 0..5 for Mon..Sat, or null for Sunday (not shown). */
function monSatIndex(dateStr: string): number | null {
  const [y, m, d] = dateStr.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 Sun..6 Sat
  return day === 0 ? null : day - 1;
}
function eachDate(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}
function shortMD(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${m}/${d}`;
}
const WEEKDAY_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
/** "Monday, Jul 20" for the hover tooltip. */
function labelDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${WEEKDAY_FULL[dt.getUTCDay()]}, ${MONTHS[m - 1]} ${d}`;
}
function fmt(value: number, unit: TrendUnit): string {
  if (unit === "fish") return Math.round(value).toString();
  return value % 1 === 0 ? value.toString() : value.toFixed(1);
}

export default function ProductTrendChart({ trends }: { trends: ProductTrends }) {
  const { series, windowStart, windowEnd } = trends;

  const [start, setStart] = useState(() => {
    const monthAgo = addDays(windowEnd, -27);
    return monthAgo < windowStart ? windowStart : monthAgo;
  });
  const [end, setEnd] = useState(windowEnd);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(series.slice(0, 1).map((s) => s.key)),
  );
  const [openMenu, setOpenMenu] = useState<"Meat" | "Fish" | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const colorFor = (key: string) =>
    COLORS[Math.max(0, series.findIndex((s) => s.key === key)) % COLORS.length];

  const dates = useMemo(
    () => (start <= end ? eachDate(start, end) : []),
    [start, end],
  );
  const shownSeries = useMemo(
    () => series.filter((s) => selected.has(s.key)),
    [series, selected],
  );

  const maxVal = useMemo(() => {
    let m = 0;
    for (const s of shownSeries)
      for (const d of dates) m = Math.max(m, s.byDate[d] ?? 0);
    return m || 1;
  }, [shownSeries, dates]);

  // Average per weekday (Mon–Sat) across the range, + projected weekly total.
  const weekly = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0];
    for (const d of dates) {
      const wd = monSatIndex(d);
      if (wd !== null) counts[wd] += 1;
    }
    return shownSeries.map((s) => {
      const sums = [0, 0, 0, 0, 0, 0];
      for (const d of dates) {
        const wd = monSatIndex(d);
        if (wd !== null) sums[wd] += s.byDate[d] ?? 0;
      }
      const avgs = sums.map((sum, i) => (counts[i] ? sum / counts[i] : 0));
      const total = avgs.reduce((a, b) => a + b, 0);
      return { series: s, avgs, total };
    });
  }, [shownSeries, dates]);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // SVG geometry
  const W = 760;
  const H = 280;
  const padL = 44;
  const padR = 16;
  const padT = 12;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const xAt = (i: number) =>
    padL + (dates.length <= 1 ? 0 : (i / (dates.length - 1)) * plotW);
  const yAt = (v: number) => padT + plotH - (v / maxVal) * plotH;

  const yTicks = Array.from({ length: 5 }, (_, i) => (maxVal / 4) * i);
  const xLabelStep = Math.max(1, Math.ceil(dates.length / 6));

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">
            Weekly Order Trends
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Historical order volume by product — project your weekly buying.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-600">
          <label className="flex items-center gap-1">
            From
            <input
              type="date"
              value={start}
              min={windowStart}
              max={end}
              onChange={(e) => setStart(e.target.value)}
              className="rounded-lg border border-neutral-300 px-2 py-1 outline-none focus:border-accent-500"
            />
          </label>
          <label className="flex items-center gap-1">
            To
            <input
              type="date"
              value={end}
              min={start}
              max={windowEnd}
              onChange={(e) => setEnd(e.target.value)}
              className="rounded-lg border border-neutral-300 px-2 py-1 outline-none focus:border-accent-500"
            />
          </label>
        </div>
      </div>

      {/* Product filter — one multi-select dropdown card per section */}
      <div className="mt-4 flex flex-wrap gap-3">
        {(["Meat", "Fish"] as const).map((cat) => {
          const items = series.filter((s) => s.category === cat);
          if (items.length === 0) return null;
          const chosen = items.filter((s) => selected.has(s.key));
          const open = openMenu === cat;
          return (
            <div key={cat} className="relative min-w-[13rem] flex-1">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                {cat}
              </p>
              <button
                type="button"
                onClick={() => setOpenMenu(open ? null : cat)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 outline-none transition hover:border-neutral-400 focus:border-accent-500"
              >
                <span className="truncate">
                  {chosen.length === 0
                    ? `Select ${cat.toLowerCase()}…`
                    : chosen.map((s) => s.key).join(", ")}
                </span>
                <span aria-hidden className="shrink-0 text-neutral-400">
                  ▾
                </span>
              </button>

              {open && (
                <>
                  <button
                    type="button"
                    aria-hidden
                    tabIndex={-1}
                    onClick={() => setOpenMenu(null)}
                    className="fixed inset-0 z-10 cursor-default"
                  />
                  <div className="absolute left-0 z-20 mt-1 max-h-80 w-full min-w-[15rem] overflow-y-auto rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
                    <div className="flex items-center justify-between px-3 py-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                        {chosen.length} selected
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            items.forEach((s) => next.delete(s.key));
                            return next;
                          })
                        }
                        disabled={chosen.length === 0}
                        className="text-xs font-medium text-accent-700 transition hover:underline disabled:text-neutral-300 disabled:no-underline"
                      >
                        Clear all
                      </button>
                    </div>
                    {items.map((s) => (
                      <label
                        key={s.key}
                        className="flex cursor-pointer items-center gap-2 border-t border-neutral-100 px-3 py-1.5 text-sm hover:bg-neutral-50"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(s.key)}
                          onChange={() => toggle(s.key)}
                          className="h-3.5 w-3.5 accent-accent-600"
                        />
                        <span
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: colorFor(s.key) }}
                        />
                        <span className="text-neutral-800">{s.key}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {shownSeries.length === 0 || dates.length === 0 ? (
        <p className="mt-6 rounded-xl bg-neutral-50 px-4 py-10 text-center text-sm text-neutral-400">
          {series.length === 0
            ? "No order history yet."
            : "Pick a product above to see its trend."}
        </p>
      ) : (
        <>
          {/* Day-by-day line chart */}
          <div className="relative mt-4 w-full">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="h-auto w-full"
              role="img"
              aria-label="Order volume over time"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const xView = ((e.clientX - rect.left) / rect.width) * W;
                const i =
                  dates.length <= 1
                    ? 0
                    : Math.round(
                        ((xView - padL) / plotW) * (dates.length - 1),
                      );
                setHoverIdx(Math.max(0, Math.min(dates.length - 1, i)));
              }}
              onMouseLeave={() => setHoverIdx(null)}
            >
              {yTicks.map((t, i) => (
                <g key={i}>
                  <line
                    x1={padL}
                    x2={W - padR}
                    y1={yAt(t)}
                    y2={yAt(t)}
                    stroke="#f1f5f9"
                  />
                  <text
                    x={padL - 6}
                    y={yAt(t) + 3}
                    textAnchor="end"
                    className="fill-neutral-400 text-[9px]"
                  >
                    {fmt(t, shownSeries[0].unit)}
                  </text>
                </g>
              ))}

              {dates.map((d, i) =>
                i % xLabelStep === 0 || i === dates.length - 1 ? (
                  <text
                    key={d}
                    x={xAt(i)}
                    y={H - 8}
                    textAnchor="middle"
                    className="fill-neutral-400 text-[9px]"
                  >
                    {shortMD(d)}
                  </text>
                ) : null,
              )}

              {shownSeries.map((s) => (
                <polyline
                  key={s.key}
                  fill="none"
                  stroke={colorFor(s.key)}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={dates
                    .map((d, i) => `${xAt(i)},${yAt(s.byDate[d] ?? 0)}`)
                    .join(" ")}
                />
              ))}

              {/* Hover guide + point markers */}
              {hoverIdx !== null && (
                <g pointerEvents="none">
                  <line
                    x1={xAt(hoverIdx)}
                    x2={xAt(hoverIdx)}
                    y1={padT}
                    y2={padT + plotH}
                    stroke="#cbd5e1"
                    strokeDasharray="3 3"
                  />
                  {shownSeries.map((s) => (
                    <circle
                      key={s.key}
                      cx={xAt(hoverIdx)}
                      cy={yAt(s.byDate[dates[hoverIdx]] ?? 0)}
                      r={3.5}
                      fill="#fff"
                      stroke={colorFor(s.key)}
                      strokeWidth={2}
                    />
                  ))}
                </g>
              )}
            </svg>

            {/* Hover tooltip: date (weekday) + amount sold per series */}
            {hoverIdx !== null && (
              <div
                className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs shadow-lg"
                style={{ left: `${(xAt(hoverIdx) / W) * 100}%` }}
              >
                <p className="whitespace-nowrap font-semibold text-neutral-800">
                  {labelDate(dates[hoverIdx])}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {shownSeries.map((s) => (
                    <li
                      key={s.key}
                      className="flex items-center gap-2 whitespace-nowrap"
                    >
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: colorFor(s.key) }}
                      />
                      <span className="text-neutral-500">{s.key}</span>
                      <span className="ml-auto pl-2 font-medium tabular-nums text-neutral-900">
                        {fmt(s.byDate[dates[hoverIdx]] ?? 0, s.unit)}
                        <span className="ml-0.5 text-neutral-400">
                          {s.unit === "fish" ? "fish" : "kg"}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Typical week — average per weekday + weekly total */}
          <div className="mt-5 overflow-x-auto">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Average per day · projected week
            </p>
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr className="text-neutral-400">
                  <th className="py-1 pr-3 font-medium">Product</th>
                  {WEEKDAYS.map((w) => (
                    <th key={w} className="px-2 py-1 text-right font-medium">
                      {w}
                    </th>
                  ))}
                  <th className="pl-3 py-1 text-right font-semibold text-neutral-500">
                    Week total
                  </th>
                </tr>
              </thead>
              <tbody>
                {weekly.map(({ series: s, avgs, total }) => (
                  <tr key={s.key} className="border-t border-neutral-100">
                    <td className="py-1.5 pr-3">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: colorFor(s.key) }}
                        />
                        <span className="font-medium text-neutral-800">
                          {s.key}
                        </span>
                        <span className="text-neutral-400">
                          ({s.unit === "fish" ? "fish" : "kg"})
                        </span>
                      </span>
                    </td>
                    {avgs.map((a, i) => (
                      <td
                        key={i}
                        className="px-2 py-1.5 text-right tabular-nums text-neutral-600"
                      >
                        {a === 0 ? "—" : fmt(a, s.unit)}
                      </td>
                    ))}
                    <td className="pl-3 py-1.5 text-right font-semibold tabular-nums text-neutral-900">
                      {fmt(total, s.unit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
