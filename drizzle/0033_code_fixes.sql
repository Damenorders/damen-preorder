-- Codes to Fix — reps log a client's special SKU, its general equivalent and
-- the client's price; buyers fix each line by hand and toggle it to fixed.
-- Additive only: three new tables, no existing object changes. Access goes
-- through the role-checked server actions in src/app/actions/code-fixes.ts.

-- The SKU + description template the form looks up, loaded once from the
-- user's Excel by scripts/load-code-fix-template.ts.
create table if not exists public.code_fix_catalog (
  sku         text primary key,
  description text not null
);
--> statement-breakpoint

create table if not exists public.code_fixes (
  id              integer primary key generated always as identity,
  client_name     text not null,
  note            text,
  created_by      uuid references public.users(id),
  created_by_name text not null default '',
  updated_by_name text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
--> statement-breakpoint
create index if not exists code_fixes_created_idx on public.code_fixes (created_at);
--> statement-breakpoint

create table if not exists public.code_fix_lines (
  id                  integer primary key generated always as identity,
  code_fix_id         integer not null references public.code_fixes(id) on delete cascade,
  position            integer not null default 0,
  client_sku          text,
  client_description  text,
  price               numeric(12, 2) not null check (price >= 0),
  general_sku         text not null,
  general_description text not null,
  status              text not null default 'pending' check (status in ('pending', 'fixed')),
  fixed_by_name       text,
  fixed_at            timestamptz
);
--> statement-breakpoint
create index if not exists code_fix_lines_entry_idx on public.code_fix_lines (code_fix_id);
--> statement-breakpoint

-- Same lockdown as 0030: direct Supabase clients get SELECT only for the
-- roles that use the card, and never INSERT/UPDATE/DELETE.
alter table public.code_fix_catalog enable row level security;
--> statement-breakpoint
alter table public.code_fixes enable row level security;
--> statement-breakpoint
alter table public.code_fix_lines enable row level security;
--> statement-breakpoint
revoke all on public.code_fix_catalog from anon, authenticated;
--> statement-breakpoint
revoke all on public.code_fixes from anon, authenticated;
--> statement-breakpoint
revoke all on public.code_fix_lines from anon, authenticated;
--> statement-breakpoint
grant select on public.code_fix_catalog to authenticated;
--> statement-breakpoint
grant select on public.code_fixes to authenticated;
--> statement-breakpoint
grant select on public.code_fix_lines to authenticated;
--> statement-breakpoint
create policy code_fix_catalog_select on public.code_fix_catalog
  for select to authenticated
  using (public.current_user_role() in ('admin', 'buyer', 'rep'));
--> statement-breakpoint
create policy code_fixes_select on public.code_fixes
  for select to authenticated
  using (public.current_user_role() in ('admin', 'buyer', 'rep'));
--> statement-breakpoint
create policy code_fix_lines_select on public.code_fix_lines
  for select to authenticated
  using (public.current_user_role() in ('admin', 'buyer', 'rep'));
