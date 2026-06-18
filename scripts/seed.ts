// Seed script — creates the four users (auth + profile), sample clients,
// and the two fish products with their exact SPEC.md §8 form definitions.
// Idempotent: safe to run more than once.
//
// Usage: npm run db:seed   (requires .env.local — see .env.example)

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq } from "drizzle-orm";
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
  { name: "Picker", email: "soccervinny3@hotmail.com", role: "picker" },
];

const SEED_CLIENTS = [
  "Sushi Taxi",
  "Le Poisson Bleu",
  "Ocean Sushi",
  "Bistro du Port",
  "Marché Côtier",
];

// Fish products. display templates produce the §25 readable string.
// Conditional options use showWhen (only shown/required when a parent answer
// matches); "info" fields record a fixed fact (e.g. Cod USA = fillets 10lb box).

const salmonConfig: ProductFormConfig = {
  quantity: { min: 1, max: 999 },
  quantityLabel: "Quantity of Fish",
  weightLabel: "Weight (lbs)",
  fields: [
    { key: "size", label: "Size", type: "select", options: ["10/12", "12/14", "14/16"], required: true, display: "{value}" },
    { key: "portioned", label: "Portioned 7oz", type: "select", options: ["Yes", "No"], required: true, display: "Portioned 7oz {value}" },
    { key: "skin", label: "Skin", type: "select", options: ["On", "Off"], required: true, display: "Skin {value}", showWhen: { field: "portioned", equals: "No" } },
    { key: "bone", label: "Bone", type: "select", options: ["On", "Off"], required: true, display: "Bone {value}", showWhen: { field: "portioned", equals: "No" } },
    { key: "clean", label: "Clean", type: "select", options: ["Simple Clean", "Deep Clean"], required: true, display: "{value}", showWhen: { field: "portioned", equals: "No" } },
    { key: "headAndSkin", label: "Head & Skin in Box", type: "select", options: ["Yes", "No"], required: true, display: "Head & Skin {value}" },
  ],
};

// Sea Bass and Sea Bream share the exact same options.
function seaBassBreamConfig(): ProductFormConfig {
  return {
    quantity: { min: 1, max: 999 },
    quantityLabel: "Quantity of Fish",
    weightLabel: "Weight (lbs)",
    fields: [
      { key: "size", label: "Size", type: "select", options: ["406oz", "608oz", "810oz"], required: true, display: "{value}" },
      { key: "cut", label: "Cut", type: "select", options: ["Whole", "Cut"], required: true, display: "{value}" },
      { key: "style", label: "Style", type: "select", options: ["Fillet", "Butterfly"], required: true, display: "{value}", showWhen: { field: "cut", equals: "Cut" } },
      { key: "skin", label: "Skin", type: "select", options: ["On", "Off"], required: true, display: "Skin {value}", showWhen: { field: "style", equals: "Fillet" } },
      { key: "withHead", label: "With Head", type: "select", options: ["Yes", "No"], required: true, display: "With Head {value}", showWhen: { field: "style", equals: "Butterfly" } },
    ],
  };
}

const codConfig: ProductFormConfig = {
  // Count shown once a Type is picked: "Number of boxes" for USA (fixed fillets
  // 10 lb box), "Quantity of Fish" for Icelandic (which also asks Weight (lbs)).
  quantity: { min: 1, max: 999 },
  quantityLabel: "Quantity of Fish",
  quantityShowWhen: { field: "type", equals: ["USA", "Icelandic"] },
  quantityLabelWhen: {
    field: "type",
    map: { USA: "Number of boxes", Icelandic: "Quantity of Fish" },
  },
  weightLabel: "Weight (lbs)",
  weightShowWhen: { field: "type", equals: "Icelandic" },
  fields: [
    { key: "type", label: "Type", type: "select", options: ["USA", "Icelandic"], required: true, display: "{value}" },
    { key: "usaFormat", label: "Format", type: "info", text: "Fillets · 10 lb box", display: "{value}", showWhen: { field: "type", equals: "USA" } },
    { key: "cut", label: "Cut", type: "select", options: ["Whole", "Fillet"], required: true, display: "{value}", showWhen: { field: "type", equals: "Icelandic" } },
    { key: "skin", label: "Skin", type: "select", options: ["On", "Off"], required: true, display: "Skin {value}", showWhen: { field: "cut", equals: "Fillet" } },
    { key: "bone", label: "Bone", type: "select", options: ["On", "Off"], required: true, display: "Bone {value}", showWhen: { field: "cut", equals: "Fillet" } },
  ],
};

const musselsConfig: ProductFormConfig = {
  quantity: { min: 1, max: 999 },
  quantityLabel: "Number of boxes",
  hideWeight: true,
  fields: [
    { key: "size", label: "Size", type: "select", options: ["2lbs", "25lbs"], required: true, display: "{value}" },
  ],
};

const pastaClamsConfig: ProductFormConfig = {
  quantity: { min: 1, max: 999 },
  quantityLabel: "Number of boxes",
  hideWeight: true,
  fields: [],
};

const liveLobsterConfig: ProductFormConfig = {
  quantity: { min: 1, max: 999 },
  quantityLabel: "Number of Lobsters",
  quantityOptional: true,
  hideWeight: true,
  fields: [
    { key: "size", label: "Size", type: "select", options: ["1.25-1.5lbs", "1.5-2lbs"], required: true, display: "{value}" },
  ],
};

// Meats are ordered by KG: no piece-count input, one required "Quantity (KG)"
// field (stored in the weight column), plus any cut options.
const KG = {
  quantity: null,
  weightLabel: "Quantity (KG)",
  weightRequired: true,
} as const;

function meatConfig(fields: ProductFormConfig["fields"] = []): ProductFormConfig {
  return { fields, ...KG };
}

const MEAT_PRODUCTS: Array<{ name: string; formConfig: ProductFormConfig }> = [
  {
    name: "Chicken Breast",
    formConfig: meatConfig([
      { key: "trim", label: "Trim", type: "select", options: ["Standard", "Full Trim"], required: true, display: "{value} Trim" },
      { key: "skin", label: "Skin", type: "select", options: ["On", "Off"], required: true, display: "Skin {value}" },
    ]),
  },
  {
    name: "Chicken Thigh",
    formConfig: meatConfig([
      { key: "skin", label: "Skin", type: "select", options: ["On", "Off"], required: true, display: "Skin {value}" },
      { key: "bone", label: "Bone", type: "select", options: ["On", "Off"], required: true, display: "Bone {value}" },
    ]),
  },
  { name: "Ground Beef", formConfig: meatConfig() },
  { name: "Boneless Chicken Legs", formConfig: meatConfig() },
  { name: "Beef Shoulder", formConfig: meatConfig() },
  { name: "Pork Shoulder", formConfig: meatConfig() },
  {
    name: "Bavette",
    formConfig: meatConfig([
      { key: "trim", label: "Trim", type: "select", options: ["Standard", "Trimmed"], required: true, display: "{value}" },
    ]),
  },
  { name: "Filet Mignon", formConfig: meatConfig() },
  { name: "Denuded Inside Round", formConfig: meatConfig() },
  {
    name: "Striploin",
    formConfig: meatConfig([
      { key: "cut", label: "Cut", type: "select", options: ["Whole", "Portioned"], required: true, display: "{value}" },
      { key: "size", label: "Size", type: "select", options: ["8oz", "10oz", "12oz", "14oz", "16oz"], required: true, display: "{value}", showWhen: { field: "cut", equals: "Portioned" } },
    ]),
  },
  { name: "Flank Steak", formConfig: meatConfig() },
  { name: "Frozen Lamb Shoulder", formConfig: meatConfig() },
  { name: "Ground Chicken", formConfig: meatConfig() },
  {
    name: "Ribeye Steak",
    formConfig: meatConfig([
      { key: "cut", label: "Cut", type: "select", options: ["Whole", "Portioned"], required: true, display: "{value}" },
      { key: "size", label: "Size", type: "select", options: ["8oz", "10oz", "12oz", "14oz", "16oz"], required: true, display: "{value}", showWhen: { field: "cut", equals: "Portioned" } },
      { key: "bone", label: "Bone", type: "select", options: ["In", "Off"], required: true, display: "Bone {value}" },
    ]),
  },
  {
    // Counted in units, not KG
    name: "Chicken Bone",
    formConfig: { fields: [], quantity: { min: 1, max: 999 } },
  },
];

// "Other": the user writes the order manually in a free-text box.
const otherConfig: ProductFormConfig = {
  fields: [
    {
      key: "description",
      label: "Describe the order",
      type: "text",
      required: true,
      display: "{value}",
    },
  ],
  quantity: { min: 1, max: 999 },
};

// The Other Preorders section is description-only: no quantity, weight, or notes.
const otherPreorderConfig: ProductFormConfig = {
  ...otherConfig,
  quantity: null,
  hideWeight: true,
  hideNotes: true,
};

const SEED_PRODUCTS: Array<{
  name: string;
  department: schema.Department;
  productType: string;
  formConfig: ProductFormConfig;
}> = [
  { name: "Salmon", department: "fish", productType: "Fish", formConfig: salmonConfig },
  { name: "Sea Bass", department: "fish", productType: "Fish", formConfig: seaBassBreamConfig() },
  { name: "Sea Bream", department: "fish", productType: "Fish", formConfig: seaBassBreamConfig() },
  { name: "Cod", department: "fish", productType: "Fish", formConfig: codConfig },
  { name: "Mussels", department: "fish", productType: "Fish", formConfig: musselsConfig },
  { name: "Pasta Clams 10lbs", department: "fish", productType: "Fish", formConfig: pastaClamsConfig },
  { name: "Live Lobster", department: "fish", productType: "Fish", formConfig: liveLobsterConfig },
  ...MEAT_PRODUCTS.map((m) => ({
    name: m.name,
    department: "meat" as schema.Department,
    productType: "Meat",
    formConfig: m.formConfig,
  })),
  // One free-text "Other" card per section
  { name: "Other", department: "fish", productType: "Fish", formConfig: otherConfig },
  { name: "Other", department: "meat", productType: "Meat", formConfig: otherConfig },
  { name: "Other", department: "other", productType: "Other", formConfig: otherPreorderConfig },
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
      where: and(
        eq(schema.products.productName, p.name),
        eq(schema.products.department, p.department),
      ),
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
