import { requireRole } from "@/lib/auth";
import { db } from "@/db";
import PageShell from "@/components/PageShell";
import ClientsManager from "@/components/admin/ClientsManager";

// Manage Clients — admin only (SPEC.md §3.1).
export default async function AdminClientsPage() {
  const user = await requireRole();
  const clients = await db.query.clients.findMany({
    orderBy: (c, { asc }) => asc(c.clientName),
  });

  return (
    <PageShell
      user={user}
      backHref="/admin"
      backLabel="Dashboard"
      title="Manage Clients"
      subtitle={`${clients.length} client${clients.length === 1 ? "" : "s"} — reps can also add new ones from the order form.`}
    >
      <ClientsManager
        clients={clients.map((c) => ({
          id: c.id,
          clientName: c.clientName,
          active: c.active,
          externalId: c.externalId,
        }))}
      />
    </PageShell>
  );
}
