import { requireRole, homePathFor } from "@/lib/auth";
import { getOrderErrors, getErrorFilterOptions } from "@/lib/errors-data";
import {
  ERROR_DEPARTMENTS,
  departmentLabels,
  ERROR_TYPES,
  errorTypeLabels,
} from "@/lib/labels";
import { formatDate, formatDateTime } from "@/lib/dates";
import PageShell from "@/components/PageShell";
import FilterBar, { type FilterField } from "@/components/FilterBar";
import LiveRefresh from "@/components/LiveRefresh";

// Order Errors table — buyer/admin only. Separate from the buyer table.
export default async function ErrorsPage({
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

  const filters = {
    department: get("module"),
    errorType: get("type"),
    clientName: get("client"),
    date: get("date"),
  };
  const activeCount = Object.values(filters).filter(Boolean).length;

  const [errors, options] = await Promise.all([
    getOrderErrors(filters),
    getErrorFilterOptions(),
  ]);

  const fields: FilterField[] = [
    {
      type: "select",
      param: "module",
      label: "Department",
      emptyLabel: "All departments",
      options: ERROR_DEPARTMENTS.map((d) => ({ value: d, label: departmentLabels[d] })),
    },
    {
      type: "select",
      param: "type",
      label: "Error type",
      emptyLabel: "All types",
      options: ERROR_TYPES.map((t) => ({ value: t, label: errorTypeLabels[t] })),
    },
    {
      type: "select",
      param: "client",
      label: "Customer",
      emptyLabel: "All customers",
      options: options.customers.map((c) => ({ value: c, label: c })),
    },
    { type: "date", param: "date", label: "Date" },
  ];

  const thClass =
    "sticky top-0 whitespace-nowrap border-b border-neutral-200 bg-neutral-50 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500";
  const tdClass = "border-b border-neutral-100 px-3 py-2 align-top text-sm";

  const typeColors: Record<string, string> = {
    wrong_item: "bg-orange-100 text-orange-900",
    not_delivered: "bg-red-100 text-red-800",
    damaged_product: "bg-pink-100 text-pink-900",
    not_scheduled: "bg-amber-100 text-amber-900",
    shorted_items: "bg-violet-100 text-violet-900",
  };

  return (
    <PageShell
      user={user}
      backHref={homePathFor(user.role)}
      backLabel="Dashboard"
      title="Order Errors"
      subtitle={`${errors.length} report${errors.length === 1 ? "" : "s"} — separate from the buyer table.`}
      full
    >
      <LiveRefresh />
      <div className="flex flex-col gap-4">
        <FilterBar fields={fields} activeCount={activeCount} />

        {errors.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-10 text-center text-neutral-500">
            No error reports{activeCount > 0 ? " match these filters" : " yet"}.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr>
                  <th className={thClass}>Customer</th>
                  <th className={thClass}>Date</th>
                  <th className={thClass}>Order #</th>
                  <th className={thClass}>Department</th>
                  <th className={thClass}>Error Type</th>
                  <th className={thClass}>Note</th>
                  <th className={thClass}>Reported by</th>
                  <th className={thClass}>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((e, i) => (
                  <tr key={e.id} className={i % 2 === 1 ? "bg-neutral-100" : "bg-white"}>
                    <td className={`${tdClass} font-medium`}>{e.customerName}</td>
                    <td className={`${tdClass} whitespace-nowrap`}>
                      {formatDate(e.errorDate)}
                    </td>
                    <td className={`${tdClass} whitespace-nowrap`}>
                      {e.orderNumber || "—"}
                    </td>
                    <td className={`${tdClass} whitespace-nowrap`}>
                      {departmentLabels[e.department]}
                    </td>
                    <td className={tdClass}>
                      <span
                        className={`whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${
                          typeColors[e.errorType] ?? "bg-neutral-100 text-neutral-700"
                        }`}
                      >
                        {errorTypeLabels[e.errorType]}
                      </span>
                    </td>
                    <td className={`${tdClass} max-w-[280px]`}>
                      {e.note ? (
                        <span className="text-neutral-700">{e.note}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={`${tdClass} whitespace-nowrap text-neutral-500`}>
                      {e.submittedByName}
                    </td>
                    <td className={`${tdClass} whitespace-nowrap text-neutral-500`}>
                      {formatDateTime(e.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}
