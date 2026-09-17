-- Suppliers view: what a product costs from a supplier and what we sell that
-- purchase pack for. Both are per PURCHASE pack — the uploaded selling price in
-- item_prices is per selling unit (often per kg) and is not comparable, so it
-- is not used here. Margin is never stored; it is always worked out from these.

alter table public.item_sourcing
  add column if not exists cost        numeric(12, 4) check (cost >= 0),
  add column if not exists sell        numeric(12, 4) check (sell >= 0),
  add column if not exists cost_set_on date,
  add column if not exists updated_at  timestamptz not null default now();
--> statement-breakpoint

-- One row per cost change, so "has this gone up, and by how much" can be
-- answered. It outlives the supplier link: removing a product from a supplier
-- keeps its history (sourcing_id is cleared, the code and supplier stay).
create table if not exists public.item_sourcing_cost_history (
  id              uuid primary key default gen_random_uuid(),
  sourcing_id     uuid references public.item_sourcing(id) on delete set null,
  item_code       text not null,
  supplier_id     integer not null references public.suppliers(id),
  old_cost        numeric(12, 4),
  new_cost        numeric(12, 4),
  changed_by      uuid references public.users(id),
  changed_by_name text not null default '',
  changed_at      timestamptz not null default now()
);
--> statement-breakpoint
create index if not exists item_sourcing_cost_history_item_idx
  on public.item_sourcing_cost_history (item_code, supplier_id, changed_at desc);
--> statement-breakpoint

alter table public.item_sourcing_cost_history enable row level security;
--> statement-breakpoint
revoke all on public.item_sourcing_cost_history from anon, authenticated;
--> statement-breakpoint
grant select on public.item_sourcing_cost_history to authenticated;
--> statement-breakpoint
create policy item_sourcing_cost_history_select_buyer_admin on public.item_sourcing_cost_history
  for select to authenticated
  using (public.current_user_role() in ('admin', 'buyer'));
