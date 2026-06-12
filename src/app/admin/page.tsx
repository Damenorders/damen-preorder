import { requireRole } from "@/lib/auth";
import { DEPARTMENTS, departmentLabels } from "@/lib/labels";
import AppHeader from "@/components/AppHeader";
import { DashboardCard } from "@/components/DashboardCard";

// SPEC.md §3.1 — admin has full access: everything the buyer has,
// plus management and audit history (activates in Phase 4).
export default async function AdminDashboard() {
  const user = await requireRole("admin");

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <h1 className="text-xl font-semibold">Hello, {user.name}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Full access — orders, buyer tools, and administration.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DEPARTMENTS.map((dep) => (
            <DashboardCard
              key={dep}
              title={departmentLabels[dep]}
              links={[
                { label: "Fill Form", href: `/orders/${dep}/new` },
                { label: "Edit Form", href: `/orders/${dep}/submissions?mode=edit` },
                { label: "Submissions", href: `/orders/${dep}/submissions` },
              ]}
            />
          ))}
          <DashboardCard
            title="Buyer Tools"
            subtitle="Review, statuses, buying"
            links={[
              { label: "All Submissions", href: "/buyer/submissions" },
              { label: "Buyer Table", href: "/buyer/table" },
              { label: "Grouped Buying Sheet", href: "/buyer/buying-sheet" },
              { label: "Exports", href: "/buyer/exports" },
            ]}
          />
          <DashboardCard
            title="Administration"
            subtitle="System management"
            links={[
              { label: "Manage Users" },
              { label: "Manage Clients" },
              { label: "Manage Products" },
              { label: "Audit History", href: "/admin/audit" },
            ]}
          />
        </div>
      </main>
    </>
  );
}
