import { requireRole, homePathFor } from "@/lib/auth";
import { DEPARTMENTS, departmentLabels, buyerTableStatusLabels } from "@/lib/labels";
import PageShell from "@/components/PageShell";

// Exports — SPEC.md §21. CSV first (Odoo); Excel/PDF are post-MVP (§31).
// Plain GET forms: pick filters, submit, browser downloads the file.

const selectClass =
  "mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-accent-600";

function DeliverySelect() {
  return (
    <label className="block text-xs font-medium text-neutral-600">
      Delivery
      <select name="delivery" defaultValue="all" className={selectClass}>
        <option value="all">All dates</option>
        <option value="today_tomorrow">Today + Tomorrow</option>
        <option value="today">Today</option>
        <option value="tomorrow">Tomorrow</option>
      </select>
    </label>
  );
}

function ModuleSelect() {
  return (
    <label className="block text-xs font-medium text-neutral-600">
      Module
      <select name="module" defaultValue="" className={selectClass}>
        <option value="">All modules</option>
        {DEPARTMENTS.map((d) => (
          <option key={d} value={d}>
            {departmentLabels[d]}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusSelect({ defaultValue }: { defaultValue: string }) {
  return (
    <label className="block text-xs font-medium text-neutral-600">
      Buyer status
      <select name="status" defaultValue={defaultValue} className={selectClass}>
        <option value="all">All statuses</option>
        {Object.entries(buyerTableStatusLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default async function ExportsPage() {
  const user = await requireRole("buyer", "butcher");

  return (
    <PageShell
      user={user}
      backHref={homePathFor(user.role)}
      backLabel="Dashboard"
      title="Exports"
      subtitle="CSV downloads — Odoo-compatible, with stable external IDs."
    >
      <div className="flex flex-col gap-4">
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold">Orders (CSV)</h2>
          <p className="mt-1 text-sm text-neutral-500">
            One row per product line with every order field, ready for Odoo
            import (id, order_id/id, partner_id/id are external IDs).
          </p>
          <form action="/api/exports/orders" method="get" className="mt-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <DeliverySelect />
              <ModuleSelect />
              <StatusSelect defaultValue="all" />
            </div>
            <button
              type="submit"
              className="mt-4 w-full rounded-xl bg-accent-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-accent-700 sm:w-auto sm:px-8"
            >
              Download orders.csv
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold">Buying sheet (CSV)</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Grouped totals per product + specs: quantity, weight, client count.
          </p>
          <form action="/api/exports/buying-sheet" method="get" className="mt-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <DeliverySelect />
              <ModuleSelect />
              <StatusSelect defaultValue="pending" />
            </div>
            <button
              type="submit"
              className="mt-4 w-full rounded-xl bg-accent-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-accent-700 sm:w-auto sm:px-8"
            >
              Download buying_sheet.csv
            </button>
          </form>
        </section>

        <p className="text-sm text-neutral-400">
          Excel and PDF exports come after MVP launch (SPEC.md §31).
        </p>
      </div>
    </PageShell>
  );
}
