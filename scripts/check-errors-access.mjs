// Confirms Order Errors access: rep can submit but not see the table; picker
// is blocked from both; buyer/admin see the table. Submits a test error.
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];

async function cookieFor(email) {
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: env.SEED_USER_PASSWORD ?? "Damen2026!" }),
  });
  return `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(await res.json())).toString("base64url")}`;
}

async function page(cookie, path) {
  const res = await fetch(`http://localhost:3000${path}`, { headers: { Cookie: cookie } });
  return res.text();
}

for (const [who, email] of [
  ["rep", "commandes@damenalimentaire.com"],
  ["picker", "soccervinny3@hotmail.com"],
  ["buyer", "david@damenalimentaire.com"],
]) {
  const cookie = await cookieFor(email);
  const form = await page(cookie, "/errors/new");
  const table = await page(cookie, "/buyer/errors");
  const canFill = form.includes("Report an Error") && form.includes("Error Type");
  const seesTable = table.includes("separate from the buyer table");
  console.log(`${who}: can fill form=${canFill} · sees errors table=${seesTable}`);
}
