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
export const roleEnum = pgEnum("user_role", ["admin", "buyer", "rep", "picker", "scheduling", "clients"]);

export const applicationStatusEnum = pgEnum("application_status", [
  "new",
  "approved",
  "rejected",
]);

// SPEC.md §2 — Meat Orders / Fish Orders / Other Preorders.
// "warehouse" is used ONLY by the Order Errors form (not an order section);
// the order flows restrict themselves to meat/fish/other in code.
export const departmentEnum = pgEnum("department", [
  "meat",
  "fish",
  "other",
  "warehouse",
]);

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

// Order Errors form (separate from the order workflow entirely)
export const errorTypeEnum = pgEnum("error_type", [
  "wrong_item",
  "not_delivered",
  "damaged_product",
  "not_scheduled",
  "shorted_items",
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
  quantity: integer("quantity"),
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

// Order Errors — a standalone report, deliberately NOT linked to orders and
// never shown in the buyer table. Buyer/admin review it in its own table.
export const orderErrors = pgTable("order_errors", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  externalId: text("external_id").unique(),
  odooId: integer("odoo_id"),
  customerName: text("customer_name").notNull(),
  customerExternalId: text("customer_external_id"),
  errorDate: date("error_date").notNull(),
  orderNumber: text("order_number"),
  errorType: errorTypeEnum("error_type").notNull(),
  department: departmentEnum("department").notNull(),
  note: text("note"),
  submittedByUserId: uuid("submitted_by_user_id")
    .notNull()
    .references(() => users.id),
  submittedByName: text("submitted_by_name").notNull(),
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

// Online-platform access applications submitted by the "clients" role.
// Reviewed by admins, who then set up the real account.
export const applications = pgTable("applications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  externalId: text("external_id").unique(),
  businessName: text("business_name").notNull(),
  contactName: text("contact_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  status: applicationStatusEnum("status").notNull().default("new"),
  submittedByUserId: uuid("submitted_by_user_id").references(() => users.id),
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
export type OrderError = typeof orderErrors.$inferSelect;
export type Application = typeof applications.$inferSelect;
export type ApplicationStatus = Application["status"];
export type AuditLog = typeof auditLogs.$inferSelect;

export type ErrorType = OrderError["errorType"];

export type Role = User["role"];
export type Department = Order["department"];
export type SubmissionStatus = Order["submissionStatus"];
export type BuyerTableStatus = Order["buyerTableStatus"];
