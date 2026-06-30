-- Track when an order is changed via the Edit form, and a short summary of
-- what changed, so submission cards can show an "Edited" pill with detail.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "edited_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "edit_summary" text;
