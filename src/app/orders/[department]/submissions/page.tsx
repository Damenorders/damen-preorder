import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, homePathFor } from "@/lib/auth";
import { getSubmissions } from "@/lib/orders-data";
import { departmentLabels, isDepartment } from "@/lib/labels";
import PageShell from "@/components/PageShell";
import SubmissionCard from "@/components/SubmissionCard";
import LiveRefresh from "@/components/LiveRefresh";

// Submissions, one module at a time, sorted by submission date — SPEC.md §13.
// Reps see only their own orders (enforced in getSubmissions).
export default async function SubmissionsPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department } = await params;
  if (!isDepartment(department)) notFound();

  const user = await requireRole("rep", "buyer");
  const submissions = await getSubmissions(user, department);

  return (
    <PageShell
      user={user}
      backHref={homePathFor(user.role)}
      backLabel="Dashboard"
      title={`${departmentLabels[department]} — Submissions`}
      subtitle={
        user.role === "rep"
          ? "Your submissions, newest first. Tap a row for details."
          : "All submissions, newest first. Tap a row for details."
      }
    >
      <LiveRefresh />
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
          {submissions.map((s) => (
            <SubmissionCard
              key={s.id}
              submission={s}
              showRep={user.role !== "rep"}
              canEdit={
                user.role !== "rep" || s.submissionStatus === "pending"
              }
            />
          ))}
        </ul>
      )}
    </PageShell>
  );
}
