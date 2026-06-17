// Verifies the order_errors table end-to-end at the DB level: insert a row
// (as the create action would), read it back, confirm it's isolated from the
// orders/buyer-table data. Retries through transient pooler blips.
import { readFileSync } from "node:fs";
import postgres from "postgres";

const url = readFileSync(".env.local", "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="))
  .slice("DATABASE_URL=".length)
  .trim();

const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 30 });

async function withRetry(fn, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise((r) => setTimeout(r, 800));
    }
  }
}

const [rep] = await withRetry(
  () => sql`select id, name, email from users where email = 'commandes@damenalimentaire.com'`,
);
const [client] = await withRetry(
  () => sql`select id, client_name, external_id from clients where client_name = 'Sushi Taxi'`,
);

const [created] = await withRetry(
  () => sql`
    insert into order_errors
      (customer_name, customer_external_id, error_date, order_number,
       error_type, department, note, submitted_by_user_id, submitted_by_name)
    values
      (${client.client_name}, ${client.external_id}, '2026-06-17', '10482',
       'damaged_product', 'fish', 'Salmon 10/12 arrived bruised',
       ${rep.id}, ${rep.name})
    returning id`,
);
await withRetry(
  () => sql`update order_errors set external_id = ${"damen_order_error_" + String(created.id).padStart(6, "0")} where id = ${created.id}`,
);

const rows = await withRetry(
  () => sql`select external_id, customer_name, error_type, department, order_number, note, submitted_by_name
            from order_errors order by created_at desc limit 5`,
);
console.log("order_errors rows:");
console.table(rows);

// Isolation: error must NOT appear as an order/order_line
const [{ count: orderCount }] = await withRetry(
  () => sql`select count(*)::int as count from orders where notes = 'Salmon 10/12 arrived bruised'`,
);
console.log(`leaked into orders table: ${orderCount === 0 ? "NO (correct)" : "YES (BUG)"}`);

await sql.end();
