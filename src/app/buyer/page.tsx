import { requireRole } from "@/lib/auth";
import {
  DEPARTMENTS,
  departmentLabels,
  departmentCardCorner,
  submissionLabels,
} from "@/lib/labels";
import AppHeader from "@/components/AppHeader";
import { DashboardCard } from "@/components/DashboardCard";

// SPEC.md §6 — buyer dashboard: everything the rep has, plus buyer tools.
// Buyer tools activate in Phases 3–4.
export default async function BuyerDashboard() {
  const user = await requireRole("buyer");

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <h1 className="text-xl font-semibold">Hello, {user.name}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Order sections and buyer tools.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DEPARTMENTS.map((dep) => (
            <DashboardCard
              key={dep}
              title={departmentLabels[dep]}
              corner={departmentCardCorner[dep]}
              links={[
                { label: "Fill Form", href: `/orders/${dep}/new`, primary: true, variant: "highlight" },
                { label: "Edit Form", href: `/orders/${dep}/submissions?mode=edit` },
                { label: submissionLabels[dep], href: `/orders/${dep}/submissions` },
              ]}
            />
          ))}
          <DashboardCard
            title="Buyer Tools"
            subtitle="Review, statuses, buying"
            links={[
              { label: "Buyer Table", href: "/buyer/table", primary: true, variant: "highlight" },
              { label: "All Submissions", href: "/buyer/submissions" },
              { label: "Grouped Buying Sheet", href: "/buyer/buying-sheet" },
              { label: "Order Errors", href: "/buyer/errors" },
              { label: "Exports", href: "/buyer/exports" },
            ]}
          />
          <DashboardCard
            title="Order Errors"
            subtitle="Report or review order errors"
            links={[
              { label: "Report an Error", href: "/errors/new", primary: true },
              { label: "Error Reports Table", href: "/buyer/errors" },
            ]}
          />
        </div>
      </main>
    </>
  );
}
