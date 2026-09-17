import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  numeric,
  date,
  timestamp,
  index,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { suppliers, users } from "./schema";
import { inventoryItems } from "./inventory-schema";

// ---------------------------------------------------------------------------
// Purchase Orders (drizzle/0026_purchase_orders.sql)
// ---------------------------------------------------------------------------

export const purchaseUnitEnum = pgEnum("purchase_unit", [
  "pallet",
  "case",
  "box",
  "bag",
  "each",
]);

export const purchaseOrderStatusEnum = pgEnum("purchase_order_status", [
  "open",
  "ordered",
]);

export const purchaseMethodEnum = pgEnum("purchase_method", [
  "delivery",
  "pickup",
]);

/** Who we buy a catalogue product from, in what purchase pack and unit. */
export const itemSourcing = pgTable(
  "item_sourcing",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemCode: text("item_code")
      .notNull()
      .references(() => inventoryItems.code, { onDelete: "cascade" }),
    supplierId: integer("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    supplierSku: text("supplier_sku").notNull().default(""),
    purchasePack: text("purchase_pack").notNull(),
    purchaseUnit: purchaseUnitEnum("purchase_unit").notNull(),
    preferred: boolean("preferred").notNull().default(true),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    assignedBy: uuid("assigned_by").references(() => users.id),
    assignedByName: text("assigned_by_name").notNull().default(""),
  },
  (t) => [
    unique("item_sourcing_item_supplier_unique").on(t.itemCode, t.supplierId),
    uniqueIndex("item_sourcing_one_preferred")
      .on(t.itemCode)
      .where(sql`preferred`),
    index("item_sourcing_supplier_idx").on(t.supplierId),
  ],
);

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    supplierId: integer("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    status: purchaseOrderStatusEnum("status").notNull().default("open"),
    method: purchaseMethodEnum("method").notNull().default("delivery"),
    wantedFor: date("wanted_for"),
    orderedOn: timestamp("ordered_on", { withTimezone: true }),
    orderedByUserId: uuid("ordered_by_user_id").references(() => users.id),
    orderedByName: text("ordered_by_name").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("purchase_orders_one_open")
      .on(t.supplierId)
      .where(sql`status = 'open'`),
    index("purchase_orders_status_idx").on(t.status, t.orderedOn),
  ],
);

/** A line keeps the name and pack as ordered; item_code has no FK on purpose. */
export const purchaseOrderLines = pgTable(
  "purchase_order_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: integer("order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" }),
    itemCode: text("item_code").notNull(),
    qty: numeric("qty", { precision: 12, scale: 3 }).notNull(),
    unit: purchaseUnitEnum("unit").notNull(),
    nameAtTime: text("name_at_time").notNull(),
    packAtTime: text("pack_at_time").notNull().default(""),
    addedByUserId: uuid("added_by_user_id").references(() => users.id),
    addedByName: text("added_by_name").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("purchase_order_lines_merge").on(t.orderId, t.itemCode, t.unit),
    index("purchase_order_lines_order_idx").on(t.orderId, t.createdAt),
    index("purchase_order_lines_item_idx").on(t.itemCode),
  ],
);

export type ItemSourcing = typeof itemSourcing.$inferSelect;
export type PurchaseOrderRow = typeof purchaseOrders.$inferSelect;
export type PurchaseOrderLineRow = typeof purchaseOrderLines.$inferSelect;
