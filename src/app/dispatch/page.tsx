import { requireRole } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import { DashboardCard } from "@/components/DashboardCard";
import PushNotificationsSettings from "@/components/PushNotificationsSettings";

// Dispatch dashboard — restricted role. Sees only the Pickups & Deliveries
// tools and Order Alerts; every other area is gated off server-side.
export default async function DispatchDashboard() {
  const user = await requireRole("dispatch");

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <h1 className="text-xl font-semibold">Hello, {user.name}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Pickups, deliveries, and order alerts.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardCard
            title="Pickups & Deliveries"
            subtitle="Pickup sheets and delivery tracking"
            links={[
              { label: "New Pickup", href: "/buyer/pickups/new", primary: true, variant: "highlight" },
              { label: "New Delivery", href: "/buyer/deliveries/new" },
              { label: "All Pickups & Deliveries", href: "/buyer/pickups" },
            ]}
          />
          <PushNotificationsSettings />
        </div>
      </main>
    </>
  );
}
