import { requireRole, homePathFor } from "@/lib/auth";
import {
  businessToday,
  businessTomorrow,
  getBuyerTable,
  getFilterOptions,
  type BuyerTableRow,
} from "@/lib/buyer-data";
import { buyerTableStatusLabels } from "@/lib/labels";
import type { BuyerTableStatus } from "@/db/schema";
import PageShell from "@/components/PageShell";
import FilterBar, { type FilterField } from "@/components/FilterBar";
import StatusSelect from "@/components/StatusSelect";
import LiveRefresh from "@/components/LiveRefresh";

// Buyer Table — buyer/admin only (SPEC.md §17). Default view: status Pending,
// delivery today/tomorrow (§18). Always sorted delivery date → status
// priority → updated time (§19), whatever the filters.

const STATUS_ORDER: BuyerTableStatus[] = [
  "pending",
  "ordered",
  "pending_delivery",
  "pending_pickup",
  "received",
];

function formatDay(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: Date) {
  return value.toLocaleString("en-CA", {
    timeZone: "America/Montreal",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function BuyerTablePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("buyer");
  const params = await searchParams;
  const get = (key: string) => {
    const v = params[key];
    return typeof v === "string" && v !== "" ? v : undefined;
  };

  // SPEC.md §18 default: Pending + today/tomorrow (until the user filters)
  const hasAnyParam = Object.keys(params).length > 0;
  const status = get("status") ?? (hasAnyParam ? "all" : "pending");
  const delivery = get("delivery") ?? (hasAnyParam ? "all" : "today_tomorrow");

  const filters = {
    status,
    delivery,
    clientName: get("client"),
    repName: get("rep"),
    product: get("product"),
    createdDate: get("created"),
    updatedDate: get("updated"),
    hasNotes: get("notes") === "1",
  };

  const [rows, options] = await Promise.all([
    getBuyerTable(filters),
    getFilterOptions(),
  ]);

  const activeCount =
    (status !== "all" ? 1 : 0) +
    (delivery !== "all" ? 1 : 0) +
    [filters.clientName, filters.repName, filters.product, filters.createdDate, filters.updatedDate]
      .filter(Boolean).length +
    (filters.hasNotes ? 1 : 0);

  const fields: FilterField[] = [
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

  // Group rows: delivery date → status (§19 example layout)
  const byDate = new Map<string, Map<BuyerTableStatus, BuyerTableRow[]>>();
  for (const row of rows) {
    if (!byDate.has(row.deliveryDate)) byDate.set(row.deliveryDate, new Map());
    const byStatus = byDate.get(row.deliveryDate)!;
    if (!byStatus.has(row.status)) byStatus.set(row.status, []);
    byStatus.get(row.status)!.push(row);
  }

  const today = businessToday();
  const tomorrow = businessTomorrow();
  const dateTag = (d: string) =>
    d === today ? " (today)" : d === tomorrow ? " (tomorrow)" : "";

  return (
    <PageShell
      user={user}
      backHref={homePathFor(user.role)}
      backLabel="Dashboard"
      title="Buyer Table"
      subtitle={
        !hasAnyParam
          ? `Needs action: Pending, delivering today or tomorrow · ${rows.length} line${rows.length === 1 ? "" : "s"}`
          : `${rows.length} line${rows.length === 1 ? "" : "s"}`
      }
      wide
    >
      <LiveRefresh />
      <div className="flex flex-col gap-4">
        <FilterBar fields={fields} activeCount={activeCount} />

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-10 text-center text-neutral-500">
            {!hasAnyParam
              ? "Nothing needs action for today or tomorrow. Use the filters to see more."
              : "No orders match these filters."}
          </div>
        ) : (
          [...byDate.entries()].map(([date, byStatus]) => (
            <section key={date}>
              <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Delivery {formatDay(date)}
                {dateTag(date)}
              </h2>
              {STATUS_ORDER.filter((s) => byStatus.has(s)).map((s) => (
                <div key={s} className="mt-2">
                  <h3 className="px-1 text-xs font-semibold text-accent-700">
                    {buyerTableStatusLabels[s]} · {byStatus.get(s)!.length}
                  </h3>
                  <ul className="mt-1.5 flex flex-col gap-2">
                    {byStatus.get(s)!.map((row) => (
                      <li
                        key={row.lineId}
                        className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium">
                              {row.clientName}
                              <span className="ml-2 text-sm font-normal text-neutral-500">
                                {row.repName}
                              </span>
                            </p>
                            <p className="mt-0.5 text-sm font-medium text-neutral-800">
                              {row.product}
                              <span className="font-normal text-neutral-600">
                                {row.specs ? ` — ${row.specs}` : ""}
                              </span>
                            </p>
                            <p className="mt-0.5 text-sm text-neutral-700">
                              Qty {row.quantity}
                              {row.weight ? ` · ${row.weight} kg` : ""}
                            </p>
                            {(row.lineNotes || row.orderNotes) && (
                              <p className="mt-0.5 text-sm italic text-neutral-500">
                                {row.lineNotes ?? row.orderNotes}
                              </p>
                            )}
                            <p className="mt-1 text-xs text-neutral-400">
                              Created {formatDateTime(row.createdAt)} · Updated{" "}
                              {formatDateTime(row.updatedAt)}
                            </p>
                          </div>
                          <StatusSelect
                            kind="buyer"
                            orderId={row.orderId}
                            value={row.status}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))
        )}
      </div>
    </PageShell>
  );
}
