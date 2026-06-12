// Verifies Phase 4: export auth (rep 403), CSV headers carry external IDs,
// and buying-sheet grouping math adds up.
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];

async function cookieFor(email) {
  const res = await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: env.SEED_USER_PASSWORD ?? "Damen2026!" }),
    },
  );
  const session = await res.json();
  return `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
}

const repCookie = await cookieFor("commandes@damenalimentaire.com");
const buyerCookie = await cookieFor("david@damenalimentaire.com");

// 1. Rep must get 403 on both export endpoints
for (const path of ["/api/exports/orders", "/api/exports/buying-sheet"]) {
  const res = await fetch(`http://localhost:3000${path}`, {
    headers: { Cookie: repCookie },
  });
  console.log(`rep ${path} → ${res.status} ${res.status === 403 ? "PASS" : "FAIL"}`);
}

// 2. Buyer orders export: headers + external ids
const ordersRes = await fetch(
  "http://localhost:3000/api/exports/orders?delivery=all",
  { headers: { Cookie: buyerCookie } },
);
const ordersCsv = await ordersRes.text();
const [head, ...dataLines] = ordersCsv.replace(/^﻿/, "").trim().split("\r\n");
console.log(`\norders.csv → ${ordersRes.status}, ${dataLines.length} data rows`);
console.log("headers:", head);
const headerChecks = ["id", "order_id/id", "partner_id/id", "specs_json", "buyer_table_status"];
for (const h of headerChecks) {
  console.log(`  header "${h}": ${head.split(",").includes(h) || head.includes('"' + h + '"') ? "PASS" : "FAIL"}`);
}
console.log(
  `  external ids in data: ${dataLines.every((l) => l.includes("damen_order_line_") && l.includes("damen_order_")) ? "PASS" : "FAIL"}`,
);

// 3. Buying sheet grouping: today + all statuses → Salmon 8/10 from two
// clients (Ocean Sushi pending + Le Poisson Bleu received) must merge:
// qty 3+3=6, weight 12+12=24, client_count 2.
const sheetRes = await fetch(
  "http://localhost:3000/api/exports/buying-sheet?delivery=today&status=all",
  { headers: { Cookie: buyerCookie } },
);
const sheetCsv = await sheetRes.text();
console.log(`\nbuying_sheet.csv → ${sheetRes.status}`);
console.log(sheetCsv.replace(/^﻿/, "").trim());
const salmonRow = sheetCsv
  .split("\r\n")
  .find((l) => l.includes("8/10"));
if (salmonRow) {
  const ok = salmonRow.includes(",6,") && salmonRow.includes("24.00") && salmonRow.includes(",2,");
  console.log(`grouping math (qty 6, 24.00 kg, 2 clients): ${ok ? "PASS" : "FAIL"}`);
} else {
  console.log("grouping math: FAIL — no 8/10 row found");
}
