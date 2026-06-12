import { requireRole } from "@/lib/auth";
import { db } from "@/db";
import PageShell from "@/components/PageShell";
import ProductsManager from "@/components/admin/ProductsManager";

// Manage Products — admin only (SPEC.md §3.1). Product questions are data
// (form_config), editable here without code changes.
export default async function AdminProductsPage() {
  const user = await requireRole();
  const products = await db.query.products.findMany({
    orderBy: (p, { asc }) => [asc(p.department), asc(p.productName)],
  });

  return (
    <PageShell
      user={user}
      backHref="/admin"
      backLabel="Dashboard"
      title="Manage Products"
      subtitle="Products and their form questions, per section."
      wide
    >
      <ProductsManager
        products={products.map((p) => ({
          id: p.id,
          productName: p.productName,
          department: p.department,
          active: p.active,
          configJson: JSON.stringify(p.formConfig, null, 2),
        }))}
      />
    </PageShell>
  );
}
