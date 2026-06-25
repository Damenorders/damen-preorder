"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { applications, type ApplicationStatus } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { formatExternalId } from "@/db/external-id";

export interface ApplicationInput {
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
}

type Result = { ok: true } | { ok: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Submitted by the clients role (admins pass the gate too).
export async function createApplication(
  input: ApplicationInput,
): Promise<Result> {
  const user = await requireRole("clients");

  const businessName = input.businessName?.trim();
  const contactName = input.contactName?.trim();
  const phone = input.phone?.trim();
  const email = input.email?.trim();

  if (!businessName) return { ok: false, error: "Enter your business name." };
  if (!contactName) return { ok: false, error: "Enter your name." };
  if (!phone) return { ok: false, error: "Enter a phone number." };
  if (!email || !EMAIL.test(email))
    return { ok: false, error: "Enter a valid email address." };

  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(applications)
      .values({
        businessName,
        contactName,
        phone,
        email,
        submittedByUserId: user.id,
      })
      .returning({ id: applications.id });
    await tx
      .update(applications)
      .set({ externalId: formatExternalId("application", created.id) })
      .where(eq(applications.id, created.id));
    await logAudit(tx, user, [
      {
        action: "create",
        recordType: "application",
        recordId: created.id,
        newValue: { businessName, contactName, phone, email },
      },
    ]);
  });

  revalidatePath("/admin/applications");
  return { ok: true };
}

// Buyer/admin marks an application approved/rejected.
export async function setApplicationStatus(
  id: number,
  status: ApplicationStatus,
): Promise<Result> {
  const user = await requireRole("buyer");
  if (!["new", "approved", "rejected"].includes(status)) {
    return { ok: false, error: "Invalid status." };
  }
  const existing = await db.query.applications.findFirst({
    where: eq(applications.id, id),
  });
  if (!existing) return { ok: false, error: "Application not found." };
  if (existing.status === status) return { ok: true };

  await db.transaction(async (tx) => {
    await tx
      .update(applications)
      .set({ status, updatedAt: new Date() })
      .where(eq(applications.id, id));
    await logAudit(tx, user, [
      {
        action: "update:status",
        recordType: "application",
        recordId: id,
        oldValue: existing.status,
        newValue: status,
      },
    ]);
  });

  revalidatePath("/admin/applications");
  return { ok: true };
}
