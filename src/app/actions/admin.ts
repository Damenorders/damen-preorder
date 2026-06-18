"use server";

// Admin management actions — users, clients, products (SPEC.md §3.1).
// Every change is audited. requireRole() with no roles = admin only.

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { db } from "@/db";
import {
  clients,
  products,
  users,
  type Department,
  type Role,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  formatExternalId,
  formatProductExternalId,
} from "@/db/external-id";
import { isDepartment } from "@/lib/labels";
import { parseFormConfig } from "@/lib/product-config";

type Result = { ok: true } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export async function adminCreateClient(name: string): Promise<Result> {
  const user = await requireRole();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Enter a client name." };

  const [existing] = await db
    .select()
    .from(clients)
    .where(sql`lower(${clients.clientName}) = ${trimmed.toLowerCase()}`)
    .limit(1);
  if (existing) return { ok: false, error: `"${existing.clientName}" already exists.` };

  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(clients)
      .values({ clientName: trimmed })
      .returning({ id: clients.id });
    await tx
      .update(clients)
      .set({ externalId: formatExternalId("client", created.id) })
      .where(eq(clients.id, created.id));
    await logAudit(tx, user, [
      { action: "create", recordType: "client", recordId: created.id, newValue: { clientName: trimmed } },
    ]);
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function adminUpdateClient(
  id: number,
  changes: { name?: string; active?: boolean },
): Promise<Result> {
  const user = await requireRole();
  const existing = await db.query.clients.findFirst({ where: eq(clients.id, id) });
  if (!existing) return { ok: false, error: "Client not found." };

  const newName = changes.name?.trim();
  if (changes.name !== undefined && !newName) {
    return { ok: false, error: "Client name can't be empty." };
  }

  await db.transaction(async (tx) => {
    const audit = [];
    if (newName && newName !== existing.clientName) {
      audit.push({
        action: "update:client_name",
        recordType: "client" as const,
        recordId: id,
        oldValue: existing.clientName,
        newValue: newName,
      });
    }
    if (changes.active !== undefined && changes.active !== existing.active) {
      audit.push({
        action: changes.active ? "activate" : "deactivate",
        recordType: "client" as const,
        recordId: id,
        oldValue: existing.active,
        newValue: changes.active,
      });
    }
    await tx
      .update(clients)
      .set({
        ...(newName ? { clientName: newName } : {}),
        ...(changes.active !== undefined ? { active: changes.active } : {}),
        updatedAt: new Date(),
      })
      .where(eq(clients.id, id));
    await logAudit(tx, user, audit);
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const ROLES: Role[] = ["admin", "buyer", "rep", "picker", "scheduling"];

export async function adminCreateUser(input: {
  name: string;
  email: string;
  role: Role;
  password: string;
}): Promise<Result> {
  const user = await requireRole();
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { ok: false, error: "Enter a name." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: "Enter a valid email." };
  if (!ROLES.includes(input.role)) return { ok: false, error: "Invalid role." };
  if (input.password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const supabase = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
  });
  if (error) {
    return { ok: false, error: `Could not create the login: ${error.message}` };
  }

  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id: data.user.id,
      name,
      email,
      role: input.role,
      active: true,
    });
    // external id from a count-stable source: reuse the uuid-keyed row count
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(users);
    await tx
      .update(users)
      .set({ externalId: formatExternalId("user", count) })
      .where(eq(users.id, data.user.id));
    await logAudit(tx, user, [
      { action: "create", recordType: "user", recordId: data.user.id, newValue: { name, email, role: input.role } },
    ]);
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function adminUpdateUser(
  id: string,
  changes: { role?: Role; active?: boolean; name?: string },
): Promise<Result> {
  const admin = await requireRole();
  const existing = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!existing) return { ok: false, error: "User not found." };

  // Never let an admin lock themselves out
  if (id === admin.id) {
    if (changes.active === false) return { ok: false, error: "You can't deactivate your own account." };
    if (changes.role && changes.role !== "admin") {
      return { ok: false, error: "You can't remove your own admin role." };
    }
  }
  if (changes.role && !ROLES.includes(changes.role)) {
    return { ok: false, error: "Invalid role." };
  }
  const newName = changes.name?.trim();
  if (changes.name !== undefined && !newName) {
    return { ok: false, error: "Name can't be empty." };
  }

  await db.transaction(async (tx) => {
    const audit = [];
    if (changes.role && changes.role !== existing.role) {
      audit.push({
        action: "update:role",
        recordType: "user" as const,
        recordId: id,
        oldValue: existing.role,
        newValue: changes.role,
      });
    }
    if (changes.active !== undefined && changes.active !== existing.active) {
      audit.push({
        action: changes.active ? "activate" : "deactivate",
        recordType: "user" as const,
        recordId: id,
        oldValue: existing.active,
        newValue: changes.active,
      });
    }
    if (newName && newName !== existing.name) {
      audit.push({
        action: "update:name",
        recordType: "user" as const,
        recordId: id,
        oldValue: existing.name,
        newValue: newName,
      });
    }
    await tx
      .update(users)
      .set({
        ...(changes.role ? { role: changes.role } : {}),
        ...(changes.active !== undefined ? { active: changes.active } : {}),
        ...(newName ? { name: newName } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
    await logAudit(tx, admin, audit);
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function adminCreateProduct(input: {
  name: string;
  department: string;
  configJson: string;
}): Promise<Result> {
  const user = await requireRole();
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Enter a product name." };
  if (!isDepartment(input.department)) return { ok: false, error: "Choose a section." };

  const parsed = parseFormConfig(input.configJson);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const existing = await db.query.products.findFirst({
    where: sql`lower(${products.productName}) = ${name.toLowerCase()} and ${products.department} = ${input.department}`,
  });
  if (existing) return { ok: false, error: `"${name}" already exists in that section.` };

  const department = input.department as Department;
  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(products)
      .values({
        productName: name,
        department,
        productType: department.charAt(0).toUpperCase() + department.slice(1),
        formConfig: parsed.config,
      })
      .returning({ id: products.id });
    await tx
      .update(products)
      .set({ externalId: formatProductExternalId(name, created.id) })
      .where(eq(products.id, created.id));
    await logAudit(tx, user, [
      { action: "create", recordType: "product", recordId: created.id, newValue: { name, department } },
    ]);
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function adminUpdateProduct(
  id: number,
  changes: { name?: string; active?: boolean; configJson?: string },
): Promise<Result> {
  const user = await requireRole();
  const existing = await db.query.products.findFirst({ where: eq(products.id, id) });
  if (!existing) return { ok: false, error: "Product not found." };

  const newName = changes.name?.trim();
  if (changes.name !== undefined && !newName) {
    return { ok: false, error: "Product name can't be empty." };
  }
  let newConfig = null;
  if (changes.configJson !== undefined) {
    const parsed = parseFormConfig(changes.configJson);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    newConfig = parsed.config;
  }

  await db.transaction(async (tx) => {
    const audit = [];
    if (newName && newName !== existing.productName) {
      audit.push({
        action: "update:product_name",
        recordType: "product" as const,
        recordId: id,
        oldValue: existing.productName,
        newValue: newName,
      });
    }
    if (changes.active !== undefined && changes.active !== existing.active) {
      audit.push({
        action: changes.active ? "activate" : "deactivate",
        recordType: "product" as const,
        recordId: id,
        oldValue: existing.active,
        newValue: changes.active,
      });
    }
    if (newConfig) {
      audit.push({
        action: "update:form_config",
        recordType: "product" as const,
        recordId: id,
        oldValue: existing.formConfig,
        newValue: newConfig,
      });
    }
    await tx
      .update(products)
      .set({
        ...(newName ? { productName: newName } : {}),
        ...(changes.active !== undefined ? { active: changes.active } : {}),
        ...(newConfig ? { formConfig: newConfig } : {}),
        updatedAt: new Date(),
      })
      .where(eq(products.id, id));
    await logAudit(tx, user, audit);
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
