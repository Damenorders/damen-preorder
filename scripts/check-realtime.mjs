// Round-trip test of the §26 realtime sync: subscribe to the "orders"
// broadcast channel as a client, then send the same server-side broadcast
// the actions use, and confirm the ping arrives.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const timeout = setTimeout(() => {
  console.log("FAIL — no broadcast received within 10s");
  process.exit(1);
}, 10000);

const channel = supabase
  .channel("orders")
  .on("broadcast", { event: "changed" }, () => {
    console.log("PASS — broadcast received by subscriber");
    clearTimeout(timeout);
    supabase.removeChannel(channel).then(() => process.exit(0));
  })
  .subscribe(async (status) => {
    console.log("subscription status:", status);
    if (status !== "SUBSCRIBED") return;
    const res = await fetch(
      `${env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`,
      {
        method: "POST",
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [{ topic: "orders", event: "changed", payload: {} }],
        }),
      },
    );
    console.log("server broadcast POST:", res.status);
  });
