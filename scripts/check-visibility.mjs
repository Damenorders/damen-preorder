// Counts submission cards each role sees on the fish submissions page,
// and checks no buyer-status strings leak into rep HTML.
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];

async function htmlAs(email) {
  const tokenRes = await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: env.SEED_USER_PASSWORD ?? "Damen2026!" }),
    },
  );
  const session = await tokenRes.json();
  const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  const res = await fetch("http://localhost:3000/orders/fish/submissions", {
    headers: { Cookie: cookie },
  });
  return res.text();
}

for (const email of ["commandes@damenalimentaire.com", "david@damenalimentaire.com"]) {
  const html = await htmlAs(email);
  const cards = (html.match(/Sushi Taxi/g) ?? []).length;
  const leaks = ["Ordered", "Pending Delivery", "Pending Pickup", "Received", "buyer_table_status", "buyerTableStatus"]
    .filter((s) => html.includes(s));
  console.log(`${email}: ${cards} orders visible; buyer-status leaks: ${leaks.length ? leaks.join(", ") : "none"}`);
}
