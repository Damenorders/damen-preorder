import { readFileSync } from "node:fs";
import postgres from "postgres";

const line = readFileSync(".env.local", "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
const url = line.slice("DATABASE_URL=".length).trim();

const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 10 });
try {
  await sql`select 1 as ok`;
  console.log("DB CONNECTION OK");
} catch (e) {
  console.log("DB CONNECTION FAILED: " + e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
