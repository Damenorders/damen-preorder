import { requireRole, homePathFor } from "@/lib/auth";
import { listPickups } from "@/app/actions/pickups";
import { listDeliveries } from "@/app/actions/deliveries";
import PageShell from "@/components/PageShell";
import PickupDeliveryBoard from "@/components/PickupDeliveryBoard";

// All Pickups & Deliveries — buyer/admin only. Pickups (with print) up top,
// delivery tracking below; each grouped by date (closest first) with completed
// rows sinking to the bottom.
export default async function PickupsPage() {
  const user = await requireRole("buyer", "dispatch", "owner");
  const [pickupRows, deliveryRows] = await Promise.all([
    listPickups(),
    listDeliveries(),
  ]);

  const pickups = pickupRows.map((p) => ({
    id: p.id,
    supplierName: p.supplierName,
    address: p.address,
    poNumber: p.poNumber,
    pickupDate: p.pickupDate,
    amountOfStock: p.amountOfStock,
    note: p.note,
    driver: p.driver,
    status: p.status,
    createdByName: p.createdByName,
  }));

  const deliveries = deliveryRows.map((d) => ({
    id: d.id,
    supplierName: d.supplierName,
    deliveryDate: d.deliveryDate,
    status: d.status,
    createdByName: d.createdByName,
  }));

  return (
    <PageShell
      user={user}
      backHref={homePathFor(user.role)}
      backLabel="Dashboard"
      title="Pickups & Deliveries"
      subtitle="Pickup sheets and delivery tracking, grouped by date."
      wide
    >
      <PickupDeliveryBoard
        pickups={pickups}
        deliveries={deliveries}
        canEditDriver={user.role !== "buyer"}
      />
    </PageShell>
  );
}
