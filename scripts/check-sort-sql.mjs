// Verifies all four sort-toggle combinations directly against the database.
import { readFileSync } from "node:fs";
import postgres from "postgres";

const line = readFileSync(".env.local", "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
const sql = postgres(line.slice("DATABASE_URL=".length).trim(), { max: 1, prepare: false });

const PRIORITY = { pending: 1, ordered: 2, pending_delivery: 3, pending_pickup: 4, received: 5 };
const prioritySql = sql`case o.buyer_table_status
  when 'pending' then 1 when 'ordered' then 2 when 'pending_delivery' then 3
  when 'pending_pickup' then 4 when 'received' then 5 else 6 end`;

async function fetchRows(statusFirst, newestFirst) {
  const dateKey = newestFirst
    ? sql`o.delivery_date desc`
    : sql`o.delivery_date asc`;
  const orderBy = statusFirst
    ? sql`${prioritySql}, ${dateKey}, o.updated_at desc, ol.id`
    : sql`${dateKey}, ${prioritySql}, o.updated_at desc, ol.id`;
  return sql`
    select o.buyer_table_status as status, o.delivery_date::text as date
    from order_lines ol join orders o on o.id = ol.order_id
    order by ${orderBy}`;
}

function check(rows, statusFirst, newestFirst) {
  const cmpDate = (a, b) => (newestFirst ? a.date >= b.date : a.date <= b.date);
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    if (statusFirst) {
      if (PRIORITY[a.status] > PRIORITY[b.status]) return false;
      if (a.status === b.status && !cmpDate(a, b)) return false;
    } else {
      if (!cmpDate(a, b) && a.date !== b.date) return false;
      if (a.date === b.date && PRIORITY[a.status] > PRIORITY[b.status]) return false;
    }
  }
  return rows.length > 0;
}

for (const [statusFirst, newestFirst] of [[false, false], [false, true], [true, false], [true, true]]) {
  const rows = await fetchRows(statusFirst, newestFirst);
  const ok = check(rows, statusFirst, newestFirst);
  console.log(
    `statusFirst=${statusFirst} newestFirst=${newestFirst}: ${ok ? "PASS" : "FAIL"} (${rows.length} rows)`,
  );
}
await sql.end();
