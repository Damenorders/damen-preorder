import { requireRole } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import { DashboardCard } from "@/components/DashboardCard";
import PushNotificationsSettings from "@/components/PushNotificationsSettings";

// Dispatch dashboard — restricted role. Sees the Pickups & Deliveries tools,
// Warehouse Inventory, and Order Alerts; every other area is gated off server-side.
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
          <DashboardCard
            title="Warehouse Inventory"
            subtitle="Find items, save pallet locations"
            links={[
              { label: "Find an Item", href: "/warehouse?screen=find", primary: true, variant: "highlight" },
              { label: "Item Catalog", href: "/warehouse?screen=catalog" },
              { label: "Warehouse Map", href: "/warehouse?screen=map" },
              { label: "Activity Log", href: "/warehouse?screen=activity" },
            ]}
          />
          <PushNotificationsSettings />
        </div>
      </main>
    </>
  );
}
