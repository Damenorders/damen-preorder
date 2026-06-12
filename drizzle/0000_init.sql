CREATE TYPE "public"."buyer_table_status" AS ENUM('pending', 'ordered', 'received', 'pending_delivery', 'pending_pickup');--> statement-breakpoint
CREATE TYPE "public"."department" AS ENUM('meat', 'fish', 'other');--> statement-breakpoint
CREATE TYPE "public"."odoo_sync_status" AS ENUM('not_synced', 'synced', 'error');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'buyer', 'rep');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('pending', 'ready', 'shipped');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" uuid,
	"user_name" text NOT NULL,
	"action" text NOT NULL,
	"record_type" text NOT NULL,
	"record_id" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "clients_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"external_id" text,
	"odoo_id" integer,
	"client_name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"odoo_sync_status" "odoo_sync_status" DEFAULT 'not_synced' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "order_lines" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "order_lines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"external_id" text,
	"odoo_id" integer,
	"order_id" integer NOT NULL,
	"department" "department" NOT NULL,
	"product" text NOT NULL,
	"specs" text DEFAULT '' NOT NULL,
	"specs_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"quantity" integer NOT NULL,
	"weight" numeric(10, 2),
	"notes" text,
	"odoo_sync_status" "odoo_sync_status" DEFAULT 'not_synced' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_lines_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"external_id" text,
	"odoo_id" integer,
	"department" "department" NOT NULL,
	"client_name" text NOT NULL,
	"client_external_id" text,
	"delivery_date" date NOT NULL,
	"rep_user_id" uuid NOT NULL,
	"rep_name" text NOT NULL,
	"rep_email" text NOT NULL,
	"submission_status" "submission_status" DEFAULT 'pending' NOT NULL,
	"buyer_table_status" "buyer_table_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"odoo_sync_status" "odoo_sync_status" DEFAULT 'not_synced' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"external_id" text,
	"odoo_id" integer,
	"department" "department" NOT NULL,
	"product_name" text NOT NULL,
	"product_type" text,
	"form_config" jsonb DEFAULT '{"fields":[]}'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"odoo_sync_status" "odoo_sync_status" DEFAULT 'not_synced' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"external_id" text,
	"odoo_id" integer,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" "user_role" DEFAULT 'rep' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"odoo_sync_status" "odoo_sync_status" DEFAULT 'not_synced' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_external_id_unique" UNIQUE("external_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_rep_user_id_users_id_fk" FOREIGN KEY ("rep_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;