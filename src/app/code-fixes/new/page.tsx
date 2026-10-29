import { requireRole, homePathFor } from "@/lib/auth";
import { getCodeFixCatalog, getCodeFixClientNames } from "@/lib/code-fix-data";
import PageShell from "@/components/PageShell";
import CodeFixForm from "@/components/CodeFixForm";

// Codes to Fix — new entry. Rep/buyer/admin.
export default async function NewCodeFixPage() {
  const user = await requireRole("rep", "buyer");
  const [clients, catalog] = await Promise.all([getCodeFixClientNames(), getCodeFixCatalog()]);

  return (
    <PageShell
      user={user}
      backHref={homePathFor(user.role)}
      backLabel="Dashboard"
      title="Codes to Fix"
      subtitle="Client SKU and price, and the general SKU it matches."
      wide
    >
      <CodeFixForm
        catalog={catalog}
        clients={clients}
        doneHref="/code-fixes"
      />
    </PageShell>
  );
}
