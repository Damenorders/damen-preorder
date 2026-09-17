import "server-only";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { suppliers, type Supplier, type User } from "@/db/schema";
import { formatExternalId } from "@/db/external-id";
import { logAudit } from "@/lib/audit";
import { matchSupplierName } from "@/lib/order-book-core";

/**
 * Matches a typed pickup-location / supplier name to an existing supplier or
 * creates one. Matching ignores case, spacing and punctuation and checks known
 * aliases ("Fra Di", "FRA-DI" and "fradi" are one supplier), the same rule the
 * Purchase Orders use, so the supplier list learns itself from
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
  const all = await db.select().from(suppliers);
  const match = matchSupplierName(name, all);
  const existing = match.kind === "existing" ? match.supplier : undefined;

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

  return db.transaction((tx) =>
    insertSupplier(tx, { name, address: cleanAddress }, user),
  );
}

type SupplierExecutor = Pick<typeof db, "insert" | "update">;

/**
 * Creates one supplier with its external id and an audit entry. Callers match
 * the name against the existing suppliers first; this never checks.
 */
export async function insertSupplier(
  tx: SupplierExecutor,
  values: { name: string; address?: string; contact?: string; email?: string },
  user: User,
): Promise<Supplier> {
  const newValue = {
    name: values.name.trim(),
    address: (values.address ?? "").trim(),
    contact: (values.contact ?? "").trim(),
    email: (values.email ?? "").trim(),
  };
  const [created] = await tx.insert(suppliers).values(newValue).returning();
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
      newValue,
    },
  ]);
  return { ...created, externalId };
}

/** All suppliers with an address, for the pickup form's autofill datalist. */
export async function listSuppliers(): Promise<Supplier[]> {
  return db
    .select()
    .from(suppliers)
    .where(eq(suppliers.active, true))
    .orderBy(asc(suppliers.name));
}
