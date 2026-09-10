-- Product Lists — the buyer walks the warehouse, taps items out of the item
-- catalog, and builds a printable list for a client. Lists are shared from the
-- moment they are created so two people can build the same one at once; every
-- tap is its own row insert, never a whole-list rewrite (same rule as the
-- warehouse placements — a whole-blob save loses the other person's taps).

create type product_list_status as enum ('draft', 'saved');
--> statement-breakpoint

create table if not exists public.product_lists (
  id                 integer primary key generated always as identity,
  name               text not null,
  status             product_list_status not null default 'draft',
  created_by_user_id uuid references public.users(id),
  created_by_name    text not null default '',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
--> statement-breakpoint

-- One row per item on a list. The description is copied in at tap time so the
-- printed sheet keeps the wording the buyer saw, even if the catalog changes.
-- The unique constraint makes a double-tap (or two people tapping the same
-- item) a no-op instead of a duplicate line.
create table if not exists public.product_list_items (
  id            uuid primary key default gen_random_uuid(),
  list_id       integer not null references public.product_lists(id) on delete cascade,
  item_code     text not null,
  description   text not null default '',
  added_by_user_id uuid references public.users(id),
  added_by_name text not null default '',
  created_at    timestamptz not null default now(),
  constraint product_list_items_unique unique (list_id, item_code)
);
--> statement-breakpoint
create index if not exists product_list_items_list_idx on public.product_list_items (list_id, created_at);
--> statement-breakpoint
create index if not exists product_lists_updated_idx on public.product_lists (updated_at desc);
--> statement-breakpoint

-- Direct-Supabase lockdown, matching 0021_inventory_rls: authenticated clients
-- get SELECT only when their role qualifies and never write — every mutation
-- goes through the role-checked server actions.
alter table public.product_lists enable row level security;
--> statement-breakpoint
alter table public.product_list_items enable row level security;
--> statement-breakpoint

revoke all on public.product_lists from anon, authenticated;
--> statement-breakpoint
revoke all on public.product_list_items from anon, authenticated;
--> statement-breakpoint

grant select on public.product_lists to authenticated;
--> statement-breakpoint
grant select on public.product_list_items to authenticated;
--> statement-breakpoint

create policy product_lists_select_buyer_admin on public.product_lists
  for select to authenticated
  using (public.current_user_role() in ('admin', 'buyer'));
--> statement-breakpoint
create policy product_list_items_select_buyer_admin on public.product_list_items
  for select to authenticated
  using (public.current_user_role() in ('admin', 'buyer'));
