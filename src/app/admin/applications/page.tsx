import { desc } from "drizzle-orm";
import { requireRole, homePathFor } from "@/lib/auth";
import { db } from "@/db";
import { applications, type ApplicationStatus } from "@/db/schema";
import { formatDate, formatDateTime } from "@/lib/dates";
import PageShell from "@/components/PageShell";
import FilterBar, { type FilterField } from "@/components/FilterBar";
import ApplicationStatusSelect from "@/components/ApplicationStatusSelect";
import ApplicationsExport from "@/components/ApplicationsExport";

const STATUSES: ApplicationStatus[] = ["new", "approved", "rejected"];
const statusLabels: Record<ApplicationStatus, string> = {
  new: "New",
  approved: "Approved",
  rejected: "Rejected",
};

// Damen Online access applications submitted by clients — buyer/admin review,
// and either may change an application's status. Same filter + export pattern
// as the Order Errors table.
export default async function ApplicationsPage({
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
    status: get("status"),
    business: get("business"),
    dateFrom: get("from"),
    dateTo: get("to"),
  };
  const activeCount = Object.values(filters).filter(Boolean).length;

  const all = await db.query.applications.findMany({
    orderBy: [desc(applications.createdAt)],
  });

  // Business-name options come from every application (not the filtered set),
  // so the choice never disappears once a filter is applied.
  const businessOptions = Array.from(
    new Set(all.map((r) => r.businessName)),
  ).sort((a, b) => a.localeCompare(b));

  // Date filters compare the calendar day (YYYY-MM-DD) of submission.
  const day = (d: Date) =>
    new Date(d).toLocaleDateString("en-CA", {
      timeZone: "America/Toronto",
    });

  const rows = all.filter((r) => {
    if (filters.status && r.status !== filters.status) return false;
    if (filters.business && r.businessName !== filters.business) return false;
    const d = day(r.createdAt);
    if (filters.dateFrom && d < filters.dateFrom) return false;
    if (filters.dateTo && d > filters.dateTo) return false;
    return true;
  });

  const fields: FilterField[] = [
    {
      type: "select",
      param: "status",
      label: "Status",
      emptyLabel: "All statuses",
      options: STATUSES.map((s) => ({ value: s, label: statusLabels[s] })),
    },
    {
      type: "select",
      param: "business",
      label: "Business",
      emptyLabel: "All businesses",
      options: businessOptions.map((b) => ({ value: b, label: b })),
    },
    { type: "date", param: "from", label: "From date" },
    { type: "date", param: "to", label: "To date" },
  ];

  // Rows + summary for the printable export (mirrors the filtered table).
  const exportRows = rows.map((r) => ({
    business: r.businessName,
    contact: r.contactName,
    phone: r.phone,
    email: r.email,
    status: statusLabels[r.status],
    submitted: formatDateTime(r.createdAt),
  }));

  const summaryParts: string[] = [];
  if (filters.status && STATUSES.includes(filters.status as ApplicationStatus))
    summaryParts.push(statusLabels[filters.status as ApplicationStatus]);
  if (filters.business) summaryParts.push(`Business: ${filters.business}`);
  if (filters.dateFrom && filters.dateTo)
    summaryParts.push(`${formatDate(filters.dateFrom)} – ${formatDate(filters.dateTo)}`);
  else if (filters.dateFrom) summaryParts.push(`From ${formatDate(filters.dateFrom)}`);
  else if (filters.dateTo) summaryParts.push(`Until ${formatDate(filters.dateTo)}`);
  const filterSummary = summaryParts.length
    ? summaryParts.join(" · ")
    : "All applications";

  const thClass =
    "sticky top-0 whitespace-nowrap border-b border-neutral-200 bg-neutral-50 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500";
  const tdClass = "border-b border-neutral-100 px-3 py-2 align-top text-sm";

  return (
    <PageShell
      user={user}
      backHref={homePathFor(user.role)}
      backLabel="Dashboard"
      title="Applications"
      subtitle={`${rows.length} access request${rows.length === 1 ? "" : "s"}`}
      full
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-neutral-500">
            Showing {rows.length} application{rows.length === 1 ? "" : "s"}
          </p>
          <ApplicationsExport rows={exportRows} filterSummary={filterSummary} />
        </div>
        <FilterBar fields={fields} activeCount={activeCount} />

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-10 text-center text-neutral-500">
            No applications{activeCount > 0 ? " match these filters" : " yet"}.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <table className="w-full min-w-[800px] border-collapse">
              <thead>
                <tr>
                  <th className={thClass}>Business</th>
                  <th className={thClass}>Contact</th>
                  <th className={thClass}>Phone</th>
                  <th className={thClass}>Email</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className={i % 2 === 1 ? "bg-neutral-100" : "bg-white"}>
                    <td className={`${tdClass} font-medium`}>{r.businessName}</td>
                    <td className={tdClass}>{r.contactName}</td>
                    <td className={`${tdClass} whitespace-nowrap`}>{r.phone}</td>
                    <td className={tdClass}>
                      <a
                        href={`mailto:${r.email}`}
                        className="text-accent-700 hover:underline"
                      >
                        {r.email}
                      </a>
                    </td>
                    <td className={tdClass}>
                      <ApplicationStatusSelect id={r.id} value={r.status} />
                    </td>
                    <td className={`${tdClass} whitespace-nowrap text-neutral-500`}>
                      {formatDateTime(r.createdAt)}
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
