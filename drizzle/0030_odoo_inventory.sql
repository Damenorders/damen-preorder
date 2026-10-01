-- Odoo Inventory — a second, completely separate warehouse for the Odoo count.
-- Same physical layout as Warehouse Inventory, but its own catalogue (the
-- uploaded Odoo list), placements and audit trail. Nothing here touches the
-- inventory_* tables. Additive only: new type and tables, no existing object
-- changes. Access goes through the role-checked server actions in
-- src/app/actions/odoo-inventory.ts.

create type odoo_warehouse_unit as enum ('dry', 'freezer', 'fridge40', 'fridge50', 'fridge60');
--> statement-breakpoint

-- The Odoo product list as uploaded. A re-upload that drops a SKU marks it
-- inactive (never deletes it), so counted products keep their SKU.
create table if not exists public.odoo_items (
  sku         text primary key,
  description text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
--> statement-breakpoint

-- One row per product at a location. `sku` is null for a product not in the
-- Odoo list; `item_key` (the SKU, or the typed description) keeps a product
-- unique at its location.
create table if not exists public.odoo_placements (
  id            uuid primary key default gen_random_uuid(),
  unit          odoo_warehouse_unit not null,
  location      text not null,
  rack          integer,
  level         text,
  position      text,
  floor_id      text,
  item_key      text not null,
  sku           text,
  description   text not null default '',
  quantity      integer not null default 0 check (quantity >= 0),
  quantity_unit integer not null default 0 check (quantity_unit >= 0),
  consignment   boolean not null default false,
  updated_by    uuid references public.users(id),
  updated_at    timestamptz not null default now(),
  constraint odoo_placements_unique unique (unit, location, item_key)
);
--> statement-breakpoint
create index if not exists odoo_placements_sku_idx on public.odoo_placements (sku);
--> statement-breakpoint
create index if not exists odoo_placements_unit_idx on public.odoo_placements (unit, rack);
--> statement-breakpoint

create table if not exists public.odoo_audit (
  id                 uuid primary key default gen_random_uuid(),
  action             text not null, -- added | removed | qty | consignment | catalog
  unit               odoo_warehouse_unit,
  sku                text,
  description        text,
  location           text,
  from_location      text,
  to_location        text,
  quantity           integer,
  prev_quantity      integer,
  quantity_unit      integer,
  prev_quantity_unit integer,
  consignment        boolean,
  user_id            uuid references public.users(id),
  user_name          text not null default '',
  created_at         timestamptz not null default now()
);
--> statement-breakpoint
create index if not exists odoo_audit_created_idx on public.odoo_audit (created_at desc);
--> statement-breakpoint

-- Same lockdown as 0021/0022: direct Supabase clients get SELECT only for the
-- roles that use the card, and never INSERT/UPDATE/DELETE.
alter table public.odoo_items enable row level security;
--> statement-breakpoint
alter table public.odoo_placements enable row level security;
--> statement-breakpoint
alter table public.odoo_audit enable row level security;
--> statement-breakpoint
revoke all on public.odoo_items from anon, authenticated;
--> statement-breakpoint
revoke all on public.odoo_placements from anon, authenticated;
--> statement-breakpoint
revoke all on public.odoo_audit from anon, authenticated;
--> statement-breakpoint
grant select on public.odoo_items to authenticated;
--> statement-breakpoint
grant select on public.odoo_placements to authenticated;
--> statement-breakpoint
grant select on public.odoo_audit to authenticated;
--> statement-breakpoint
create policy odoo_items_select on public.odoo_items
  for select to authenticated
  using (public.current_user_role() in ('admin', 'buyer', 'dispatch'));
--> statement-breakpoint
create policy odoo_placements_select on public.odoo_placements
  for select to authenticated
  using (public.current_user_role() in ('admin', 'buyer', 'dispatch'));
--> statement-breakpoint
create policy odoo_audit_select on public.odoo_audit
  for select to authenticated
  using (public.current_user_role() in ('admin', 'buyer', 'dispatch'));
