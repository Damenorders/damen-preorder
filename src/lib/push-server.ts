import "server-only";
import webpush from "web-push";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions, users, type Department } from "@/db/schema";
import { formatDate } from "@/lib/dates";

// Web Push sender. Configured lazily so `next build` (and any environment
// without VAPID keys) never crashes — sending simply no-ops until keys exist.

let configured: boolean | null = null;
function configure(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:orders@damen.local",
    pub,
    priv,
  );
  configured = true;
  return true;
}

interface PushRow {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

async function sendTo(sub: PushRow, payload: PushPayload) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({ icon: "/icon-192.png", ...payload }),
    );
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    // 404/410 mean the subscription is dead (app removed / permission revoked).
    // Prune it so we stop trying and the device can re-subscribe cleanly.
    if (status === 404 || status === 410) {
      await db
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.id, sub.id))
        .catch(() => {});
    }
  }
}

// Short label used in the alert title, e.g. "New Meat Order".
const alertLabel: Record<Department, string> = {
  meat: "Meat Order",
  fish: "Fish Order",
  other: "Pre-Order",
  warehouse: "Order",
};

const alertEmoji: Record<Department, string> = {
  meat: "🥩",
  fish: "🐟",
  other: "📦",
  warehouse: "📦",
};

interface NewOrderInfo {
  orderId: number;
  department: Department;
  clientName: string;
  deliveryDate: string;
}

/**
 * Fire a "New Meat Order" style push to every buyer/butcher device that opted
 * in to this department. Best-effort: never throws, so a push failure can't
 * break order creation.
 */
export async function notifyNewOrder(order: NewOrderInfo): Promise<void> {
  try {
    if (!configure()) return;

    const rows = await db
      .select({
        id: pushSubscriptions.id,
        endpoint: pushSubscriptions.endpoint,
        p256dh: pushSubscriptions.p256dh,
        auth: pushSubscriptions.auth,
        departments: pushSubscriptions.departments,
      })
      .from(pushSubscriptions)
      .innerJoin(users, eq(pushSubscriptions.userId, users.id))
      // Only alert accounts that still hold an alerting role.
      .where(inArray(users.role, ["buyer", "butcher"]));

    const recipients = rows.filter((r) =>
      (r.departments as Department[]).includes(order.department),
    );
    if (recipients.length === 0) return;

    const payload: PushPayload = {
      title: `${alertEmoji[order.department]} New ${alertLabel[order.department]}`,
      body: `${order.clientName} · Delivery ${formatDate(order.deliveryDate)}`,
      url: "/buyer/submissions",
      // One tag per order collapses any duplicate delivery into a single banner.
      tag: `order-${order.orderId}`,
    };

    await Promise.allSettled(recipients.map((r) => sendTo(r, payload)));
  } catch {
    // Notifications are best-effort; the order itself is already saved.
  }
}

/** Send a test banner to every device the given user has registered. */
export async function sendTestPush(userId: string): Promise<void> {
  if (!configure()) return;
  const subs = await db.query.pushSubscriptions.findMany({
    where: eq(pushSubscriptions.userId, userId),
  });
  const payload: PushPayload = {
    title: "🔔 Damen alerts are on",
    body: "Test notification — new orders will appear like this.",
    url: "/buyer/submissions",
    tag: "damen-test",
  };
  await Promise.allSettled(subs.map((s) => sendTo(s, payload)));
}
