import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { users } from "./schema";
import { inventoryItems } from "./inventory-schema";

// ---------------------------------------------------------------------------
// Product Lists (drizzle/0024_product_lists.sql)
// ---------------------------------------------------------------------------

// A list starts as a 'draft' the moment it is created — so two people can build
// it together and a dead phone loses nothing — and becomes 'saved' when the
// buyer taps Save, which is what files it under Current Product Lists.
export const productListStatusEnum = pgEnum("product_list_status", [
  "draft",
  "saved",
]);

export const productLists = pgTable(
  "product_lists",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    status: productListStatusEnum("status").notNull().default("draft"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    createdByName: text("created_by_name").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("product_lists_updated_idx").on(t.updatedAt)],
);

/** One tapped catalog item. Unique per list, so a double-tap is a no-op. */
export const productListItems = pgTable(
  "product_list_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listId: integer("list_id")
      .notNull()
      .references(() => productLists.id, { onDelete: "cascade" }),
    itemCode: text("item_code").notNull(),
    description: text("description").notNull().default(""),
    /** Null = show the uploaded price; a number here wins for this list only. */
    priceOverride: numeric("price_override", { precision: 12, scale: 4 }),
    addedByUserId: uuid("added_by_user_id").references(() => users.id),
    addedByName: text("added_by_name").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("product_list_items_unique").on(t.listId, t.itemCode),
    index("product_list_items_list_idx").on(t.listId, t.createdAt),
  ],
);

/**
 * One price per catalog item, replaced by the buyer's price-file upload.
 * Kept out of inventory_items so a price refresh never rewrites the catalog.
 */
export const itemPrices = pgTable("item_prices", {
  itemCode: text("item_code")
    .primaryKey()
    .references(() => inventoryItems.code, { onDelete: "cascade" }),
  price: numeric("price", { precision: 12, scale: 4 }).notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedByName: text("updated_by_name").notNull().default(""),
  sourceFile: text("source_file"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ItemPrice = typeof itemPrices.$inferSelect;
export type ProductList = typeof productLists.$inferSelect;
export type ProductListStatus = ProductList["status"];
export type ProductListItem = typeof productListItems.$inferSelect;
