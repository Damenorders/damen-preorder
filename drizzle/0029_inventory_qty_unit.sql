-- Warehouse counts are split into boxes and loose units. `quantity` keeps its
-- meaning for every existing row and is now the BOX count (the counts taken so
-- far were boxes); `quantity_unit` is the loose-unit count and starts at 0.
-- The two are never added together here — conversion happens outside the app.
-- Additive only: the code already live keeps working until the deploy lands.

alter table public.inventory_placements
  add column if not exists quantity_unit integer not null default 0 check (quantity_unit >= 0);
--> statement-breakpoint
-- A row now carries two counts, so neither one defaults to a made-up 1.
alter table public.inventory_placements
  alter column quantity set default 0;
--> statement-breakpoint
alter table public.inventory_audit
  add column if not exists quantity_unit integer;
--> statement-breakpoint
alter table public.inventory_audit
  add column if not exists prev_quantity_unit integer;
