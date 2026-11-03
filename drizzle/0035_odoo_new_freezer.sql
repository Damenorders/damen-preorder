-- Odoo Inventory: one more area, the New Freezer (racks #101 to #108, laid out
-- like the other racked areas). Additive only: one new value on the Odoo-only
-- enum, nothing else changes.

alter type odoo_warehouse_unit add value if not exists 'newfreezer';
