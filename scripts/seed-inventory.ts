/**
 * Seeds inventory_items from an ERP item export.
 *
 *   npx tsx scripts/seed-inventory.ts data/items-sec.csv
 *
 * The export is semicolon-delimited `sItem;sDesc;SECTION` and comes out of the
 * ERP as windows-1252, so it is decoded as latin1 (UTF-8 would mangle the
 * accented French descriptions). Existing codes are updated, not duplicated.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "node:fs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { inventoryItems } from "../src/db/schema";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: tsx scripts/seed-inventory.ts <csv>");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const text = readFileSync(file, "latin1");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const header = lines.shift();
  if (!header?.toLowerCase().startsWith("sitem")) {
    throw new Error(`Unexpected header: ${header}`);
  }

  const rows = lines.flatMap((line) => {
    const parts = line.split(";");
    if (parts.length < 3) return [];
    const code = parts[0].trim();
    const description = parts.slice(1, -1).join(";").trim();
    const section = parts[parts.length - 1].trim();
    if (!code || !description) return [];
    return [{ code, description, section, active: true }];
  });

  const client = postgres(url, { prepare: false });
  const db = drizzle(client, { schema });

  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db
      .insert(inventoryItems)
      .values(rows.slice(i, i + CHUNK))
      .onConflictDoUpdate({
        target: inventoryItems.code,
        set: {
          description: sql`excluded.description`,
          section: sql`excluded.section`,
          active: true,
          updatedAt: new Date(),
        },
      });
  }

  console.log(`Seeded ${rows.length} items from ${file}`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
