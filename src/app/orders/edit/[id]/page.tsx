import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, homePathFor } from "@/lib/auth";
import {
  getActiveClients,
  getOrderForEdit,
  getProductsForDepartment,
} from "@/lib/orders-data";
import { departmentLabels } from "@/lib/labels";
import PageShell from "@/components/PageShell";
import OrderForm from "@/components/order-form/OrderForm";
import type { FormLine } from "@/components/order-form/OrderForm";

// Edit Form — SPEC.md §16. Reps: own orders, Pending only (checked in
// getOrderForEdit AND again in the updateOrder action).
export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) notFound();

  const user = await requireRole("rep", "buyer");
  const result = await getOrderForEdit(user, orderId);

  if (!result.allowed) {
    return (
      <PageShell
        user={user}
        backHref={homePathFor(user.role)}
        backLabel="Dashboard"
        title="Can't edit this order"
      >
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
          <p className="text-neutral-600">{result.reason}</p>
          <Link
            href={homePathFor(user.role)}
            className="mt-4 inline-block rounded-xl bg-accent-600 px-5 py-3 text-sm font-semibold text-white hover:bg-accent-700"
          >
            Back to dashboard
          </Link>
        </div>
      </PageShell>
    );
  }

  const { order, clientId } = result;
  const [clients, products] = await Promise.all([
    getActiveClients(),
    getProductsForDepartment(order.department),
  ]);

  const initialLines: FormLine[] = order.lines
    .filter((l) => l.productId !== null)
    .map((l) => ({
      key: `db-${l.id}`,
      id: l.id,
      productId: l.productId as number,
      specsJson: l.specsJson,
      quantity: l.quantity,
      weight: l.weight ? String(Number(l.weight)) : "",
      notes: l.notes ?? "",
    }));

  return (
    <PageShell
      user={user}
      backHref={`/orders/${order.department}/submissions`}
      backLabel="Submissions"
      title={`Edit order — ${order.clientName}`}
      subtitle={`${departmentLabels[order.department]} · ${order.externalId ?? ""}`}
    >
      <OrderForm
        department={order.department}
        clients={clients.map((c) => ({ id: c.id, clientName: c.clientName }))}
        products={products}
        mode="edit"
        initial={{
          orderId: order.id,
          clientId,
          deliveryDate: order.deliveryDate,
          notes: order.notes ?? "",
          lines: initialLines,
        }}
        doneHref={`/orders/${order.department}/submissions`}
      />
    </PageShell>
  );
}
