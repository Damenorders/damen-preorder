import { desc } from "drizzle-orm";
import { requireRole, homePathFor } from "@/lib/auth";
import { db } from "@/db";
import { applications } from "@/db/schema";
import { formatDateTime } from "@/lib/dates";
import PageShell from "@/components/PageShell";
import ApplicationStatusSelect from "@/components/ApplicationStatusSelect";

const STATUS_LABELS = { new: "New", approved: "Approved", rejected: "Rejected" };
const STATUS_CHIP: Record<string, string> = {
  new: "bg-amber-100 text-amber-900",
  approved: "bg-emerald-800 text-white",
  rejected: "bg-red-100 text-red-800",
};

// Damen Online access applications submitted by clients — buyer/admin review.
// Only admins can change an application's status.
export default async function ApplicationsPage() {
  const user = await requireRole("buyer");
  const canManage = user.role === "admin";
  const rows = await db.query.applications.findMany({
    orderBy: [desc(applications.createdAt)],
  });

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
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-10 text-center text-neutral-500">
          No applications yet.
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
                    {canManage ? (
                      <ApplicationStatusSelect id={r.id} value={r.status} />
                    ) : (
                      <span
                        className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CHIP[r.status]}`}
                      >
                        {STATUS_LABELS[r.status]}
                      </span>
                    )}
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
    </PageShell>
  );
}
