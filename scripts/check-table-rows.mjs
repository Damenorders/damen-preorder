// Verifies the flat buyer table: default view contents and §19 row ordering.
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

async function tableRows(path) {
  const res = await fetch(`http://localhost:3000${path}`, { headers: { Cookie: cookie } });
  const html = (await res.text())
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  const body = html.split("<tbody>")[1]?.split("</tbody>")[0] ?? "";
  return [...body.matchAll(/<tr[\s\S]*?<\/tr>/g)].map((m) => {
    const tr = m[0];
    const date = tr.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
    const status = tr.match(
      /<option[^>]*selected[^>]*value="(\w+)"|<option[^>]*value="(\w+)"[^>]*selected/,
    );
    return { date, status: status?.[1] ?? status?.[2] };
  });
}

const PRIORITY = { pending: 1, ordered: 2, pending_delivery: 3, pending_pickup: 4, received: 5 };

const all = await tableRows("/buyer/table?status=all&delivery=all");
console.log("ALL VIEW rows (date, status):");
all.forEach((r) => console.log(`  ${r.date}  ${r.status}`));
let sorted = true;
for (let i = 1; i < all.length; i++) {
  const a = all[i - 1], b = all[i];
  if (a.date > b.date) sorted = false;
  if (a.date === b.date && PRIORITY[a.status] > PRIORITY[b.status]) sorted = false;
}
console.log(sorted && all.length > 0 ? "PASS — §19 order (date, then status priority)" : "FAIL — ordering wrong");

const def = await tableRows("/buyer/table");
const okDefault =
  def.length > 0 && def.every((r) => r.status === "pending");
console.log(`\nDEFAULT VIEW: ${def.length} rows, all pending: ${okDefault ? "PASS" : "FAIL"}`);
def.forEach((r) => console.log(`  ${r.date}  ${r.status}`));
