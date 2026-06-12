// Verifies the status-first ORDER BY directly against the database.
import { readFileSync } from "node:fs";
import postgres from "postgres";

const line = readFileSync(".env.local", "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
const sql = postgres(line.slice("DATABASE_URL=".length).trim(), { max: 1, prepare: false });

const rows = await sql`
  select o.buyer_table_status as status, o.delivery_date::text as date, ol.id
  from order_lines ol join orders o on o.id = ol.order_id
  order by
    case o.buyer_table_status
      when 'pending' then 1 when 'ordered' then 2 when 'pending_delivery' then 3
      when 'pending_pickup' then 4 when 'received' then 5 else 6 end,
    o.delivery_date desc, o.updated_at desc, ol.id`;

const PRIORITY = { pending: 1, ordered: 2, pending_delivery: 3, pending_pickup: 4, received: 5 };
rows.forEach((r) => console.log(`${r.status.padEnd(10)} ${r.date}`));
let ok = rows.length > 0;
for (let i = 1; i < rows.length; i++) {
  const a = rows[i - 1], b = rows[i];
  if (PRIORITY[a.status] > PRIORITY[b.status]) ok = false;
  if (a.status === b.status && a.date < b.date) ok = false;
}
console.log(ok ? "PASS — pending top, received bottom, newest date first within each status" : "FAIL");
await sql.end();
