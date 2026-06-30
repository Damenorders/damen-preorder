import { requireRole, homePathFor } from "@/lib/auth";
import { getBuyingSheet } from "@/lib/buying-sheet";
import { businessToday, businessTomorrow } from "@/lib/buyer-data";
import { DEPARTMENTS, departmentLabels, buyerTableStatusLabels } from "@/lib/labels";
import PageShell from "@/components/PageShell";
import FilterBar, { type FilterField } from "@/components/FilterBar";
import LiveRefresh from "@/components/LiveRefresh";
import BuyingSheetGroups, {
  type BuyingRow,
  type BuyingSection,
} from "@/components/BuyingSheetGroups";
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
  const byProduct = get("byproduct") === "1";
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
      param: "byproduct",
      label: "Group by product (specs on click)",
    },
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

  // Turn the spec-level groups into display rows. Group-by-product merges every
  // spec of a product into one row, keeping the per-spec breakdown as children.
  function toRows(list: typeof groups): BuyingRow[] {
    if (!byProduct) {
      return list.map((g) => ({
        key: `${g.product}||${g.specs}`,
        label: g.specs ? `${g.product} ${g.specs}` : g.product,
        department: g.department,
        totalQuantity: g.totalQuantity,
        totalWeight: g.totalWeight,
        clientCount: g.clientCount,
        clients: g.clients,
      }));
    }
    const map = new Map<string, BuyingRow & { clientSet: Set<string> }>();
    for (const g of list) {
      let r = map.get(g.product);
      if (!r) {
        r = {
          key: g.product,
          label: g.product,
          department: g.department,
          totalQuantity: 0,
          totalWeight: 0,
          clientCount: 0,
          clients: [],
          children: [],
          clientSet: new Set<string>(),
        };
        map.set(g.product, r);
      }
      r.totalQuantity += g.totalQuantity;
      r.totalWeight += g.totalWeight;
      r.children!.push({
        specs: g.specs,
        totalQuantity: g.totalQuantity,
        totalWeight: g.totalWeight,
        clientCount: g.clientCount,
        clients: g.clients,
      });
      for (const c of g.clients) r.clientSet.add(c);
    }
    return [...map.values()].map(({ clientSet, ...r }) => ({
      ...r,
      clientCount: clientSet.size,
      clients: [...clientSet].sort(),
      children: r.children!.sort((a, b) => a.specs.localeCompare(b.specs)),
    }));
  }

  let sections: BuyingSection[];
  if (combine) {
    sections = [
      { key: "combined", label: `Combined totals · ${rangeLabel}`, rows: toRows(groups) },
    ];
  } else {
    const byDate = new Map<string, typeof groups>();
    for (const g of groups) {
      if (!byDate.has(g.deliveryDate)) byDate.set(g.deliveryDate, []);
      byDate.get(g.deliveryDate)!.push(g);
    }
    sections = [...byDate.entries()].map(([date, dateGroups]) => ({
      key: date,
      label: `Delivery ${formatDate(date)}${date === today ? " (today)" : date === tomorrow ? " (tomorrow)" : ""}`,
      rows: toRows(dateGroups),
    }));
  }

  return (
    <PageShell
      user={user}
      backHref={homePathFor(user.role)}
      backLabel="Dashboard"
      title="Grouped Buying Sheet"
      subtitle={
        byProduct
          ? combine
            ? `Totals per product · ${rangeLabel} · tap a row for specs`
            : "Totals per product — tap a row for specs."
          : combine
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
            (byProduct ? 1 : 0) +
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
        ) : (
          <BuyingSheetGroups sections={sections} />
        )}
      </div>
    </PageShell>
  );
}
