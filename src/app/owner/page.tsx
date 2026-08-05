import { requireRole } from "@/lib/auth";
import {
  DEPARTMENTS,
  departmentLabels,
  departmentCardCorner,
  submissionLabels,
} from "@/lib/labels";
import AppHeader from "@/components/AppHeader";
import { DashboardCard } from "@/components/DashboardCard";
import PushNotificationsSettings from "@/components/PushNotificationsSettings";

// Owner dashboard — uses the order sections (Meat / Fish / Other Preorders)
// plus Pickups & Deliveries. Per request, the Pickups & Deliveries card comes
// first, then Meat, Fish, and Other Preorders.
export default async function OwnerDashboard() {
  const user = await requireRole("owner");

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <h1 className="text-xl font-semibold">Hello, {user.name}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Deliveries, pickups, order sections, and warehouse inventory.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Deliveries / Pickups first per request. */}
          <DashboardCard
            title="Pickups & Deliveries"
            subtitle="Delivery tracking and pickup sheets"
            links={[
              { label: "New Delivery", href: "/buyer/deliveries/new", primary: true, variant: "highlight" },
              { label: "New Pickup", href: "/buyer/pickups/new" },
              { label: "All Pickups & Deliveries", href: "/buyer/pickups" },
            ]}
          />
          {/* Then Meat, Fish, Other Preorders (DEPARTMENTS is in that order). */}
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
