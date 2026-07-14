import { requireRole } from "@/lib/auth";
import { listSuppliers } from "@/lib/suppliers";
import PageShell from "@/components/PageShell";
import PickupForm from "@/components/PickupForm";

// New Pickup — buyer/admin only. Enter a pickup sheet; the supplier's address
// is remembered so it auto-fills next time.
export default async function NewPickupPage() {
  const user = await requireRole("buyer", "dispatch", "owner");
  const suppliers = await listSuppliers();

  return (
    <PageShell
      user={user}
      backHref="/buyer/pickups"
      backLabel="All Pickups"
      title="New Pickup"
      subtitle="Enter a pickup — the supplier's address is saved for next time."
    >
      <PickupForm
        suppliers={suppliers.map((s) => ({ name: s.name, address: s.address }))}
        doneHref="/buyer/pickups"
      />
    </PageShell>
  );
}
