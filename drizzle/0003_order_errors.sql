CREATE TYPE "public"."error_type" AS ENUM('wrong_item', 'not_delivered', 'damaged_product', 'not_scheduled', 'shorted_items');--> statement-breakpoint
CREATE TABLE "order_errors" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "order_errors_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"external_id" text,
	"odoo_id" integer,
	"customer_name" text NOT NULL,
	"customer_external_id" text,
	"error_date" date NOT NULL,
	"order_number" text,
	"error_type" "error_type" NOT NULL,
	"department" "department" NOT NULL,
	"note" text,
	"submitted_by_user_id" uuid NOT NULL,
	"submitted_by_name" text NOT NULL,
	"odoo_sync_status" "odoo_sync_status" DEFAULT 'not_synced' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_errors_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
ALTER TABLE "order_errors" ADD CONSTRAINT "order_errors_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;