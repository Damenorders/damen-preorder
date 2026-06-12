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

// default view → filter panel starts open, so the dropdowns are in the HTML
const res = await fetch("http://localhost:3000/buyer/table", {
  headers: { Cookie: cookie },
});
const html = (await res.text()).replace(/<script[\s\S]*?<\/script>/g, "");
const count = (html.match(/value="Other"/g) ?? []).length;
console.log(`value="Other" appears ${count}x — ${count === 1 ? "PASS (exactly once)" : count === 0 ? "FAIL (missing)" : "FAIL (duplicates)"}`);
