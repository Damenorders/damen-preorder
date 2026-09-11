import { requireRole, homePathFor } from "@/lib/auth";
import { listPickups } from "@/app/actions/pickups";
import { listDeliveries } from "@/app/actions/deliveries";
import PageShell from "@/components/PageShell";
import PickupDeliveryBoard from "@/components/PickupDeliveryBoard";

// All Pickups & Deliveries — Pickups (with print) up top, delivery tracking
// below; each grouped by date (closest first) with completed rows sinking to
// the bottom. Warehouse gets the whole board read-only: every control that
// writes is hidden here and the matching server actions never gate warehouse
// in, so the page is safe even if someone calls one by hand.
export default async function PickupsPage() {
  const user = await requireRole("buyer", "dispatch", "owner", "warehouse");
  const readOnly = user.role === "warehouse";
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
      backLabel={readOnly ? "Warehouse Inventory" : "Dashboard"}
      title="Pickups & Deliveries"
      subtitle={
        readOnly
          ? "Pickup sheets and delivery tracking, grouped by date. View only."
          : "Pickup sheets and delivery tracking, grouped by date."
      }
      wide
    >
      <PickupDeliveryBoard
        pickups={pickups}
        deliveries={deliveries}
        canEditDriver={!readOnly && user.role !== "buyer"}
        readOnly={readOnly}
      />
    </PageShell>
  );
}
