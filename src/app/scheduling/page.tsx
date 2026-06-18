import { requireRole } from "@/lib/auth";
import {
  DEPARTMENTS,
  departmentLabels,
  departmentCardCorner,
  submissionLabels,
} from "@/lib/labels";
import AppHeader from "@/components/AppHeader";
import { DashboardCard } from "@/components/DashboardCard";

// Scheduling dashboard: view submissions per section + all submissions.
// Scheduling can edit line weight and submission status, but not fill forms,
// fully edit, or delete (enforced server-side on each page/action).
export default async function SchedulingDashboard() {
  const user = await requireRole("scheduling");

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <h1 className="text-xl font-semibold">Hello, {user.name}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          View submissions and update weight or status.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DEPARTMENTS.map((dep) => (
            <DashboardCard
              key={dep}
              title={departmentLabels[dep]}
              corner={departmentCardCorner[dep]}
              links={[
                {
                  label: submissionLabels[dep],
                  href: `/orders/${dep}/submissions`,
                  primary: true,
                },
              ]}
            />
          ))}
          <DashboardCard
            title="All Submissions"
            subtitle="Everyone's orders across all sections"
            links={[
              {
                label: "View All Submissions",
                href: "/orders/submissions",
                primary: true,
              },
            ]}
          />
        </div>
      </main>
    </>
  );
}
