import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import PageShell from "@/components/PageShell";
import NewProductListForm from "@/components/NewProductListForm";

// Create Product List — name it, then walk the warehouse adding items.
export default async function NewProductListPage() {
  const user = await requireRole("buyer");

  return (
    <PageShell
      user={user}
      backHref="/buyer/product-lists"
      backLabel="Current Product Lists"
      title="Create Product List"
      subtitle="Name the list, then search the catalog and tap items as you walk."
    >
      <NewProductListForm defaultName={`Product List — ${formatDate(new Date())}`} />
    </PageShell>
  );
}
