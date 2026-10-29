-- Codes to Fix: every input is optional (user, 2026-10-29). Only drops NOT
-- NULL; no data changes.
alter table public.code_fixes alter column client_name drop not null;
--> statement-breakpoint
alter table public.code_fix_lines alter column price drop not null;
--> statement-breakpoint
alter table public.code_fix_lines alter column general_sku drop not null;
--> statement-breakpoint
alter table public.code_fix_lines alter column general_description drop not null;
