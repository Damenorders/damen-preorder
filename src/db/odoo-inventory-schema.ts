import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { users } from "./schema";

// ---------------------------------------------------------------------------
// Odoo Inventory (drizzle/0030_odoo_inventory.sql)
//
// A second, completely separate warehouse used for the Odoo count: same
// physical layout as Warehouse Inventory, but its own catalogue (the uploaded
// Odoo list), its own placements and its own audit trail. Nothing here reads
// or writes the inventory_* tables, and nothing else on the site reads these.
// ---------------------------------------------------------------------------

export const odooWarehouseUnitEnum = pgEnum("odoo_warehouse_unit", [
  "dry",
  "freezer",
  "fridge40",
  "fridge50",
  "fridge60",
  // Single-location fridges (drizzle/0031_odoo_fridges.sql): no racks, one
  // floor area 'main' holding any number of products.
  "meatfridge",
  "fishfridge",
]);

/**
 * The Odoo product list, exactly as uploaded. A re-upload that no longer
 * contains a SKU sets `active` false instead of deleting it, so a product
 * already counted on a shelf keeps its SKU and shows "No longer in Odoo list".
 */
export const odooItems = pgTable("odoo_items", {
  sku: text("sku").primaryKey(),
  description: text("description").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * One row per product at a location. `sku` is null for a product that is not
 * in the Odoo list (typed by description only). `item_key` is what makes a
 * row unique at its location: the SKU, or the typed description for a
 * product with no SKU.
 */
export const odooPlacements = pgTable(
  "odoo_placements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    unit: odooWarehouseUnitEnum("unit").notNull(),
    location: text("location").notNull(),
    rack: integer("rack"),
    level: text("level"),
    position: text("position"),
    floorId: text("floor_id"),
    itemKey: text("item_key").notNull(),
    sku: text("sku"),
    description: text("description").notNull().default(""),
    // Box count.
    quantity: integer("quantity").notNull().default(0),
    // Loose-unit count. Never added to the box count here.
    quantityUnit: integer("quantity_unit").notNull().default(0),
    // Weight counts (drizzle/0032): entered in the Fish Fridge (pounds) and the
    // Meat Fridge (kilograms); null when not counted. Kept with the line
    // wherever it moves, never converted from one unit to the other.
    weightLbs: numeric("weight_lbs", { precision: 12, scale: 2, mode: "number" }),
    weightKg: numeric("weight_kg", { precision: 12, scale: 2, mode: "number" }),
    consignment: boolean("consignment").notNull().default(false),
    updatedBy: uuid("updated_by").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("odoo_placements_unique").on(t.unit, t.location, t.itemKey),
    index("odoo_placements_sku_idx").on(t.sku),
    index("odoo_placements_unit_idx").on(t.unit, t.rack),
  ],
);

export const odooAudit = pgTable(
  "odoo_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    action: text("action").notNull(),
    unit: odooWarehouseUnitEnum("unit"),
    sku: text("sku"),
    description: text("description"),
    location: text("location"),
    fromLocation: text("from_location"),
    toLocation: text("to_location"),
    quantity: integer("quantity"),
    prevQuantity: integer("prev_quantity"),
    quantityUnit: integer("quantity_unit"),
    prevQuantityUnit: integer("prev_quantity_unit"),
    weightLbs: numeric("weight_lbs", { precision: 12, scale: 2, mode: "number" }),
    weightKg: numeric("weight_kg", { precision: 12, scale: 2, mode: "number" }),
    prevWeightLbs: numeric("prev_weight_lbs", { precision: 12, scale: 2, mode: "number" }),
    prevWeightKg: numeric("prev_weight_kg", { precision: 12, scale: 2, mode: "number" }),
    consignment: boolean("consignment"),
    userId: uuid("user_id").references(() => users.id),
    userName: text("user_name").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("odoo_audit_created_idx").on(t.createdAt)],
);

export type OdooWarehouseUnit = (typeof odooWarehouseUnitEnum.enumValues)[number];
export type OdooItem = typeof odooItems.$inferSelect;
export type OdooPlacement = typeof odooPlacements.$inferSelect;
