import { notFound } from "next/navigation";
import { requireRole, homePathFor } from "@/lib/auth";
import { getActiveClients, getProductsForDepartment } from "@/lib/orders-data";
import { departmentLabels, isDepartment } from "@/lib/labels";
import PageShell from "@/components/PageShell";
import OrderForm from "@/components/order-form/OrderForm";

// Fill Form — SPEC.md §7–9. Same dynamic layout for all three sections.
export default async function NewOrderPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department } = await params;
  if (!isDepartment(department)) notFound();

  const user = await requireRole("rep", "buyer");
  const [clients, products] = await Promise.all([
    getActiveClients(),
    getProductsForDepartment(department),
  ]);

  return (
    <PageShell
      user={user}
      backHref={homePathFor(user.role)}
      backLabel="Dashboard"
      title={`${departmentLabels[department]} — Fill Form`}
      subtitle="One order can contain several products."
    >
      <OrderForm
        department={department}
        clients={clients.map((c) => c.clientName)}
        products={products}
        mode="create"
        dashboardHref={homePathFor(user.role)}
      />
    </PageShell>
  );
}
