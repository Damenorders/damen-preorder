import { requireRole, homePathFor } from "@/lib/auth";
import { getActiveClients } from "@/lib/orders-data";
import PageShell from "@/components/PageShell";
import OrderErrorForm from "@/components/OrderErrorForm";

// Order Errors — Fill Form. Admin/buyer/rep (not picker).
export default async function NewOrderErrorPage() {
  const user = await requireRole("rep", "buyer");
  const clients = await getActiveClients();

  return (
    <PageShell
      user={user}
      backHref={homePathFor(user.role)}
      backLabel="Dashboard"
      title="Order Errors — Report an Error"
      subtitle="Log a delivery or order error for the buyers to review."
    >
      <OrderErrorForm
        clients={clients.map((c) => c.clientName)}
        doneHref={homePathFor(user.role)}
      />
    </PageShell>
  );
}
