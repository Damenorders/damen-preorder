import Link from "next/link";
import { requireRole, homePathFor } from "@/lib/auth";
import {
  businessToday,
  businessTomorrow,
  businessWeekEnd,
  getBuyerTable,
  getFilterOptions,
} from "@/lib/buyer-data";
import {
  buyerTableStatusLabels,
  DEPARTMENTS,
  departmentLabels,
} from "@/lib/labels";
import type { BuyerTableStatus } from "@/db/schema";
import PageShell from "@/components/PageShell";
import FilterBar, { type FilterField } from "@/components/FilterBar";
import BuyerTableView from "@/components/BuyerTableView";
import BuyerForecast from "@/components/BuyerForecast";
import { buildForecast } from "@/lib/forecast";
import LiveRefresh from "@/components/LiveRefresh";

// Buyer Table — buyer/admin only. A real spreadsheet-style table, one row per
// order line, with the exact SPEC.md §17 columns. Default view: status
// Pending + delivery today/tomorrow (§18). Sort always follows §19:
// delivery date → status priority → updated time, whatever the filters.

const STATUS_ORDER: BuyerTableStatus[] = [
  "pending",
  "ordered",
  "pending_delivery",
  "pending_pickup",
  "received",
];

export default async function BuyerTablePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("buyer", "butcher");
  const params = await searchParams;
  const get = (key: string) => {
    const v = params[key];
    return typeof v === "string" && v !== "" ? v : undefined;
  };

  // SPEC.md §18 default: Pending + today/tomorrow (until the user filters)
  const forecast = get("view") === "forecast";
  const hasAnyParam = Object.keys(params).filter((k) => k !== "view").length > 0;
  const status = get("status") ?? (hasAnyParam ? "all" : "pending");
  const delivery = get("delivery") ?? (hasAnyParam ? "all" : "today_tomorrow");
  // Status first is the default (Pending top, Received bottom); sort=date
  // switches back to delivery date first.
  const statusFirst = get("sort") !== "date";
  const newestFirst = get("dates") === "newest";

  const departments = (get("module") ?? "").split(",").filter(Boolean);

  const filters = {
    status,
    delivery,
    departments,
    clientName: get("client"),
    repName: get("rep"),
    product: get("product"),
    createdDate: get("created"),
    updatedDate: get("updated"),
    hasNotes: get("notes") === "1",
    statusFirst,
    newestFirst,
  };

  // Sort-toggle links carry the current effective view along, so toggling
  // a sort never changes which rows are shown. Both toggles combine freely.
  function toggleHref(toggle: "status" | "dates") {
    const p = new URLSearchParams();
    p.set("status", status);
    p.set("delivery", delivery);
    for (const param of ["module", "client", "rep", "product", "created", "updated", "notes"] as const) {
      const v = get(param);
      if (v) p.set(param, v);
    }
    const nextStatusFirst = toggle === "status" ? !statusFirst : statusFirst;
    const nextNewestFirst = toggle === "dates" ? !newestFirst : newestFirst;
    if (!nextStatusFirst) p.set("sort", "date");
    if (nextNewestFirst) p.set("dates", "newest");
    if (forecast) p.set("view", "forecast");
    return `/buyer/table?${p.toString()}`;
  }

  // Forecast toggle keeps every other filter as it is.
  function viewHref(next: boolean) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (k !== "view" && typeof v === "string" && v !== "") p.set(k, v);
    }
    if (next) p.set("view", "forecast");
    const qs = p.toString();
    return qs ? `/buyer/table?${qs}` : "/buyer/table";
  }

  const isDefaultView = status === "pending" && delivery === "today_tomorrow";

  const today = businessToday();
  const tomorrow = businessTomorrow();
  const weekEnd = businessWeekEnd();

  // Forecast: everything not yet Received, delivering today → the closest
  // Sunday after today. Status and delivery filters do not apply.
  const [rows, options] = await Promise.all([
    getBuyerTable(
      forecast
        ? {
            ...filters,
            status: "all",
            delivery: "all",
            deliveryFrom: today,
            deliveryTo: weekEnd,
            excludeReceived: true,
          }
        : filters,
    ),
    getFilterOptions(),
  ]);
  const forecastGroups = forecast ? buildForecast(rows) : [];

  const activeCount =
    (!forecast && status !== "all" ? 1 : 0) +
    (!forecast && delivery !== "all" ? 1 : 0) +
    (departments.length > 0 ? 1 : 0) +
    [
      filters.clientName,
      filters.repName,
      filters.product,
      filters.createdDate,
      filters.updatedDate,
    ].filter(Boolean).length +
    (filters.hasNotes ? 1 : 0);

  const allFields: FilterField[] = [
    {
      type: "select",
      param: "status",
      label: "Status",
      defaultValue: status,
      options: [
        { value: "all", label: "All statuses" },
        ...STATUS_ORDER.map((s) => ({
          value: s,
          label: buyerTableStatusLabels[s],
        })),
      ],
    },
    {
      type: "select",
      param: "delivery",
      label: "Delivery",
      defaultValue: delivery,
      options: [
        { value: "all", label: "All dates" },
        { value: "today_tomorrow", label: "Today + Tomorrow" },
        { value: "today", label: "Today" },
        { value: "tomorrow", label: "Tomorrow" },
      ],
    },
    { type: "date", param: "delivery", label: "Delivery date (pick)" },
    {
      type: "multi",
      param: "module",
      label: "Category (pick any)",
      options: DEPARTMENTS.map((d) => ({ value: d, label: departmentLabels[d] })),
    },
    {
      type: "select",
      param: "client",
      label: "Client",
      emptyLabel: "All clients",
      options: options.clients.map((c) => ({ value: c, label: c })),
    },
    {
      type: "select",
      param: "rep",
      label: "Rep",
      emptyLabel: "All reps",
      options: options.reps.map((r) => ({ value: r, label: r })),
    },
    {
      type: "select",
      param: "product",
      label: "Product",
      emptyLabel: "All products",
      options: options.products.map((p) => ({ value: p, label: p })),
    },
    { type: "date", param: "created", label: "Created on" },
    { type: "date", param: "updated", label: "Updated on" },
    { type: "checkbox", param: "notes", label: "With notes" },
  ];
  const fields = forecast
    ? allFields.filter((f) => f.param !== "status" && f.param !== "delivery")
    : allFields;


  return (
    <PageShell
      user={user}
      backHref={homePathFor(user.role)}
      backLabel="Dashboard"
      title="Buyer Table"
      subtitle={
        forecast
          ? "Forecast: everything not yet Received, grouped by product + specs, to Sunday"
          : isDefaultView
          ? `Needs action: Pending, delivering today or tomorrow · ${rows.length} line${rows.length === 1 ? "" : "s"}`
          : `${rows.length} line${rows.length === 1 ? "" : "s"}`
      }
      full
    >
      <LiveRefresh />
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-neutral-500">View:</span>
          <div className="inline-flex rounded-full border border-neutral-300 p-0.5">
            <Link
              href={viewHref(false)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                !forecast ? "bg-accent-600 text-white" : "text-neutral-700 hover:text-accent-800"
              }`}
            >
              Table
            </Link>
            <Link
              href={viewHref(true)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                forecast ? "bg-accent-600 text-white" : "text-neutral-700 hover:text-accent-800"
              }`}
            >
              Forecast
            </Link>
          </div>
        </div>
        {!forecast && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-neutral-500">Sort:</span>
          <Link
            href={toggleHref("status")}
            className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${
              statusFirst
                ? "bg-accent-600 text-white"
                : "border border-neutral-300 text-neutral-700 hover:border-accent-600"
            }`}
          >
            Status first{statusFirst ? " ✓" : ""}
          </Link>
          <Link
            href={toggleHref("dates")}
            className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${
              newestFirst
                ? "bg-accent-600 text-white"
                : "border border-neutral-300 text-neutral-700 hover:border-accent-600"
            }`}
          >
            {newestFirst
              ? "Dates: latest first ✓"
              : "Dates: earliest first"}
          </Link>
        </div>
        )}
        <FilterBar fields={fields} activeCount={activeCount} />

        {forecast ? (
          <BuyerForecast
            groups={forecastGroups}
            today={today}
            tomorrow={tomorrow}
            weekEnd={weekEnd}
          />
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-10 text-center text-neutral-500">
            {isDefaultView
              ? "Nothing needs action for today or tomorrow. Use the filters to see more."
              : "No orders match these filters."}
          </div>
        ) : (
          <BuyerTableView rows={rows} today={today} tomorrow={tomorrow} />
        )}
      </div>
    </PageShell>
  );
}
