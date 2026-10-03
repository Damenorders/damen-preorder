-- Odoo Inventory: weight counts for the two fridges. The Fish Fridge counts
-- in pounds, the Meat Fridge in kilograms; a weight stays with its product
-- line wherever that line is moved. Two decimals, blank (null) when not
-- counted. Additive only: new nullable columns, nothing existing changes.

alter table public.odoo_placements
  add column if not exists weight_lbs numeric(12, 2) check (weight_lbs >= 0);
--> statement-breakpoint
alter table public.odoo_placements
  add column if not exists weight_kg numeric(12, 2) check (weight_kg >= 0);
--> statement-breakpoint
alter table public.odoo_audit add column if not exists weight_lbs numeric(12, 2);
--> statement-breakpoint
alter table public.odoo_audit add column if not exists weight_kg numeric(12, 2);
--> statement-breakpoint
alter table public.odoo_audit add column if not exists prev_weight_lbs numeric(12, 2);
--> statement-breakpoint
alter table public.odoo_audit add column if not exists prev_weight_kg numeric(12, 2);
