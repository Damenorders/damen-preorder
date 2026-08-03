-- Warehouse Inventory — item catalog, pallet placements, audit trail.
-- All app access goes through the Next.js server (role-checked in
-- src/app/actions/inventory.ts); see 0021 for the direct-Supabase lockdown.

create type warehouse_unit as enum ('dry', 'freezer', 'fridge40', 'fridge50', 'fridge60');
--> statement-breakpoint

-- The item catalog, mirroring the ERP export (sItem, sDesc, SECTION).
create table if not exists public.inventory_items (
  code        text primary key,
  description text not null,
  section     text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
--> statement-breakpoint

-- One row per item sitting at a location. `location` is the human location code
-- the warehouse actually uses: '15-B-3' for a rack slot (rack-level-position,
-- with a trailing a/b/c on double- and triple-deep racks), or 'floor:1' for a
-- floor-storage area. A location holds up to 6 items.
create table if not exists public.inventory_placements (
  id          uuid primary key default gen_random_uuid(),
  unit        warehouse_unit not null,
  location    text not null,
  rack        integer,
  level       text,
  position    text,
  floor_id    text,
  item_code   text not null,
  description text not null default '',
  quantity    integer not null default 1 check (quantity >= 0),
  updated_by  uuid references public.users(id),
  updated_at  timestamptz not null default now(),
  constraint inventory_placements_unique unique (unit, location, item_code)
);
--> statement-breakpoint
create index if not exists inventory_placements_item_idx on public.inventory_placements (item_code);
--> statement-breakpoint
create index if not exists inventory_placements_unit_idx on public.inventory_placements (unit, rack);
--> statement-breakpoint

-- Full audit trail, same intent as audit_logs but shaped for locations.
create table if not exists public.inventory_audit (
  id            uuid primary key default gen_random_uuid(),
  action        text not null, -- added | removed | qty | moved | swapped | cleared
  unit          warehouse_unit,
  item_code     text,
  description   text,
  location      text,
  from_location text,
  to_location   text,
  quantity      integer,
  prev_quantity integer,
  user_id       uuid references public.users(id),
  user_name     text not null default '',
  created_at    timestamptz not null default now()
);
--> statement-breakpoint
create index if not exists inventory_audit_created_idx on public.inventory_audit (created_at desc);
