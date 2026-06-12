-- Row Level Security + privilege hardening (kickoff hard rule 1).
--
-- Architecture: ALL reads and writes in the app flow through the Next.js
-- server (Drizzle on the postgres role), which enforces role checks in code.
-- This migration locks down the OTHER path — direct calls to Supabase's
-- auto-generated REST API with a user's JWT — so a rep can never fetch buyer
-- table data, buyer statuses, or other reps' records even with hand-crafted
-- requests:
--   * anon gets nothing;
--   * authenticated users get SELECT only (no direct INSERT/UPDATE/DELETE);
--   * orders.buyer_table_status is excluded from the column grant entirely,
--     so no client JWT can ever read it directly (buyers get it via the
--     server);
--   * RLS row policies restrict reps to their own orders.

-- ---------------------------------------------------------------------------
-- Helper: current user's app role, bypassing RLS on public.users
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text from public.users where id = auth.uid() and active = true
$$;
--> statement-breakpoint
revoke all on function public.current_user_role() from public, anon;
--> statement-breakpoint
grant execute on function public.current_user_role() to authenticated;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
--> statement-breakpoint
alter table public.clients enable row level security;
--> statement-breakpoint
alter table public.products enable row level security;
--> statement-breakpoint
alter table public.orders enable row level security;
--> statement-breakpoint
alter table public.order_lines enable row level security;
--> statement-breakpoint
alter table public.audit_logs enable row level security;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Reset privileges: anon gets nothing; authenticated gets SELECT only.
-- All mutations go through the Next.js server (postgres role, role-checked
-- in code). service_role keeps full access for the seed script.
-- ---------------------------------------------------------------------------
revoke all on public.users, public.clients, public.products,
  public.orders, public.order_lines, public.audit_logs
  from anon, authenticated;
--> statement-breakpoint
grant select on public.users to authenticated;
--> statement-breakpoint
grant select on public.clients to authenticated;
--> statement-breakpoint
grant select on public.products to authenticated;
--> statement-breakpoint
grant select on public.order_lines to authenticated;
--> statement-breakpoint
grant select on public.audit_logs to authenticated;
--> statement-breakpoint

-- orders: column-level grant that deliberately EXCLUDES buyer_table_status
-- (SPEC.md §12 — buyer/admin only; reps must never see it, and since both
-- roles share the `authenticated` DB role, no client reads it directly).
grant select (
  id, external_id, odoo_id, department, client_name, client_external_id,
  delivery_date, rep_user_id, rep_name, rep_email, submission_status,
  notes, odoo_sync_status, last_synced_at, created_at, updated_at
) on public.orders to authenticated;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Row policies
-- ---------------------------------------------------------------------------

-- users: everyone sees their own profile; admins see all
create policy users_select_own on public.users
  for select to authenticated
  using (id = (select auth.uid()) or public.current_user_role() = 'admin');
--> statement-breakpoint

-- clients & products: readable by any active staff member (needed to fill forms)
create policy clients_select_staff on public.clients
  for select to authenticated
  using (public.current_user_role() is not null);
--> statement-breakpoint
create policy products_select_staff on public.products
  for select to authenticated
  using (public.current_user_role() is not null);
--> statement-breakpoint

-- orders: admin/buyer see all rows; reps see only their own (SPEC.md §3.3)
create policy orders_select_by_role on public.orders
  for select to authenticated
  using (
    public.current_user_role() in ('admin', 'buyer')
    or rep_user_id = (select auth.uid())
  );
--> statement-breakpoint

-- order_lines: visible when the parent order is visible
create policy order_lines_select_by_role on public.order_lines
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (
          public.current_user_role() in ('admin', 'buyer')
          or o.rep_user_id = (select auth.uid())
        )
    )
  );
--> statement-breakpoint

-- audit_logs: admin only (SPEC.md §3.1 — view audit history)
create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated
  using (public.current_user_role() = 'admin');
