// Opens N fresh connections against transaction pooler (6543) and session
// pooler (5432) to measure the intermittent 28P01 failure rate.
import { readFileSync } from "node:fs";
import postgres from "postgres";

const line = readFileSync(".env.local", "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
const url = line.slice("DATABASE_URL=".length).trim();
const sessionUrl = url.replace(":6543/", ":5432/");

async function trial(label, target, n) {
  let ok = 0;
  const errors = {};
  for (let i = 0; i < n; i++) {
    const sql = postgres(target, { max: 1, prepare: false, connect_timeout: 10 });
    try {
      await sql`select 1`;
      ok++;
    } catch (e) {
      errors[e.code ?? e.message] = (errors[e.code ?? e.message] ?? 0) + 1;
    } finally {
      await sql.end({ timeout: 2 });
    }
  }
  console.log(`${label}: ${ok}/${n} ok`, Object.keys(errors).length ? errors : "");
}

await trial("transaction pooler :6543", url, 15);
await trial("session pooler     :5432", sessionUrl, 15);
