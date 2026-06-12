import "server-only";

// SPEC.md §26 — one universal sheet. After any order change, broadcast a
// data-free ping on the "orders" channel; every open screen refetches its own
// role-filtered data via router.refresh(). No order data ever travels through
// the realtime channel, so there is nothing for a rep to intercept.

export async function notifyOrdersChanged() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ topic: "orders", event: "changed", payload: {} }],
      }),
    });
  } catch {
    // Realtime is best-effort; the change itself is already committed.
  }
}
