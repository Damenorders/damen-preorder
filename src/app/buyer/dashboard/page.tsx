import { requireRole, homePathFor } from "@/lib/auth";
import {
  businessToday,
  businessTomorrow,
  businessYesterday,
  businessWeek,
  getDashboardOrders,
} from "@/lib/buyer-data";
import { getProductTrends } from "@/lib/trends-data";
import { listPickups } from "@/app/actions/pickups";
import PageShell from "@/components/PageShell";
import BuyerCommandCenter from "@/components/BuyerCommandCenter";
import ProductTrendChart from "@/components/ProductTrendChart";

// Buyer Command Center — one screen with everything for today/tomorrow:
// submissions by department and pickups, each with an editable status. Buyer +
// admin only (admins pass requireRole automatically). Both days are fetched so
// the Today / Tomorrow / Both toggle is instant client-side.
export default async function BuyerDashboardPage() {
  const user = await requireRole("buyer");
  const today = businessToday();
  const tomorrow = businessTomorrow();
  const yesterday = businessYesterday();

  // Fetch yesterday plus the whole week: Meat/Fish use yesterday/today/tomorrow
  // (filtered client-side by the toggle), Other Preorders shows every date.
  const [orders, allPickups, trends] = await Promise.all([
    getDashboardOrders([yesterday, ...businessWeek()]),
    listPickups(),
    getProductTrends(),
  ]);

  const pickups = allPickups
    .filter(
      (p) =>
        p.pickupDate === yesterday ||
        p.pickupDate === today ||
        p.pickupDate === tomorrow,
    )
    .map((p) => ({
      id: p.id,
      supplierName: p.supplierName,
      poNumber: p.poNumber,
      pickupDate: p.pickupDate,
      driver: p.driver,
      amountOfStock: p.amountOfStock,
      status: p.status,
    }));

  return (
    <PageShell
      user={user}
      backHref={homePathFor(user.role)}
      backLabel="Dashboard"
      title="Command Center"
      wide
    >
      <div className="flex flex-col gap-8">
        <BuyerCommandCenter
          yesterday={yesterday}
          today={today}
          tomorrow={tomorrow}
          orders={orders}
          pickups={pickups}
        />
        <ProductTrendChart trends={trends} />
      </div>
    </PageShell>
  );
}
