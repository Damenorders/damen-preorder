-- RLS for the warehouse inventory tables, matching 0004_order_errors_rls:
-- authenticated clients get SELECT only when their role qualifies and never
-- INSERT/UPDATE/DELETE — every mutation goes through a server action.

alter table public.inventory_items enable row level security;
--> statement-breakpoint
alter table public.inventory_placements enable row level security;
--> statement-breakpoint
alter table public.inventory_audit enable row level security;
--> statement-breakpoint

revoke all on public.inventory_items from anon, authenticated;
--> statement-breakpoint
revoke all on public.inventory_placements from anon, authenticated;
--> statement-breakpoint
revoke all on public.inventory_audit from anon, authenticated;
--> statement-breakpoint

grant select on public.inventory_items to authenticated;
--> statement-breakpoint
grant select on public.inventory_placements to authenticated;
--> statement-breakpoint
grant select on public.inventory_audit to authenticated;
--> statement-breakpoint

create policy inventory_items_select_buyer_admin on public.inventory_items
  for select to authenticated
  using (public.current_user_role() in ('admin', 'buyer'));
--> statement-breakpoint
create policy inventory_placements_select_buyer_admin on public.inventory_placements
  for select to authenticated
  using (public.current_user_role() in ('admin', 'buyer'));
--> statement-breakpoint
create policy inventory_audit_select_buyer_admin on public.inventory_audit
  for select to authenticated
  using (public.current_user_role() in ('admin', 'buyer'));
