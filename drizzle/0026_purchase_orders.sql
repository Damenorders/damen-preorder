-- Purchase Orders — the buyer types a product from the sales catalogue
-- (inventory_items) and the line lands on the right supplier's open order.
--
-- The catalogue is a SALES catalogue: what we buy, from whom and in what pack
-- is attached here, one product at a time, as buyers work. Every write is a
-- targeted row insert/update (never a whole-order rewrite), because two buyers
-- will be on this at once.

-- Suppliers are the same records Pickups and Deliveries use. Contact and email
-- feed the "Hello <contact>" of the copied order; aliases are other spellings
-- the supplier is known by.
alter table public.suppliers
  add column if not exists contact text not null default '',
  add column if not exists email   text not null default '',
  add column if not exists aliases text[] not null default '{}';
--> statement-breakpoint

create type purchase_unit as enum ('pallet', 'case', 'box', 'bag', 'each');
--> statement-breakpoint
create type purchase_order_status as enum ('open', 'ordered');
--> statement-breakpoint
create type purchase_method as enum ('delivery', 'pickup');
--> statement-breakpoint

-- Who we buy a catalogue product from, and in what pack. One row per product
-- per supplier; at most one of them is preferred, and the preferred one is what
-- the buyer card uses. Pack and unit are the PURCHASE pack and unit, typed as
-- printed on the invoice — never derived from the selling unit.
create table if not exists public.item_sourcing (
  id               uuid primary key default gen_random_uuid(),
  item_code        text not null references public.inventory_items(code) on delete cascade,
  supplier_id      integer not null references public.suppliers(id),
  supplier_sku     text not null default '',
  purchase_pack    text not null,
  purchase_unit    purchase_unit not null,
  preferred        boolean not null default true,
  assigned_at      timestamptz not null default now(),
  assigned_by      uuid references public.users(id),
  assigned_by_name text not null default '',
  constraint item_sourcing_item_supplier_unique unique (item_code, supplier_id),
  constraint item_sourcing_pack_not_blank check (btrim(purchase_pack) <> '')
);
--> statement-breakpoint
-- Two buyers assigning the same product at once: the second insert fails here
-- and is told who got there first, instead of silently overwriting.
create unique index if not exists item_sourcing_one_preferred
  on public.item_sourcing (item_code) where preferred;
--> statement-breakpoint
create index if not exists item_sourcing_supplier_idx on public.item_sourcing (supplier_id);
--> statement-breakpoint

create table if not exists public.purchase_orders (
  id                 integer primary key generated always as identity,
  supplier_id        integer not null references public.suppliers(id),
  status             purchase_order_status not null default 'open',
  method             purchase_method not null default 'delivery',
  wanted_for         date,
  ordered_on         timestamptz,
  ordered_by_user_id uuid references public.users(id),
  ordered_by_name    text not null default '',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
--> statement-breakpoint
-- One open order per supplier, enforced by the database rather than by luck.
create unique index if not exists purchase_orders_one_open
  on public.purchase_orders (supplier_id) where status = 'open';
--> statement-breakpoint
create index if not exists purchase_orders_status_idx
  on public.purchase_orders (status, ordered_on desc);
--> statement-breakpoint

-- Lines keep the name and pack as ordered, so history shows what was ordered,
-- not what the product is called today. item_code has no foreign key on
-- purpose: a past order must survive its product leaving the catalogue.
-- The unique key is the merge rule: same product at the same unit is one line.
create table if not exists public.purchase_order_lines (
  id               uuid primary key default gen_random_uuid(),
  order_id         integer not null references public.purchase_orders(id) on delete cascade,
  item_code        text not null,
  qty              numeric(12, 3) not null check (qty > 0),
  unit             purchase_unit not null,
  name_at_time     text not null,
  pack_at_time     text not null default '',
  added_by_user_id uuid references public.users(id),
  added_by_name    text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint purchase_order_lines_merge unique (order_id, item_code, unit)
);
--> statement-breakpoint
create index if not exists purchase_order_lines_order_idx
  on public.purchase_order_lines (order_id, created_at);
--> statement-breakpoint
create index if not exists purchase_order_lines_item_idx
  on public.purchase_order_lines (item_code);
--> statement-breakpoint

-- Direct-Supabase lockdown, matching 0024_product_lists: SELECT for buyer and
-- admin only, no writes — every mutation goes through the role-checked server
-- actions.
alter table public.item_sourcing enable row level security;
--> statement-breakpoint
alter table public.purchase_orders enable row level security;
--> statement-breakpoint
alter table public.purchase_order_lines enable row level security;
--> statement-breakpoint

revoke all on public.item_sourcing from anon, authenticated;
--> statement-breakpoint
revoke all on public.purchase_orders from anon, authenticated;
--> statement-breakpoint
revoke all on public.purchase_order_lines from anon, authenticated;
--> statement-breakpoint

grant select on public.item_sourcing to authenticated;
--> statement-breakpoint
grant select on public.purchase_orders to authenticated;
--> statement-breakpoint
grant select on public.purchase_order_lines to authenticated;
--> statement-breakpoint

create policy item_sourcing_select_buyer_admin on public.item_sourcing
  for select to authenticated
  using (public.current_user_role() in ('admin', 'buyer'));
--> statement-breakpoint
create policy purchase_orders_select_buyer_admin on public.purchase_orders
  for select to authenticated
  using (public.current_user_role() in ('admin', 'buyer'));
--> statement-breakpoint
create policy purchase_order_lines_select_buyer_admin on public.purchase_order_lines
  for select to authenticated
  using (public.current_user_role() in ('admin', 'buyer'));
