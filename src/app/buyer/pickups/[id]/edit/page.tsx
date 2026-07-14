import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getPickup } from "@/app/actions/pickups";
import { listSuppliers } from "@/lib/suppliers";
import PageShell from "@/components/PageShell";
import PickupForm from "@/components/PickupForm";

// Edit Pickup — buyer/admin only. Prefills the form with the saved pickup.
export default async function EditPickupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("buyer", "dispatch", "owner");
  const { id } = await params;
  const pickupId = Number(id);
  if (!Number.isInteger(pickupId)) notFound();

  const [pickup, suppliers] = await Promise.all([
    getPickup(pickupId),
    listSuppliers(),
  ]);
  if (!pickup) notFound();

  return (
    <PageShell
      user={user}
      backHref="/buyer/pickups"
      backLabel="All Pickups"
      title="Edit Pickup"
      subtitle="Update this pickup sheet."
    >
      <PickupForm
        suppliers={suppliers.map((s) => ({ name: s.name, address: s.address }))}
        doneHref="/buyer/pickups"
        pickup={{
          id: pickup.id,
          supplierName: pickup.supplierName,
          address: pickup.address,
          poNumber: pickup.poNumber,
          pickupDate: pickup.pickupDate,
          amountOfStock: pickup.amountOfStock,
          note: pickup.note ?? "",
          driver: pickup.driver ?? "",
        }}
      />
    </PageShell>
  );
}
