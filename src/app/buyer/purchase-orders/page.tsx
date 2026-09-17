import { requireRole } from "@/lib/auth";
import { getOpenOrders, getOrderHistory } from "@/lib/purchase-orders";
import PageShell from "@/components/PageShell";
import LiveRefresh from "@/components/LiveRefresh";
import AddLineCard from "@/components/purchase-orders/AddLineCard";
import OrderBoard from "@/components/purchase-orders/OrderBoard";

// Purchase Orders — buyer/admin only (Butcher is sent home by requireRole).
// Type a catalogue product; the line lands on its supplier's next order. Live:
// a teammate's line, date or "ordered" shows up here without a reload.
export default async function PurchaseOrdersPage() {
  const user = await requireRole("buyer");
  const [open, history] = await Promise.all([getOpenOrders(), getOrderHistory()]);

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
      <div className="flex flex-col gap-6">
        <AddLineCard />
        <OrderBoard open={open} history={history} />
      </div>
    </PageShell>
  );
}
