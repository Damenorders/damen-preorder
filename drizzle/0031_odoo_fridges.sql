-- Odoo Inventory: two more areas, the Meat Fridge and the Fish Fridge. Each is
-- a single location (stored as floor area 'main'), no racks or pallets.
-- Additive only: two new values on the Odoo-only enum, nothing else changes.

alter type odoo_warehouse_unit add value if not exists 'meatfridge';
--> statement-breakpoint
alter type odoo_warehouse_unit add value if not exists 'fishfridge';
