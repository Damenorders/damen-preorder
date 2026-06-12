import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  numeric,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

// picker: warehouse role — sees all submissions (read-only), nothing else
export const roleEnum = pgEnum("user_role", ["admin", "buyer", "rep", "picker"]);

// SPEC.md §2 — Meat Orders / Fish Orders / Other Preorders
export const departmentEnum = pgEnum("department", ["meat", "fish", "other"]);

// SPEC.md §11 — visible to reps
export const submissionStatusEnum = pgEnum("submission_status", [
  "pending",
  "ready",
  "shipped",
]);

// SPEC.md §12 — buyer/admin only
export const buyerTableStatusEnum = pgEnum("buyer_table_status", [
  "pending",
  "ordered",
  "received",
  "pending_delivery",
  "pending_pickup",
]);

export const odooSyncStatusEnum = pgEnum("odoo_sync_status", [
  "not_synced",
  "synced",
  "error",
]);

// ---------------------------------------------------------------------------
// Tables — SPEC.md §24, with Odoo-ready fields per §22 on every record
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  // Mirrors auth.users.id from Supabase Auth
  id: uuid("id").primaryKey(),
  externalId: text("external_id").unique(),
  odooId: integer("odoo_id"),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: roleEnum("role").notNull().default("rep"),
  active: boolean("active").notNull().default(true),
  odooSyncStatus: odooSyncStatusEnum("odoo_sync_status")
    .notNull()
    .default("not_synced"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const clients = pgTable("clients", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  externalId: text("external_id").unique(),
  odooId: integer("odoo_id"),
  clientName: text("client_name").notNull(),
  active: boolean("active").notNull().default(true),
  odooSyncStatus: odooSyncStatusEnum("odoo_sync_status")
    .notNull()
    .default("not_synced"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const products = pgTable("products", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  externalId: text("external_id").unique(),
  odooId: integer("odoo_id"),
  department: departmentEnum("department").notNull(),
  productName: text("product_name").notNull(),
  productType: text("product_type"),
  // Dynamic form definition (SPEC.md §7–8): which questions appear for this
  // product. Stored as data so Meat/Fish/Other inputs can change without code.
  formConfig: jsonb("form_config").notNull().default({ fields: [] }),
  active: boolean("active").notNull().default(true),
  odooSyncStatus: odooSyncStatusEnum("odoo_sync_status")
    .notNull()
    .default("not_synced"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const orders = pgTable("orders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  externalId: text("external_id").unique(),
  odooId: integer("odoo_id"),
  department: departmentEnum("department").notNull(),
  clientName: text("client_name").notNull(),
  clientExternalId: text("client_external_id"),
  deliveryDate: date("delivery_date").notNull(),
  repUserId: uuid("rep_user_id")
    .notNull()
    .references(() => users.id),
  repName: text("rep_name").notNull(),
  repEmail: text("rep_email").notNull(),
  submissionStatus: submissionStatusEnum("submission_status")
    .notNull()
    .default("pending"),
  buyerTableStatus: buyerTableStatusEnum("buyer_table_status")
    .notNull()
    .default("pending"),
  notes: text("notes"),
  odooSyncStatus: odooSyncStatusEnum("odoo_sync_status")
    .notNull()
    .default("not_synced"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const orderLines = pgTable("order_lines", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  externalId: text("external_id").unique(),
  odooId: integer("odoo_id"),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  department: departmentEnum("department").notNull(),
  product: text("product").notNull(),
  // SPEC.md §25 — specs stored both ways
  specs: text("specs").notNull().default(""),
  specsJson: jsonb("specs_json").notNull().default({}),
  quantity: integer("quantity").notNull(),
  weight: numeric("weight", { precision: 10, scale: 2 }),
  notes: text("notes"),
  odooSyncStatus: odooSyncStatusEnum("odoo_sync_status")
    .notNull()
    .default("not_synced"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: uuid("user_id"),
  userName: text("user_name").notNull(),
  action: text("action").notNull(),
  recordType: text("record_type").notNull(),
  recordId: text("record_id").notNull(),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export type User = typeof users.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderLine = typeof orderLines.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;

export type Role = User["role"];
export type Department = Order["department"];
export type SubmissionStatus = Order["submissionStatus"];
export type BuyerTableStatus = Order["buyerTableStatus"];
