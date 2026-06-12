// Seed script — creates the four users (auth + profile), sample clients,
// and the two fish products with their exact SPEC.md §8 form definitions.
// Idempotent: safe to run more than once.
//
// Usage: npm run db:seed   (requires .env.local — see .env.example)

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import {
  formatExternalId,
  formatProductExternalId,
} from "../src/db/external-id";
import type { ProductFormConfig } from "../src/lib/product-config";

const SEED_PASSWORD = process.env.SEED_USER_PASSWORD ?? "Damen2026!";

const SEED_USERS: Array<{
  name: string;
  email: string;
  role: schema.Role;
}> = [
  { name: "Orders", email: "orders@damenalimentaire.com", role: "admin" },
  { name: "Vinny", email: "vincent@damenalimentaire.com", role: "admin" },
  { name: "David", email: "david@damenalimentaire.com", role: "buyer" },
  { name: "Commandes", email: "commandes@damenalimentaire.com", role: "rep" },
];

const SEED_CLIENTS = [
  "Sushi Taxi",
  "Le Poisson Bleu",
  "Ocean Sushi",
  "Bistro du Port",
  "Marché Côtier",
];

// SPEC.md §8 — exact options. display templates produce the §25 readable
// string, e.g. "10/12 · Skin On · Bone Off · Deep Clean · Head & Skin Yes"
const salmonConfig: ProductFormConfig = {
  quantity: { min: 1, max: 20 },
  fields: [
    { key: "size", label: "Size", type: "select", options: ["8/10", "10/12", "12/14"], required: true, display: "{value}" },
    { key: "skin", label: "Skin", type: "select", options: ["On", "Off"], required: true, display: "Skin {value}" },
    { key: "bone", label: "Bone", type: "select", options: ["On", "Off"], required: true, display: "Bone {value}" },
    { key: "clean", label: "Clean", type: "select", options: ["Simple", "Deep"], required: true, display: "{value} Clean" },
    { key: "headAndSkin", label: "Head & Skin", type: "select", options: ["Yes", "No"], required: true, display: "Head & Skin {value}" },
  ],
};

const loupDeMerConfig: ProductFormConfig = {
  quantity: { min: 1, max: 20 },
  fields: [
    { key: "format", label: "Format", type: "select", options: ["Whole", "Fillet"], required: true, display: "{value}" },
    { key: "size", label: "Size", type: "select", options: ["Small", "Medium", "Big"], required: true, display: "{value}" },
    { key: "headAndSkin", label: "Head & Skin", type: "select", options: ["Yes", "No"], required: true, display: "Head & Skin {value}" },
  ],
};

const SEED_PRODUCTS: Array<{
  name: string;
  department: schema.Department;
  productType: string;
  formConfig: ProductFormConfig;
}> = [
  { name: "Salmon", department: "fish", productType: "Fish", formConfig: salmonConfig },
  { name: "Loup de Mer", department: "fish", productType: "Fish", formConfig: loupDeMerConfig },
];

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const databaseUrl = process.env.DATABASE_URL;

  if (!supabaseUrl || !serviceRoleKey || !databaseUrl) {
    console.error(
      "Missing env vars. Copy .env.example to .env.local and fill in " +
        "NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL.",
    );
    process.exit(1);
  }

  const supabase = createSupabaseAdmin(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  const db = drizzle(sql, { schema });

  // --- Users (Supabase Auth + public.users profile) ------------------------
  console.log("Seeding users…");
  const { data: existingAuth, error: listError } =
    await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw listError;

  for (const [index, u] of SEED_USERS.entries()) {
    let authUser = existingAuth.users.find(
      (a) => a.email?.toLowerCase() === u.email,
    );

    if (!authUser) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: SEED_PASSWORD,
        email_confirm: true,
      });
      if (error) throw error;
      authUser = data.user;
      console.log(`  created auth user ${u.email}`);
    } else {
      console.log(`  auth user ${u.email} already exists`);
    }

    const externalId = formatExternalId("user", index + 1);
    await db
      .insert(schema.users)
      .values({
        id: authUser.id,
        externalId,
        name: u.name,
        email: u.email,
        role: u.role,
        active: true,
      })
      .onConflictDoUpdate({
        target: schema.users.id,
        set: { name: u.name, role: u.role, active: true, externalId },
      });
  }

  // --- Clients --------------------------------------------------------------
  console.log("Seeding clients…");
  for (const name of SEED_CLIENTS) {
    const existing = await db.query.clients.findFirst({
      where: eq(schema.clients.clientName, name),
    });
    if (existing) {
      console.log(`  client "${name}" already exists`);
      continue;
    }
    const [inserted] = await db
      .insert(schema.clients)
      .values({ clientName: name })
      .returning({ id: schema.clients.id });
    await db
      .update(schema.clients)
      .set({ externalId: formatExternalId("client", inserted.id) })
      .where(eq(schema.clients.id, inserted.id));
    console.log(`  created client "${name}"`);
  }

  // --- Products ---------------------------------------------------------------
  console.log("Seeding products…");
  for (const p of SEED_PRODUCTS) {
    const existing = await db.query.products.findFirst({
      where: eq(schema.products.productName, p.name),
    });
    if (existing) {
      // Keep form config current with the spec on re-runs
      await db
        .update(schema.products)
        .set({ formConfig: p.formConfig, updatedAt: new Date() })
        .where(eq(schema.products.id, existing.id));
      console.log(`  product "${p.name}" already exists (form config refreshed)`);
      continue;
    }
    const [inserted] = await db
      .insert(schema.products)
      .values({
        department: p.department,
        productName: p.name,
        productType: p.productType,
        formConfig: p.formConfig,
      })
      .returning({ id: schema.products.id });
    await db
      .update(schema.products)
      .set({ externalId: formatProductExternalId(p.name, inserted.id) })
      .where(eq(schema.products.id, inserted.id));
    console.log(`  created product "${p.name}"`);
  }

  await sql.end();

  console.log("\nSeed complete. Login accounts (password for all: " + SEED_PASSWORD + "):");
  for (const u of SEED_USERS) {
    console.log(`  ${u.email}  →  ${u.role}`);
  }
  console.log("\nChange these passwords before launch (Supabase → Authentication → Users).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
