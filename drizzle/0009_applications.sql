-- Applications table: Damen Online access requests submitted by the clients
-- role, reviewed by admins.
CREATE TYPE "public"."application_status" AS ENUM('new', 'approved', 'rejected');
--> statement-breakpoint
CREATE TABLE "applications" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "external_id" text UNIQUE,
  "business_name" text NOT NULL,
  "contact_name" text NOT NULL,
  "phone" text NOT NULL,
  "email" text NOT NULL,
  "status" "public"."application_status" NOT NULL DEFAULT 'new',
  "submitted_by_user_id" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
-- All access is server-side (role-checked); lock down the direct Supabase path.
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON public.applications FROM anon, authenticated;
--> statement-breakpoint
GRANT SELECT ON public.applications TO authenticated;
--> statement-breakpoint
CREATE POLICY applications_select_admin ON public.applications
  FOR SELECT TO authenticated
  USING (public.current_user_role() = 'admin');
