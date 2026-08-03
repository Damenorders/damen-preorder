import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { users } from "./schema";

// ---------------------------------------------------------------------------
// Warehouse Inventory (drizzle/0020_inventory.sql)
// ---------------------------------------------------------------------------

export const warehouseUnitEnum = pgEnum("warehouse_unit", [
  "dry",
  "freezer",
  "fridge40",
  "fridge50",
  "fridge60",
]);

export const inventoryItems = pgTable("inventory_items", {
  code: text("code").primaryKey(),
  description: text("description").notNull(),
  section: text("section").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * One row per item at a location. `location` is the code the warehouse uses:
 * "15-B-3" for a rack slot (rack-level-position, plus a trailing a/b/c on
 * double- and triple-deep racks), or "floor:1" for a floor-storage area.
 */
export const inventoryPlacements = pgTable(
  "inventory_placements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    unit: warehouseUnitEnum("unit").notNull(),
    location: text("location").notNull(),
    rack: integer("rack"),
    level: text("level"),
    position: text("position"),
    floorId: text("floor_id"),
    itemCode: text("item_code").notNull(),
    description: text("description").notNull().default(""),
    quantity: integer("quantity").notNull().default(1),
    updatedBy: uuid("updated_by").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("inventory_placements_unique").on(t.unit, t.location, t.itemCode),
    index("inventory_placements_item_idx").on(t.itemCode),
    index("inventory_placements_unit_idx").on(t.unit, t.rack),
  ],
);

export const inventoryAudit = pgTable(
  "inventory_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    action: text("action").notNull(),
    unit: warehouseUnitEnum("unit"),
    itemCode: text("item_code"),
    description: text("description"),
    location: text("location"),
    fromLocation: text("from_location"),
    toLocation: text("to_location"),
    quantity: integer("quantity"),
    prevQuantity: integer("prev_quantity"),
    userId: uuid("user_id").references(() => users.id),
    userName: text("user_name").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("inventory_audit_created_idx").on(t.createdAt)],
);

export type WarehouseUnit = (typeof warehouseUnitEnum.enumValues)[number];
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InventoryPlacement = typeof inventoryPlacements.$inferSelect;
export type InventoryAuditRow = typeof inventoryAudit.$inferSelect;
