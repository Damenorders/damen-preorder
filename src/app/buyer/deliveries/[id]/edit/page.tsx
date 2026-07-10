import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getDelivery } from "@/app/actions/deliveries";
import { listSuppliers } from "@/lib/suppliers";
import PageShell from "@/components/PageShell";
import DeliveryForm from "@/components/DeliveryForm";

// Edit Delivery — buyer/admin only.
export default async function EditDeliveryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("buyer", "dispatch");
  const { id } = await params;
  const deliveryId = Number(id);
  if (!Number.isInteger(deliveryId)) notFound();

  const [delivery, suppliers] = await Promise.all([
    getDelivery(deliveryId),
    listSuppliers(),
  ]);
  if (!delivery) notFound();

  return (
    <PageShell
      user={user}
      backHref="/buyer/pickups"
      backLabel="Pickups & Deliveries"
      title="Edit Delivery"
      subtitle="Update this delivery."
    >
      <DeliveryForm
        supplierNames={suppliers.map((s) => s.name)}
        doneHref="/buyer/pickups"
        delivery={{
          id: delivery.id,
          supplierName: delivery.supplierName,
          deliveryDate: delivery.deliveryDate,
        }}
      />
    </PageShell>
  );
}
