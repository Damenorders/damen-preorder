// Clears ALL orders, order lines, and audit logs — for wiping test data
// right before real launch. Users, clients, and products are kept.
// DESTRUCTIVE — run only on purpose:  npx tsx scripts/clear-orders.ts --yes

import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";

async function main() {
  if (!process.argv.includes("--yes")) {
    console.log("This deletes ALL orders and audit history. Run with --yes to confirm.");
    process.exit(1);
  }
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  const db = drizzle(sql, { schema });

  const lines = await db.delete(schema.orderLines).returning({ id: schema.orderLines.id });
  const orders = await db.delete(schema.orders).returning({ id: schema.orders.id });
  const logs = await db.delete(schema.auditLogs).returning({ id: schema.auditLogs.id });
  console.log(`Deleted ${orders.length} orders, ${lines.length} lines, ${logs.length} audit entries.`);

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
