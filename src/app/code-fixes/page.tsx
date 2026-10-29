import Link from "next/link";
import { requireRole, homePathFor } from "@/lib/auth";
import { getCodeFixes } from "@/lib/code-fix-data";
import { formatDateTime } from "@/lib/dates";
import PageShell from "@/components/PageShell";
import CodeFixStatusToggle from "@/components/CodeFixStatusToggle";
import CodeFixDeleteButton from "@/components/CodeFixDeleteButton";

const TABS = [
  { value: "pending", label: "Pending" },
  { value: "fixed", label: "Fixed" },
  { value: "all", label: "All" },
] as const;

// Codes to Fix — every entry with its product lines. Anyone with the card can
// edit; buyers and admin toggle each line Pending ⇄ Fixed.
export default async function CodeFixesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("rep", "buyer");
  const canToggle = user.role === "buyer" || user.role === "admin";
  const params = await searchParams;
  const tab = TABS.find((t) => t.value === params.status)?.value ?? "pending";

  const entries = await getCodeFixes();
  const allLines = entries.flatMap((e) => e.lines);
  const counts = {
    pending: allLines.filter((l) => l.status === "pending").length,
    fixed: allLines.filter((l) => l.status === "fixed").length,
    all: allLines.length,
  };
  const shown = entries
    .map((e) => ({ ...e, lines: tab === "all" ? e.lines : e.lines.filter((l) => l.status === tab) }))
    .filter((e) => e.lines.length > 0);

  const thClass =
    "whitespace-nowrap border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500";
  const tdClass = "border-b border-neutral-100 px-3 py-2 align-top text-sm";

  return (
    <PageShell
      user={user}
      backHref={homePathFor(user.role)}
      backLabel="Dashboard"
      title="Codes to Fix"
      subtitle="Client SKUs and prices to set up against their general SKU."
      full
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {TABS.map((t) => (
              <Link
                key={t.value}
                href={`/code-fixes?status=${t.value}`}
                className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                  tab === t.value
                    ? "border-accent-600 bg-accent-600 text-white"
                    : "border-neutral-300 bg-white hover:border-accent-600"
                }`}
              >
                {t.label} ({counts[t.value]})
              </Link>
            ))}
          </div>
          <Link
            href="/code-fixes/new"
            className="rounded-xl bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700"
          >
            + New entry
          </Link>
        </div>

        {shown.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-10 text-center text-neutral-500">
            {tab === "pending" ? "Nothing pending." : tab === "fixed" ? "Nothing fixed yet." : "No entries yet."}
          </div>
        ) : (
          shown.map((e) => (
            <section key={e.id} className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div>
                  <h2 className="text-base font-semibold">{e.clientName}</h2>
                  <p className="text-xs text-neutral-500">
                    Entered by {e.createdByName} · {formatDateTime(e.createdAt)}
                    {e.updatedAt.getTime() - e.createdAt.getTime() > 1000 &&
                      ` · edited by ${e.updatedByName} ${formatDateTime(e.updatedAt)}`}
                  </p>
                  {e.note && <p className="mt-1 text-sm text-neutral-700">{e.note}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/code-fixes/${e.id}/edit`}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:border-accent-600"
                  >
                    Edit
                  </Link>
                  <CodeFixDeleteButton id={e.id} clientName={e.clientName} />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse">
                  <thead>
                    <tr>
                      <th className={thClass}>Client SKU</th>
                      <th className={thClass}>Client description</th>
                      <th className={`${thClass} text-right`}>Client price</th>
                      <th className={thClass}>General SKU</th>
                      <th className={thClass}>General description</th>
                      <th className={thClass}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.lines.map((l) => (
                      <tr key={l.id}>
                        <td className={`${tdClass} whitespace-nowrap font-mono font-semibold`}>
                          {l.clientSku ?? "—"}
                        </td>
                        <td className={tdClass}>{l.clientDescription ?? "—"}</td>
                        <td className={`${tdClass} whitespace-nowrap text-right font-semibold`}>
                          ${l.price}
                        </td>
                        <td className={`${tdClass} whitespace-nowrap font-mono font-semibold`}>
                          {l.generalSku}
                        </td>
                        <td className={tdClass}>{l.generalDescription}</td>
                        <td className={`${tdClass} whitespace-nowrap`}>
                          {canToggle ? (
                            <CodeFixStatusToggle lineId={l.id} status={l.status} />
                          ) : (
                            <span
                              className={`rounded-full px-3 py-1 text-sm font-semibold ${
                                l.status === "fixed"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-amber-100 text-amber-900"
                              }`}
                            >
                              {l.status === "fixed" ? "✓ Fixed" : "Pending"}
                            </span>
                          )}
                          {l.status === "fixed" && l.fixedByName && l.fixedAt && (
                            <p className="mt-1 text-xs text-neutral-500">
                              {l.fixedByName} · {formatDateTime(l.fixedAt)}
                            </p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}
      </div>
    </PageShell>
  );
}
