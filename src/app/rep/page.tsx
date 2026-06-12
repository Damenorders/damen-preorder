import { requireRole } from "@/lib/auth";
import { DEPARTMENTS, departmentLabels } from "@/lib/labels";
import AppHeader from "@/components/AppHeader";
import { DashboardCard } from "@/components/DashboardCard";

// SPEC.md §5 — rep dashboard: the 3 order sections, each with
// Fill Form / Edit Form / Submissions.
export default async function RepDashboard() {
  const user = await requireRole("rep");

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <h1 className="text-xl font-semibold">Hello, {user.name}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Choose a section to start an order.
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
        </div>
      </main>
    </>
  );
}
