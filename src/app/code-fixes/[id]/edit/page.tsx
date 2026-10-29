import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getCodeFix, getCodeFixCatalog, getCodeFixClientNames } from "@/lib/code-fix-data";
import PageShell from "@/components/PageShell";
import CodeFixForm from "@/components/CodeFixForm";

// Codes to Fix — edit an entry. Anyone with the card may edit any entry.
export default async function EditCodeFixPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("rep", "buyer");
  const { id } = await params;
  const entryId = Number(id);
  if (!Number.isInteger(entryId)) notFound();

  const [entry, clients, catalog] = await Promise.all([
    getCodeFix(entryId),
    getCodeFixClientNames(),
    getCodeFixCatalog(),
  ]);
  if (!entry) notFound();

  return (
    <PageShell
      user={user}
      backHref="/code-fixes"
      backLabel="Codes to Fix"
      title={`Edit — ${entry.clientName}`}
      subtitle="Removing a product deletes it; the others keep their Pending / Fixed status."
      wide
    >
      <CodeFixForm
        catalog={catalog}
        clients={clients}
        initial={{
          id: entry.id,
          clientName: entry.clientName,
          note: entry.note ?? "",
          lines: entry.lines.map((l) => ({
            id: l.id,
            clientSku: l.clientSku ?? "",
            clientDescription: l.clientDescription ?? "",
            price: l.price,
            generalSku: l.generalSku,
            generalDescription: l.generalDescription,
          })),
        }}
        doneHref="/code-fixes"
      />
    </PageShell>
  );
}
