-- Extend warehouse inventory READ access to the dispatch role, matching the
-- buyer/admin grants in 0021. Every mutation still goes through the role-checked
-- server actions; this only widens the direct-Supabase SELECT policy.

alter policy inventory_items_select_buyer_admin on public.inventory_items
  using (public.current_user_role() in ('admin', 'buyer', 'dispatch'));
--> statement-breakpoint
alter policy inventory_placements_select_buyer_admin on public.inventory_placements
  using (public.current_user_role() in ('admin', 'buyer', 'dispatch'));
--> statement-breakpoint
alter policy inventory_audit_select_buyer_admin on public.inventory_audit
  using (public.current_user_role() in ('admin', 'buyer', 'dispatch'));
