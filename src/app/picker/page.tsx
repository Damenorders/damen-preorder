import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getAllSubmissions } from "@/lib/buyer-data";
import { DEPARTMENTS, departmentLabels } from "@/lib/labels";
import AppHeader from "@/components/AppHeader";
import SubmissionCard from "@/components/SubmissionCard";
import LiveRefresh from "@/components/LiveRefresh";

// Picker view — the picker role's whole app: every submission, read-only,
// earliest delivery first, with three independently togglable category pills.
export default async function PickerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("picker");
  const params = await searchParams;
  const raw = typeof params.module === "string" ? params.module : "";
  const selected = raw.split(",").filter(Boolean);

  const submissions = await getAllSubmissions({ departments: selected });

  const toggleHref = (dep: string) => {
    const next = selected.includes(dep)
      ? selected.filter((d) => d !== dep)
      : [...selected, dep];
    return next.length ? `/picker?module=${next.join(",")}` : "/picker";
  };

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <h1 className="text-xl font-semibold">All Submissions</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {submissions.length} order{submissions.length === 1 ? "" : "s"} ·
          earliest delivery first. Tap a row for details.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {DEPARTMENTS.map((dep) => {
            const on = selected.includes(dep);
            return (
              <Link
                key={dep}
                href={toggleHref(dep)}
                className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${
                  on
                    ? "bg-accent-600 text-white"
                    : "border border-neutral-300 text-neutral-700 hover:border-accent-600"
                }`}
              >
                {departmentLabels[dep]}
                {on ? " ✓" : ""}
              </Link>
            );
          })}
        </div>

        <div className="mt-5">
          <LiveRefresh />
          {submissions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-10 text-center text-neutral-500">
              No submissions for this selection yet.
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {submissions.map((s) => (
                <SubmissionCard
                  key={s.id}
                  submission={s}
                  showRep
                  showDepartment
                  canEdit={false}
                  manageStatus={false}
                  canEditWeight
                />
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
