-- Buyers can also view the applications table (status edits remain admin-only,
-- enforced in the server action).
DROP POLICY IF EXISTS applications_select_admin ON public.applications;
--> statement-breakpoint
CREATE POLICY applications_select_buyer_admin ON public.applications
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('admin', 'buyer'));
