import { readFileSync } from "node:fs";
import postgres from "postgres";

const line = readFileSync(".env.local", "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
const sql = postgres(line.slice("DATABASE_URL=".length).trim(), {
  max: 1,
  prepare: false,
});
const rows = await sql`
  select id, client_name, delivery_date, buyer_table_status, submission_status
  from orders order by delivery_date, id`;
console.table(rows);
await sql.end();
