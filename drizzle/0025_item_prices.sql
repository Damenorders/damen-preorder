-- Prices for the Product List. The buyer uploads a price file (SKU, Product,
-- Price — the shape of the PriceList export) and it lands here, one row per
-- catalog item. A Product List line shows this price unless the buyer typed an
-- override for that client, so re-uploading refreshes every list at once
-- without touching a price someone deliberately set.

create table if not exists public.item_prices (
  item_code       text primary key references public.inventory_items(code) on delete cascade,
  price           numeric(12, 4) not null,
  updated_by      uuid references public.users(id),
  updated_by_name text not null default '',
  source_file     text,
  updated_at      timestamptz not null default now()
);
--> statement-breakpoint

-- Null = use the uploaded price. A number here wins for this list only.
alter table public.product_list_items
  add column if not exists price_override numeric(12, 4);
--> statement-breakpoint

alter table public.item_prices enable row level security;
--> statement-breakpoint
revoke all on public.item_prices from anon, authenticated;
--> statement-breakpoint
grant select on public.item_prices to authenticated;
--> statement-breakpoint
create policy item_prices_select_buyer_admin on public.item_prices
  for select to authenticated
  using (public.current_user_role() in ('admin', 'buyer'));
