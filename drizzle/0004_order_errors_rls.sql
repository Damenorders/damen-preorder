-- RLS for the order_errors table, matching the rest of the app: all app
-- access goes through the Next.js server (postgres role, role-checked); this
-- locks down the direct Supabase REST path. The errors table is buyer/admin
-- only, so authenticated clients get SELECT only when their role qualifies,
-- and never INSERT/UPDATE/DELETE (mutations go through the server action).

alter table public.order_errors enable row level security;
--> statement-breakpoint
revoke all on public.order_errors from anon, authenticated;
--> statement-breakpoint
grant select on public.order_errors to authenticated;
--> statement-breakpoint
create policy order_errors_select_buyer_admin on public.order_errors
  for select to authenticated
  using (public.current_user_role() in ('admin', 'buyer'));
