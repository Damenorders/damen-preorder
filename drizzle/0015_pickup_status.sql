DO $$ BEGIN
 CREATE TYPE "public"."pickup_status" AS ENUM('pending', 'picked_up');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "pickups" ADD COLUMN IF NOT EXISTS "status" "public"."pickup_status" DEFAULT 'pending' NOT NULL;
