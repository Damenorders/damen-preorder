-- Product List: its own product list, separate from the shared catalogue.
-- The Product List search shows only items flagged here; Warehouse Inventory
-- and Purchase Orders keep using inventory_items.active as before.
-- Additive only. Defaults to false, so nothing shows until the product list
-- is loaded (scripts/import-product-list.ts).

alter table inventory_items
  add column if not exists in_product_list boolean not null default false;
