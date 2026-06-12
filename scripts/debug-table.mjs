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

for (const url of [
  "/buyer/table?status=all&delivery=all",
  "/buyer/table?status=all&delivery=all&sort=status",
]) {
  const res = await fetch(`http://localhost:3000${url}`, { headers: { Cookie: cookie } });
  const html = await res.text();
  const visible = html.replace(/<script[\s\S]*?<\/script>/g, "");
  console.log(url);
  console.log("  status:", res.status);
  console.log("  <tbody> count:", (visible.match(/<tbody>/g) ?? []).length);
  console.log("  <tr count:", (visible.match(/<tr/g) ?? []).length);
  console.log("  subtitle:", visible.match(/(\d+) lines?/)?.[0]);
  for (const c of ["Sushi Taxi", "Ocean Sushi", "Le Poisson Bleu", "Bistro du Port"]) {
    console.log(`  ${c}: ${visible.split(c).length - 1}`);
  }
}
