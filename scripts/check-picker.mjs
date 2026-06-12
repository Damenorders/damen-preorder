// Picker role: blocked everywhere except /picker; picker view is read-only.
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];

const tr = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: "soccervinny3@hotmail.com", password: env.SEED_USER_PASSWORD ?? "Damen2026!" }),
});
const session = await tr.json();
const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;

const get = async (p) => (await fetch(`http://localhost:3000${p}`, { headers: { Cookie: cookie } })).text();

for (const [path, markers] of [
  ["/buyer/table", ["Buyer Table", "Ordered", "Received"]],
  ["/buyer/submissions", ["Filters"]],
  ["/orders/fish/new", ["Fill Form", "Add a product"]],
  ["/admin/users", ["Manage Users", "Create user"]],
]) {
  const html = await get(path);
  const leaks = markers.filter((m) => html.includes(m));
  console.log(`${path}: redirect=${html.includes("/picker")} leaks=${leaks.length ? leaks.join(",") : "NONE"}`);
}

const picker = await get("/picker");
console.log("picker page read-only:",
  !picker.includes("Submission status") && !picker.includes(">Edit<") ? "PASS" : "FAIL");
console.log("picker page rows present:", picker.includes("Sushi Taxi") ? "PASS" : "FAIL");
