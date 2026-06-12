// Confirms non-admins get only a redirect from admin management pages.
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
  const session = await res.json();
  return `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
}

const MARKERS = [
  "Manage Users",
  "Manage Clients",
  "Manage Products",
  "vincent@damenalimentaire.com", // user list data
  "Temporary password",
  "form_config",
  "Create user",
];

for (const [email, home] of [
  ["david@damenalimentaire.com", "/buyer"],
  ["commandes@damenalimentaire.com", "/rep"],
]) {
  const cookie = await cookieFor(email);
  for (const path of ["/admin/users", "/admin/clients", "/admin/products"]) {
    const res = await fetch(`http://localhost:3000${path}`, { headers: { Cookie: cookie } });
    const html = await res.text();
    const leaks = MARKERS.filter((m) => html.includes(m));
    const redirected = html.includes(home);
    console.log(
      `${email.split("@")[0]} ${path}: redirect=${redirected} leaks=${leaks.length ? leaks.join(",") : "NONE"}`,
    );
  }
}
