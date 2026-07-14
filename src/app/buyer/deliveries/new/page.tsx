import { requireRole } from "@/lib/auth";
import { listSuppliers } from "@/lib/suppliers";
import PageShell from "@/components/PageShell";
import DeliveryForm from "@/components/DeliveryForm";

// New Delivery — buyer/admin only. Supplier + date.
export default async function NewDeliveryPage() {
  const user = await requireRole("buyer", "dispatch", "owner");
  const suppliers = await listSuppliers();

  return (
    <PageShell
      user={user}
      backHref="/buyer/pickups"
      backLabel="Pickups & Deliveries"
      title="New Delivery"
      subtitle="Log an incoming delivery — supplier and date."
    >
      <DeliveryForm
        supplierNames={suppliers.map((s) => s.name)}
        doneHref="/buyer/pickups"
      />
    </PageShell>
  );
}
