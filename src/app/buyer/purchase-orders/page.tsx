import Link from "next/link";
import { requireRole } from "@/lib/auth";
import {
  getOpenOrders,
  getOrderHistory,
  getSupplierBlocks,
} from "@/lib/purchase-orders";
import PageShell from "@/components/PageShell";
import LiveRefresh from "@/components/LiveRefresh";
import AddLineCard from "@/components/purchase-orders/AddLineCard";
import OrderBoard from "@/components/purchase-orders/OrderBoard";
import SuppliersView from "@/components/purchase-orders/SuppliersView";

// Purchase Orders — buyer/admin only (Butcher is sent home by requireRole).
// Three tabs, as in the Order Book: Next order (the buyer card and each
// supplier's open order), Suppliers (the sourcing catalogue) and History.
// Live: a teammate's change shows up here without a reload.

const TABS = [
  { id: "order", label: "Next order" },
  { id: "suppliers", label: "Suppliers" },
  { id: "history", label: "History" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("buyer");
  const params = await searchParams;
  const tab: Tab = TABS.some((t) => t.id === params.tab) ? (params.tab as Tab) : "order";

  const [open, history, suppliers] = await Promise.all([
    getOpenOrders(),
    tab === "history" ? getOrderHistory() : Promise.resolve([]),
    tab === "suppliers" ? getSupplierBlocks() : Promise.resolve([]),
  ]);
  const counts: Record<Tab, number> = {
    order: open.reduce((n, o) => n + o.lines.length, 0),
    suppliers: 0,
    history: history.length,
  };

  // Everyone who reaches this page can edit the catalogue today (buyer and
  // admin). The Suppliers view also renders read-only for any future role.
  const canEdit = user.role === "admin" || user.role === "buyer";

  return (
    <PageShell
      user={user}
      backHref="/buyer"
      backLabel="Dashboard"
      title="Purchase Orders"
      subtitle="Order from our catalogue — each line goes to the product's supplier."
      wide
    >
      <LiveRefresh channel="purchase-orders" />

      <nav role="tablist" className="mb-5 flex gap-1 rounded-xl bg-neutral-100 p-1">
        {TABS.map((t) => (
          <Link
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            href={`/buyer/purchase-orders${t.id === "order" ? "" : `?tab=${t.id}`}`}
            className={`flex-1 rounded-lg px-3 py-2 text-center text-sm ${
              tab === t.id
                ? "bg-white font-semibold text-neutral-900 shadow-sm"
                : "text-neutral-600"
            }`}
          >
            {t.label}
            {t.id === "order" && counts.order > 0 && (
              <span className="ml-1 text-xs text-neutral-500">{counts.order}</span>
            )}
          </Link>
        ))}
      </nav>

      {tab === "order" && (
        <div className="flex flex-col gap-6">
          <AddLineCard />
          <OrderBoard view="order" open={open} history={[]} />
        </div>
      )}
      {tab === "suppliers" && <SuppliersView suppliers={suppliers} canEdit={canEdit} />}
      {tab === "history" && <OrderBoard view="history" open={open} history={history} />}
    </PageShell>
  );
}
