// Verifies the buyer table "Status first" sort: status priority groups,
// newest delivery date first within each group.
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];

const tr = await fetch(
  `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`,
  {
    method: "POST",
    headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "david@damenalimentaire.com",
      password: env.SEED_USER_PASSWORD ?? "Damen2026!",
    }),
  },
);
const session = await tr.json();
const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;

const res = await fetch(
  "http://localhost:3000/buyer/table?status=all&delivery=all&sort=status",
  { headers: { Cookie: cookie } },
);
const html = (await res.text()).replace(/<script[\s\S]*?<\/script>/g, "");
const tbody = html.split("<tbody>")[1].split("</tbody>")[0];

const PRIORITY = { pending: 1, ordered: 2, pending_delivery: 3, pending_pickup: 4, received: 5 };
const rows = [...tbody.matchAll(/<tr[\s\S]*?<\/tr>/g)].map((m) => {
  const sel = m[0].match(/<option[^>]*value="(\w+)"[^>]*selected|selected[^>]*value="(\w+)"/);
  const date = m[0].match(/[A-Z][a-z]{2} \d+, \d{4}/);
  return { status: sel ? (sel[1] ?? sel[2]) : "?", date: date ? new Date(date[0]) : null };
});

rows.forEach((r) => console.log(`${r.status.padEnd(16)} ${r.date?.toDateString()}`));

let ok = rows.length > 0;
for (let i = 1; i < rows.length; i++) {
  const a = rows[i - 1], b = rows[i];
  if (PRIORITY[a.status] > PRIORITY[b.status]) ok = false;
  if (a.status === b.status && a.date && b.date && a.date < b.date) ok = false; // newest first
}
console.log(ok ? "PASS — status groups in priority order, newest date first within each" : "FAIL");
