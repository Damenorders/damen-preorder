import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, homePathFor } from "@/lib/auth";
import { getSubmissions } from "@/lib/orders-data";
import { departmentLabels, isDepartment } from "@/lib/labels";
import PageShell from "@/components/PageShell";
import SubmissionCard from "@/components/SubmissionCard";
import LiveRefresh from "@/components/LiveRefresh";
import SortPills from "@/components/SortPills";

// Submissions, one module at a time, sorted by submission date — SPEC.md §13.
// Reps see only their own orders (enforced in getSubmissions).
export default async function SubmissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { department } = await params;
  if (!isDepartment(department)) notFound();

  const sp = await searchParams;
  const editMode = sp.mode === "edit";
  const sortBy = sp.sortBy === "submitted" ? ("submitted" as const) : ("delivery" as const);
  const user = await requireRole("rep", "buyer", "scheduling");
  const submissions = await getSubmissions(user, department, sortBy);

  const sortHref = (value: string) => {
    const p = new URLSearchParams();
    if (editMode) p.set("mode", "edit");
    if (value === "submitted") p.set("sortBy", "submitted");
    const qs = p.toString();
    return `/orders/${department}/submissions${qs ? `?${qs}` : ""}`;
  };

  return (
    <PageShell
      user={user}
      backHref={homePathFor(user.role)}
      backLabel="Dashboard"
      title={`${departmentLabels[department]} — ${editMode ? "Edit Form" : "Submissions"}`}
      subtitle={
        editMode
          ? "Choose an order to edit."
          : user.role === "rep"
            ? "Your submissions. Tap a row for details."
            : "All submissions. Tap a row for details."
      }
    >
      <LiveRefresh />
      <div className="mb-4">
        <SortPills
          value={sortBy}
          options={[
            { value: "delivery", label: "By delivery date", href: sortHref("delivery") },
            { value: "submitted", label: "By order date", href: sortHref("submitted") },
          ]}
        />
      </div>
      {submissions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-10 text-center">
          <p className="text-neutral-500">No submissions yet.</p>
          <Link
            href={`/orders/${department}/new`}
            className="mt-3 inline-block rounded-xl bg-accent-600 px-5 py-3 text-sm font-semibold text-white hover:bg-accent-700"
          >
            Fill a form
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {submissions.map((s) => {
            const isRep = user.role === "rep";
            const isManager = user.role === "buyer" || user.role === "admin";
            // Scheduling: view all, edit weight + status only (no full edit/delete).
            return (
              <SubmissionCard
                key={s.id}
                submission={s}
                showRep={!isRep}
                manageStatus={!isRep}
                editButton={editMode}
                canEdit={isRep ? s.submissionStatus === "pending" : isManager}
                canEditWeight={isRep ? s.submissionStatus === "pending" : true}
                canDelete={isManager}
              />
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
