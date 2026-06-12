// Verifies the buyer table default view (§18) and sort order (§19)
// by checking the order of markers in the server-rendered HTML.
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];

const tokenRes = await fetch(
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
const session = await tokenRes.json();
const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;

async function page(path) {
  const res = await fetch(`http://localhost:3000${path}`, { headers: { Cookie: cookie } });
  const html = await res.text();
  // visible markup only: drop scripts (flight payload) and React comment nodes
  return html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "");
}

const count = (html, s) => html.split(s).length - 1;

// 1. Default view: only Pending + today/tomorrow.
// Every client appears once in the filter dropdown; a visible card adds more.
const def = await page("/buyer/table");
const defChecks = {
  "Ocean Sushi card visible (pending, today)": count(def, "Ocean Sushi") > 1,
  "Sushi Taxi card visible (pending, tomorrow)": count(def, "Sushi Taxi") > 1,
  "Le Poisson Bleu hidden (received)": count(def, "Le Poisson Bleu") === 1,
  "no Ordered group header": !def.includes("Ordered · "),
};
console.log("DEFAULT VIEW:");
for (const [k, v] of Object.entries(defChecks)) console.log(`  ${v ? "PASS" : "FAIL"} — ${k}`);

// 2. All statuses + all dates: §19 ordering of group headers
const all = await page("/buyer/table?status=all&delivery=all");
console.log("ALL VIEW group positions (must be ascending, all found):");
let prev = -1;
let pass = true;
for (const marker of ["Pending · ", "Ordered · ", "Received · "]) {
  const pos = all.indexOf(marker);
  console.log(`  "${marker}" at ${pos}`);
  if (pos === -1 || pos < prev) pass = false;
  prev = pos;
}
console.log(pass ? "  PASS — Pending before Ordered before Received" : "  FAIL");

const todaySection = all.indexOf("(today)");
const tomorrowSection = all.indexOf("(tomorrow)");
console.log(
  todaySection !== -1 && tomorrowSection !== -1 && todaySection < tomorrowSection
    ? "  PASS — today group before tomorrow group"
    : `  FAIL — today@${todaySection} tomorrow@${tomorrowSection}`,
);
