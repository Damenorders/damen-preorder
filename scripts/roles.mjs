import { readFileSync } from "node:fs";
import postgres from "postgres";
const url = readFileSync(".env.local","utf8").split(/\r?\n/).find(l=>l.startsWith("DATABASE_URL=")).slice(13).trim();
const sql = postgres(url,{max:1,prepare:false,connect_timeout:30});
const rows = await sql`select name, email, role, active from users order by role`;
console.table(rows);
await sql.end();
