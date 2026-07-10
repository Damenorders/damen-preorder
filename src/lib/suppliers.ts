import "server-only";
import { eq, sql, asc } from "drizzle-orm";
import { db } from "@/db";
import { suppliers, type Supplier, type User } from "@/db/schema";
import { formatExternalId } from "@/db/external-id";
import { logAudit } from "@/lib/audit";

/**
 * Matches a typed pickup-location / supplier name to an existing supplier
 * (case-insensitive) or creates one, so the supplier list learns itself from
 * data entry — enter each supplier's address once and it's remembered.
 * When a non-empty address is supplied it updates the stored one, so a
 * correction sticks for next time.
 */
export async function resolveSupplier(
  name: string,
  address: string,
  user: User,
): Promise<Supplier> {
  const cleanAddress = address.trim();
  const [existing] = await db
    .select()
    .from(suppliers)
    .where(sql`lower(${suppliers.name}) = ${name.toLowerCase()}`)
    .limit(1);

  if (existing) {
    if (cleanAddress && cleanAddress !== existing.address) {
      const [updated] = await db
        .update(suppliers)
        .set({ address: cleanAddress, updatedAt: new Date() })
        .where(eq(suppliers.id, existing.id))
        .returning();
      return updated;
    }
    return existing;
  }

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(suppliers)
      .values({ name: name.trim(), address: cleanAddress })
      .returning();
    const externalId = formatExternalId("supplier", created.id);
    await tx
      .update(suppliers)
      .set({ externalId })
      .where(eq(suppliers.id, created.id));
    await logAudit(tx, user, [
      {
        action: "create",
        recordType: "supplier",
        recordId: created.id,
        newValue: { name: name.trim(), address: cleanAddress },
      },
    ]);
    return { ...created, externalId };
  });
}

/** All suppliers with an address, for the pickup form's autofill datalist. */
export async function listSuppliers(): Promise<Supplier[]> {
  return db
    .select()
    .from(suppliers)
    .where(eq(suppliers.active, true))
    .orderBy(asc(suppliers.name));
}
