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
  const user = await requireRole("buyer");
  const params = await searchParams;
  const get = (key: string) => {
    const v = params[key];
    return typeof v === "string" && v !== "" ? v : undefined;
  };

  const delivery = get("delivery") ?? "today_tomorrow";
  const status = get("status") ?? "pending";
  const department = get("module");

  const groups = await getBuyingSheet({ delivery, status, department });

  const fields: FilterField[] = [
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
      param: "module",
      label: "Module",
      emptyLabel: "All modules",
      options: DEPARTMENTS.map((d) => ({ value: d, label: departmentLabels[d] })),
    },
  ];

  // group by date for section headers
  const byDate = new Map<string, typeof groups>();
  for (const g of groups) {
    if (!byDate.has(g.deliveryDate)) byDate.set(g.deliveryDate, []);
    byDate.get(g.deliveryDate)!.push(g);
  }
  const today = businessToday();
  const tomorrow = businessTomorrow();

  return (
    <PageShell
      user={user}
      backHref={homePathFor(user.role)}
      backLabel="Dashboard"
      title="Grouped Buying Sheet"
      subtitle={
        status === "pending"
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
            (status !== "all" ? 1 : 0) +
            (delivery !== "all" ? 1 : 0) +
            (department ? 1 : 0)
          }
        />

        {groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-10 text-center text-neutral-500">
            Nothing to buy for this view. Adjust the filters to see more.
          </div>
        ) : (
          [...byDate.entries()].map(([date, dateGroups]) => (
            <section key={date}>
              <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Delivery {formatDate(date)}
                {date === today ? " (today)" : date === tomorrow ? " (tomorrow)" : ""}
              </h2>
              <ul className="mt-2 flex flex-col gap-3">
                {dateGroups.map((g) => (
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
                        <p className="text-xl font-semibold">
                          {g.totalWeight.toFixed(1)}
                        </p>
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
                    <p className="mt-3 text-sm text-neutral-500">
                      {g.clients.join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </PageShell>
  );
}
