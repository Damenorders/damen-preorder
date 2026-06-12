// Phase smoke test — signs in as a user via the Supabase token endpoint,
// builds the auth cookie the way @supabase/ssr stores it, and walks the app
// over HTTP like a real browser session would.
//
// Usage: node scripts/smoke-test.mjs [email] [path...]

import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP = "http://localhost:3000";
const ref = new URL(SUPABASE_URL).hostname.split(".")[0];

const email = process.argv[2] ?? "commandes@damenalimentaire.com";
const paths = process.argv.slice(3);
const password = env.SEED_USER_PASSWORD ?? "Damen2026!";

// 1. Sign in
const tokenRes = await fetch(
  `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
  {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  },
);
if (!tokenRes.ok) {
  console.error(`LOGIN FAILED for ${email}: ${tokenRes.status} ${await tokenRes.text()}`);
  process.exit(1);
}
const session = await tokenRes.json();
console.log(`login ok: ${email}`);

// 2. Build the @supabase/ssr cookie (base64url JSON, chunked at ~3180 chars)
const cookieValue =
  "base64-" +
  Buffer.from(JSON.stringify(session)).toString("base64url");
const CHUNK = 3180;
const cookies = [];
if (cookieValue.length <= CHUNK) {
  cookies.push(`sb-${ref}-auth-token=${cookieValue}`);
} else {
  for (let i = 0; i * CHUNK < cookieValue.length; i++) {
    cookies.push(
      `sb-${ref}-auth-token.${i}=${cookieValue.slice(i * CHUNK, (i + 1) * CHUNK)}`,
    );
  }
}
const cookieHeader = cookies.join("; ");

// 3. Walk pages
let failures = 0;
for (const path of paths) {
  const res = await fetch(`${APP}${path}`, {
    headers: { Cookie: cookieHeader },
    redirect: "manual",
  });
  const location = res.headers.get("location") ?? "";
  let marker = "";
  if (res.status === 200) {
    const html = await res.text();
    const m = html.match(/<h1[^>]*>([^<]*)</);
    marker = m ? ` h1="${m[1].trim()}"` : "";
  }
  console.log(
    `${path} → ${res.status}${location ? ` → ${location}` : ""}${marker}`,
  );
  if (res.status >= 500) failures++;
}
process.exit(failures ? 1 : 0);
