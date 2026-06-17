import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, type Client, type User } from "@/db/schema";
import { formatExternalId } from "@/db/external-id";
import { logAudit } from "@/lib/audit";

/**
 * Matches a typed client name to an existing client (case-insensitive) or
 * creates a new one, so the client list learns itself from data entry.
 * Reusing a match keeps one canonical spelling per client. Shared by the
 * order form and the order-error form.
 */
export async function resolveClient(name: string, user: User): Promise<Client> {
  const [existing] = await db
    .select()
    .from(clients)
    .where(sql`lower(${clients.clientName}) = ${name.toLowerCase()}`)
    .limit(1);
  if (existing) return existing;

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(clients)
      .values({ clientName: name })
      .returning();
    const externalId = formatExternalId("client", created.id);
    await tx
      .update(clients)
      .set({ externalId })
      .where(eq(clients.id, created.id));
    await logAudit(tx, user, [
      {
        action: "create",
        recordType: "client",
        recordId: created.id,
        newValue: { clientName: name },
      },
    ]);
    return { ...created, externalId };
  });
}
