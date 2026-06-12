import Link from "next/link";
import { requireRole, homePathFor } from "@/lib/auth";
import {
  businessToday,
  businessTomorrow,
  getBuyerTable,
  getFilterOptions,
} from "@/lib/buyer-data";
import {
  buyerTableStatusLabels,
  DEPARTMENTS,
  departmentLabels,
} from "@/lib/labels";
import { formatDate, formatDateTime } from "@/lib/dates";
import type { BuyerTableStatus } from "@/db/schema";
import PageShell from "@/components/PageShell";
import FilterBar, { type FilterField } from "@/components/FilterBar";
import StatusSelect from "@/components/StatusSelect";
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

// Spec chips cycle through soft tints, Jotform-style.
const chipColors = [
  "bg-pink-100 text-pink-900",
  "bg-orange-100 text-orange-900",
  "bg-amber-100 text-amber-900",
  "bg-sky-100 text-sky-900",
  "bg-violet-100 text-violet-900",
  "bg-teal-100 text-teal-900",
];

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
  const statusFirst = get("sort") === "status";
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
    if (nextStatusFirst) p.set("sort", "status");
    if (nextNewestFirst) p.set("dates", "newest");
    return `/buyer/table?${p.toString()}`;
  }

  const isDefaultView = status === "pending" && delivery === "today_tomorrow";

  const [rows, options] = await Promise.all([
    getBuyerTable(filters),
    getFilterOptions(),
  ]);

  const activeCount =
    (status !== "all" ? 1 : 0) +
    (delivery !== "all" ? 1 : 0) +
    (departments.length > 0 ? 1 : 0) +
    [
      filters.clientName,
      filters.repName,
      filters.product,
      filters.createdDate,
      filters.updatedDate,
    ].filter(Boolean).length +
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

  const today = businessToday();
  const tomorrow = businessTomorrow();
  const dateTag = (d: string) =>
    d === today ? "today" : d === tomorrow ? "tomorrow" : null;

  const thClass =
    "sticky top-0 whitespace-nowrap border-b border-neutral-200 bg-neutral-50 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500";
  const tdClass = "border-b border-neutral-100 px-3 py-2 align-top text-sm";

  return (
    <PageShell
      user={user}
      backHref={homePathFor(user.role)}
      backLabel="Dashboard"
      title="Buyer Table"
      subtitle={
        isDefaultView
          ? `Needs action: Pending, delivering today or tomorrow · ${rows.length} line${rows.length === 1 ? "" : "s"}`
          : `${rows.length} line${rows.length === 1 ? "" : "s"}`
      }
      full
    >
      <LiveRefresh />
      <div className="flex flex-col gap-4">
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
        <FilterBar fields={fields} activeCount={activeCount} />

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-10 text-center text-neutral-500">
            {isDefaultView
              ? "Nothing needs action for today or tomorrow. Use the filters to see more."
              : "No orders match these filters."}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <table className="w-full min-w-[1100px] border-collapse">
              <thead>
                <tr>
                  <th className={thClass}>Client Name</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Delivery Date</th>
                  <th className={`${thClass} text-right`}>Weight</th>
                  <th className={thClass}>Product</th>
                  <th className={thClass}>Specs</th>
                  <th className={`${thClass} text-right`}>Qty</th>
                  <th className={thClass}>Notes</th>
                  <th className={thClass}>Created</th>
                  <th className={thClass}>Updated</th>
                  <th className={thClass}>Rep</th>
                  <th className={thClass}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const tag = dateTag(row.deliveryDate);
                  const notes = [row.lineNotes, row.orderNotes]
                    .filter(Boolean)
                    .join(" — ");
                  return (
                    <tr
                      key={row.lineId}
                      className={`transition-colors hover:bg-accent-50 ${
                        i % 2 === 1 ? "bg-neutral-100" : "bg-white"
                      }`}
                    >
                      <td className={`${tdClass} font-medium`}>
                        {row.clientName}
                      </td>
                      <td className={tdClass}>
                        <StatusSelect
                          kind="buyer"
                          orderId={row.orderId}
                          value={row.status}
                        />
                      </td>
                      <td className={`${tdClass} whitespace-nowrap`}>
                        {formatDate(row.deliveryDate)}
                        {tag && (
                          <span className="ml-1.5 rounded-full bg-accent-50 px-1.5 py-0.5 text-[11px] font-medium text-accent-800">
                            {tag}
                          </span>
                        )}
                      </td>
                      <td className={`${tdClass} whitespace-nowrap text-right tabular-nums`}>
                        {row.weight ? `${row.weight} kg` : "—"}
                      </td>
                      <td className={`${tdClass} whitespace-nowrap font-medium`}>
                        {row.product}
                      </td>
                      <td className={tdClass}>
                        <span className="flex flex-wrap gap-1">
                          {row.specs
                            ? row.specs.split(" · ").map((part, idx) => (
                                <span
                                  key={idx}
                                  className={`whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium ${chipColors[idx % chipColors.length]}`}
                                >
                                  {part}
                                </span>
                              ))
                            : "—"}
                        </span>
                      </td>
                      <td className={`${tdClass} text-right tabular-nums`}>
                        {row.quantity}
                      </td>
                      <td className={`${tdClass} max-w-[200px]`}>
                        {notes ? (
                          <span className="line-clamp-2 text-neutral-600" title={notes}>
                            {notes}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={`${tdClass} whitespace-nowrap text-neutral-500`}>
                        {formatDateTime(row.createdAt)}
                      </td>
                      <td className={`${tdClass} whitespace-nowrap text-neutral-500`}>
                        {formatDateTime(row.updatedAt)}
                      </td>
                      <td className={`${tdClass} whitespace-nowrap text-neutral-500`}>
                        {row.repName}
                      </td>
                      <td className={tdClass}>
                        <Link
                          href={`/orders/edit/${row.orderId}`}
                          className="rounded-lg bg-accent-50 px-2.5 py-1.5 text-xs font-medium text-accent-800 hover:bg-accent-100"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}
