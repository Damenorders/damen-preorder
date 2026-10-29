import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./schema";

// ---------------------------------------------------------------------------
// Codes to Fix (drizzle/0033_code_fixes.sql)
//
// Reps log a client's special SKU, its general equivalent and the client's
// price; buyers fix each line by hand in Odoo and toggle it Pending → Fixed.
// The SKU/description lookup uses only its own template (code_fix_catalog),
// loaded once from the user's Excel — not the Odoo or warehouse catalogues.
// ---------------------------------------------------------------------------

/** The SKU + description template, exactly as loaded. */
export const codeFixCatalog = pgTable("code_fix_catalog", {
  sku: text("sku").primaryKey(),
  description: text("description").notNull(),
});

/** One entry: a client and a note. Its products are code_fix_lines. */
export const codeFixes = pgTable(
  "code_fixes",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    clientName: text("client_name"),
    note: text("note"),
    createdBy: uuid("created_by").references(() => users.id),
    createdByName: text("created_by_name").notNull().default(""),
    updatedByName: text("updated_by_name").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("code_fixes_created_idx").on(t.createdAt)],
);

/**
 * One product on an entry. Every field is optional (user, 2026-10-29). A SKU
 * in the template takes its description; any other keeps what was typed.
 * Status is per line — the buyer fixes lines one at a time.
 */
export const codeFixLines = pgTable(
  "code_fix_lines",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    codeFixId: integer("code_fix_id")
      .notNull()
      .references(() => codeFixes.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    clientSku: text("client_sku"),
    clientDescription: text("client_description"),
    price: numeric("price", { precision: 12, scale: 2 }),
    generalSku: text("general_sku"),
    generalDescription: text("general_description"),
    status: text("status", { enum: ["pending", "fixed"] })
      .notNull()
      .default("pending"),
    fixedByName: text("fixed_by_name"),
    fixedAt: timestamp("fixed_at", { withTimezone: true }),
  },
  (t) => [index("code_fix_lines_entry_idx").on(t.codeFixId)],
);

export type CodeFix = typeof codeFixes.$inferSelect;
export type CodeFixLine = typeof codeFixLines.$inferSelect;
export type CodeFixStatus = CodeFixLine["status"];
