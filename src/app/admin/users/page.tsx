import { requireRole } from "@/lib/auth";
import { db } from "@/db";
import PageShell from "@/components/PageShell";
import UsersManager from "@/components/admin/UsersManager";

// Manage Users — admin only (SPEC.md §3.1).
export default async function AdminUsersPage() {
  const user = await requireRole();
  const allUsers = await db.query.users.findMany({
    orderBy: (u, { asc }) => asc(u.name),
  });

  return (
    <PageShell
      user={user}
      backHref="/admin"
      backLabel="Dashboard"
      title="Manage Users"
      subtitle="Logins, roles, and access."
    >
      <UsersManager
        currentUserId={user.id}
        users={allUsers.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          active: u.active,
        }))}
      />
    </PageShell>
  );
}
