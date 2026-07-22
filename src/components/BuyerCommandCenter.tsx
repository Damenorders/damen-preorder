"use client";

// Buyer Command Center — one screen with everything happening for a day.
// Submissions grouped by department (Meat/Fish/Other) with editable submission
// status, plus pickups with an editable pickup status. A Today / Tomorrow /
// Both toggle filters the whole page client-side (both days are fetched up
// front, so toggling is instant). Statuses are a single shared value, so — like
// the pickups board — the page live-syncs every 15s to surface others' edits.

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/dates";
import StatusSelect from "@/components/StatusSelect";
import { setPickupStatus } from "@/app/actions/pickups";
import { DEPARTMENTS, departmentLabels, weightUnit } from "@/lib/labels";
import type { Department, PickupStatus, SubmissionStatus } from "@/db/schema";

export interface DashboardOrderLine {
  product: string;
  specs: string;
  quantity: number | null;
  weight: string | null;
}

// Submissions-style order within a card: by day, then Pending → Ready →
// Shipped, then client name.
const STATUS_RANK: Record<SubmissionStatus, number> = {
  pending: 0,
  ready: 1,
  shipped: 2,
};
function compareOrders(a: DashboardOrderRow, b: DashboardOrderRow): number {
  if (a.deliveryDate !== b.deliveryDate)
    return a.deliveryDate.localeCompare(b.deliveryDate);
  const rank = STATUS_RANK[a.submissionStatus] - STATUS_RANK[b.submissionStatus];
  return rank !== 0 ? rank : a.clientName.localeCompare(b.clientName);
}

// Compact date for whole-week rows, e.g. "Wed, Jul 23".
function shortDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    timeZone: "America/Montreal",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// "10KG THIGH" / "25KG BREAST" — qty-or-weight + product, nothing else, so the
// buyer sees the whole order in one glance. For free-text "Other" lines (the
// whole Other section, or an "Other" product inside Meat/Fish) the typed
// description IS the product, so we show what the rep actually wrote.
function lineLabel(line: DashboardOrderLine, department: Department): string {
  const unit = weightUnit(department);
  const measure = line.weight
    ? `${line.weight}${unit.toUpperCase()} `
    : line.quantity != null
      ? `${line.quantity} `
      : "";
  const isOther = department === "other" || line.product === "Other";
  const text = isOther && line.specs ? line.specs : line.product;
  return `${measure}${text}`;
}

export interface DashboardOrderRow {
  id: number;
  externalId: string | null;
  department: Department;
  clientName: string;
  repName: string;
  deliveryDate: string;
  submissionStatus: SubmissionStatus;
  lineCount: number;
  hasNotes: boolean;
  lines: DashboardOrderLine[];
}

export interface DashboardPickupRow {
  id: number;
  supplierName: string;
  poNumber: string;
  pickupDate: string;
  driver: string | null;
  amountOfStock: string;
  status: PickupStatus;
}

type DayChoice = "today" | "tomorrow" | "both";

// Coloured top accent per department, matching the dashboard card corners.
const deptAccent: Record<Department, string> = {
  meat: "border-t-red-500",
  fish: "border-t-blue-500",
  other: "border-t-orange-500",
  warehouse: "border-t-neutral-400",
};
const deptEmoji: Record<Department, string> = {
  meat: "🥩",
  fish: "🐟",
  other: "🧺",
  warehouse: "📦",
};

// Inline pickup status control (Pending ↔ Picked up) — mirrors StatusSelect's
// look so the whole page reads consistently.
function PickupStatusToggle({
  pickupId,
  value,
}: {
  pickupId: number;
  value: PickupStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const done = value === "picked_up";
  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as PickupStatus;
        startTransition(async () => {
          const res = await setPickupStatus(pickupId, next);
          if (res.ok) router.refresh();
        });
      }}
      aria-label="Pickup status"
      className={`rounded-lg border px-1.5 py-1 text-xs font-medium outline-none focus:ring-2 focus:ring-accent-100 disabled:opacity-50 ${
        done
          ? "border-green-300 bg-green-100 text-green-800"
          : "border-amber-300 bg-amber-100 text-amber-900"
      }`}
    >
      <option value="pending" className="bg-white text-neutral-900">
        Pending
      </option>
      <option value="picked_up" className="bg-white text-neutral-900">
        Picked up
      </option>
    </select>
  );
}

function ToggleButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-accent-600 text-white shadow-sm"
          : "text-neutral-600 hover:bg-white hover:text-neutral-900"
      }`}
    >
      {label}
    </button>
  );
}

export default function BuyerCommandCenter({
  today,
  tomorrow,
  orders,
  pickups,
}: {
  today: string;
  tomorrow: string;
  orders: DashboardOrderRow[];
  pickups: DashboardPickupRow[];
}) {
  const router = useRouter();
  const [day, setDay] = useState<DayChoice>("tomorrow");
  const [openId, setOpenId] = useState<number | null>(null);

  // Live sync: shared statuses should surface on every open session. Poll every
  // 15s (skip while the tab is hidden), same approach as the pickups board.
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [router]);

  const dates = useMemo(() => {
    if (day === "today") return [today];
    if (day === "tomorrow") return [tomorrow];
    return [today, tomorrow];
  }, [day, today, tomorrow]);

  const shownOrders = useMemo(
    () => orders.filter((o) => dates.includes(o.deliveryDate)),
    [orders, dates],
  );
  const shownPickups = useMemo(
    () => pickups.filter((p) => dates.includes(p.pickupDate)),
    [pickups, dates],
  );

  const ordersByDept = useMemo(() => {
    const map = new Map<Department, DashboardOrderRow[]>();
    DEPARTMENTS.forEach((d) => map.set(d, []));
    orders.forEach((o) => {
      if (o.department === "other") {
        // Other Preorders: show the whole week, independent of the day toggle.
        map.get("other")?.push(o);
      } else if (dates.includes(o.deliveryDate)) {
        // Meat/Fish: only the selected day(s).
        map.get(o.department)?.push(o);
      }
    });
    // Every section reads like the Submissions view: by day, then Pending on
    // top, Ready under, Shipped at the bottom of that day.
    DEPARTMENTS.forEach((d) => map.get(d)?.sort(compareOrders));
    return map;
  }, [orders, dates]);

  const dateLabel =
    day === "both"
      ? `${formatDate(today)} + ${formatDate(tomorrow)}`
      : formatDate(day === "today" ? today : tomorrow);

  const totalOrders = shownOrders.length;

  function renderDept(dep: Department) {
    const rows = ordersByDept.get(dep) ?? [];
    // Fixed body height so cards never grow/shift as orders come in: Meat/Fish
    // hold 10 rows, Other holds 4. Anything beyond scrolls within the card.
    const bodyHeight = dep === "other" ? "h-[15rem]" : "h-[38rem]";
    return (
      <section
        className={`overflow-hidden rounded-2xl border border-t-4 border-neutral-200 bg-white shadow-sm ${deptAccent[dep]}`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
            <span aria-hidden>{deptEmoji[dep]}</span>
            {departmentLabels[dep]}
          </h3>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
            {rows.length}
          </span>
        </div>
        <div className={`${bodyHeight} overflow-y-auto`}>
          {rows.length === 0 ? (
            <p className="flex h-full items-center justify-center px-4 text-center text-xs text-neutral-400">
              Nothing scheduled.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {rows.map((o) => {
              const open = openId === o.id;
              return (
                <li key={o.id}>
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : o.id)}
                      aria-expanded={open}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-sm font-medium text-neutral-900">
                        {o.clientName}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-neutral-400">
                        {o.lineCount} line{o.lineCount === 1 ? "" : "s"}
                        {o.hasNotes && " · 📝 notes"}
                        {dep === "other"
                          ? ` · ${shortDate(o.deliveryDate)}`
                          : day === "both"
                            ? ` · ${o.deliveryDate === today ? "Today" : "Tomorrow"}`
                            : ""}
                      </span>
                    </button>
                    <StatusSelect
                      kind="submission"
                      orderId={o.id}
                      value={o.submissionStatus}
                      compact
                    />
                  </div>
                  {open && (
                    <div className="relative border-t border-neutral-100 bg-neutral-50/60 px-4 py-3">
                      {/* ⓘ — hover/focus for the full specs, not just the glance. */}
                      {o.lines.some((l) => l.specs) && (
                        <div className="group/info absolute right-2 top-2">
                          <span
                            tabIndex={0}
                            role="button"
                            aria-label="Show full specs"
                            className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-neutral-300 text-[10px] font-semibold italic text-neutral-400 transition hover:border-accent-500 hover:text-accent-600"
                          >
                            i
                          </span>
                          <div className="absolute right-0 top-6 z-30 hidden max-h-64 w-64 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-3 text-left text-xs shadow-lg group-hover/info:block group-focus-within/info:block">
                            <ul className="space-y-2">
                              {o.lines.map((l, i) => (
                                <li key={i}>
                                  <span className="font-semibold text-neutral-800">
                                    {l.product}
                                  </span>
                                  {l.specs && (
                                    <span className="mt-0.5 block text-neutral-500">
                                      {l.specs}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                      {o.lines.length === 0 ? (
                        <p className="text-xs text-neutral-400">No products.</p>
                      ) : (
                        <ul className="space-y-1 pr-6 text-sm font-medium text-neutral-800">
                          {o.lines.map((l, i) => (
                            <li key={i}>{lineLabel(l, o.department)}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
              })}
            </ul>
          )}
        </div>
      </section>
    );
  }

  const pickupsCard = (
    <section className="overflow-hidden rounded-2xl border border-t-4 border-neutral-200 border-t-violet-500 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
          <span aria-hidden>🚚</span>
          Pickups
        </h3>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
          {shownPickups.length}
        </span>
      </div>
      <div className="h-[19rem] overflow-y-auto">
        {shownPickups.length === 0 ? (
          <p className="flex h-full items-center justify-center px-4 text-center text-xs text-neutral-400">
            No pickups scheduled.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {shownPickups.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <a
                    href={`/buyer/pickups/${p.id}/edit`}
                    className="block truncate text-sm font-medium text-neutral-900 hover:text-accent-700 hover:underline"
                  >
                    {p.supplierName}
                  </a>
                  <p className="mt-0.5 truncate text-xs text-neutral-400">
                    PO #{p.poNumber}
                    {p.driver && ` · Driver: ${p.driver}`}
                    {day === "both" &&
                      ` · ${p.pickupDate === today ? "Today" : "Tomorrow"}`}
                  </p>
                </div>
                <PickupStatusToggle pickupId={p.id} value={p.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Day toggle + the date(s) in view */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-xl bg-neutral-100 p-1">
          <ToggleButton
            active={day === "today"}
            label="Today"
            onClick={() => setDay("today")}
          />
          <ToggleButton
            active={day === "tomorrow"}
            label="Tomorrow"
            onClick={() => setDay("tomorrow")}
          />
          <ToggleButton
            active={day === "both"}
            label="Both"
            onClick={() => setDay("both")}
          />
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-neutral-800">{dateLabel}</p>
          <p className="text-xs text-neutral-400">
            {totalOrders} order{totalOrders === 1 ? "" : "s"} ·{" "}
            {shownPickups.length} pickup{shownPickups.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {/* Meat + Fish share the left two-thirds; Other Preorders and Pickups
          stack in the right third. */}
      <div className="grid items-start gap-4 lg:grid-cols-3">
        {renderDept("meat")}
        {renderDept("fish")}
        <div className="flex flex-col gap-4">
          {renderDept("other")}
          {pickupsCard}
        </div>
      </div>
    </div>
  );
}
