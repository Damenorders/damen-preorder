import { requireRole, homePathFor } from "@/lib/auth";
import { getBuyingSheet } from "@/lib/buying-sheet";
import { businessToday, businessTomorrow } from "@/lib/buyer-data";
import {
  DEPARTMENTS,
  departmentLabels,
  buyerTableStatusLabels,
  weightUnit,
} from "@/lib/labels";
import PageShell from "@/components/PageShell";
import FilterBar, { type FilterField } from "@/components/FilterBar";
import LiveRefresh from "@/components/LiveRefresh";
import { formatDate } from "@/lib/dates";

// Grouped Buying Sheet — buyer/admin only (SPEC.md §20).
// Default: Pending orders delivering today/tomorrow = what still must be bought.

export default async function BuyingSheetPage({
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

  const combine = get("combine") === "1";
  const delivery = get("delivery") ?? "today_tomorrow";
  // Combined view defaults to "all statuses" — it answers "how much of each
  // product was ordered", not "what's left to buy".
  const status = get("status") ?? (combine ? "all" : "pending");
  const department = get("module");
  const dateFrom = get("from");
  const dateTo = get("to");

  const groups = await getBuyingSheet({
    delivery,
    status,
    department,
    combine,
    dateFrom,
    dateTo,
  });

  const fields: FilterField[] = [
    {
      type: "checkbox",
      param: "combine",
      label: "Combine across dates (totals per product)",
    },
    {
      type: "select",
      param: "status",
      label: "Status",
      defaultValue: status,
      options: [
        { value: "all", label: "All statuses" },
        ...Object.entries(buyerTableStatusLabels).map(([value, label]) => ({
          value,
          label,
        })),
      ],
    },
    // Combined mode uses a date range; the day-picker selector is for the
    // normal per-date view.
    ...(combine
      ? ([
          { type: "date", param: "from", label: "From delivery date" },
          { type: "date", param: "to", label: "To delivery date" },
        ] as FilterField[])
      : ([
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
        ] as FilterField[])),
    {
      type: "select",
      param: "module",
      label: "Module",
      emptyLabel: "All modules",
      options: DEPARTMENTS.map((d) => ({ value: d, label: departmentLabels[d] })),
    },
  ];

  // group by date for section headers (normal, per-date view)
  const byDate = new Map<string, typeof groups>();
  for (const g of groups) {
    if (!byDate.has(g.deliveryDate)) byDate.set(g.deliveryDate, []);
    byDate.get(g.deliveryDate)!.push(g);
  }
  const today = businessToday();
  const tomorrow = businessTomorrow();

  const rangeLabel =
    dateFrom && dateTo
      ? `${formatDate(dateFrom)} – ${formatDate(dateTo)}`
      : dateFrom
        ? `From ${formatDate(dateFrom)}`
        : dateTo
          ? `Until ${formatDate(dateTo)}`
          : "All time";

  // One product+specs card — shared by both the per-date and combined views.
  const card = (g: (typeof groups)[number]) => (
    <li
      key={`${g.product}-${g.specs}`}
      className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
    >
      <p className="font-semibold uppercase tracking-wide text-accent-800">
        {g.product}
        {g.specs ? ` ${g.specs}` : ""}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-neutral-50 px-2 py-3">
          <p className="text-xl font-semibold">{g.totalQuantity}</p>
          <p className="text-xs text-neutral-500">Total Quantity</p>
        </div>
        <div className="rounded-xl bg-neutral-50 px-2 py-3">
          <p className="text-xl font-semibold">{g.totalWeight.toFixed(1)}</p>
          <p className="text-xs text-neutral-500">
            Total {weightUnit(g.department).toUpperCase()}
          </p>
        </div>
        <div className="rounded-xl bg-neutral-50 px-2 py-3">
          <p className="text-xl font-semibold">{g.clientCount}</p>
          <p className="text-xs text-neutral-500">
            Client{g.clientCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm text-neutral-500">{g.clients.join(" · ")}</p>
    </li>
  );

  return (
    <PageShell
      user={user}
      backHref={homePathFor(user.role)}
      backLabel="Dashboard"
      title="Grouped Buying Sheet"
      subtitle={
        combine
          ? `Combined totals per product + specs · ${rangeLabel}`
          : status === "pending"
            ? "Totals per product + specs that still need to be bought."
            : "Totals per product + specs."
      }
      wide
    >
      <LiveRefresh />
      <div className="flex flex-col gap-4">
        <FilterBar
          fields={fields}
          activeCount={
            (combine ? 1 : 0) +
            (status !== "all" ? 1 : 0) +
            (department ? 1 : 0) +
            (combine
              ? (dateFrom ? 1 : 0) + (dateTo ? 1 : 0)
              : delivery !== "all"
                ? 1
                : 0)
          }
        />

        {groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-10 text-center text-neutral-500">
            {combine
              ? "No orders match this date range. Adjust the filters to see more."
              : "Nothing to buy for this view. Adjust the filters to see more."}
          </div>
        ) : combine ? (
          <section>
            <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Combined totals · {rangeLabel}
            </h2>
            <ul className="mt-2 flex flex-col gap-3">{groups.map(card)}</ul>
          </section>
        ) : (
          [...byDate.entries()].map(([date, dateGroups]) => (
            <section key={date}>
              <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Delivery {formatDate(date)}
                {date === today ? " (today)" : date === tomorrow ? " (tomorrow)" : ""}
              </h2>
              <ul className="mt-2 flex flex-col gap-3">{dateGroups.map(card)}</ul>
            </section>
          ))
        )}
      </div>
    </PageShell>
  );
}
