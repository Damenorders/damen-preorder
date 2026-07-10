"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions, type Department } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { DEPARTMENTS, isDepartment } from "@/lib/labels";
import { sendTestPush } from "@/lib/push-server";

// The browser's PushSubscription.toJSON() shape.
export interface SerializedSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushState {
  subscribed: boolean;
  departments: Department[];
}

// Keep only real departments, in canonical order, deduped.
function cleanDepartments(input: unknown): Department[] {
  if (!Array.isArray(input)) return [...DEPARTMENTS];
  const picked = new Set(
    input.filter((d): d is string => typeof d === "string" && isDepartment(d)),
  );
  return DEPARTMENTS.filter((d) => picked.has(d));
}

/** Register (or refresh) this device's push subscription for the current user. */
export async function subscribeUser(
  sub: SerializedSubscription,
): Promise<{ ok: boolean; error?: string; departments?: Department[] }> {
  const user = await requireRole("buyer", "butcher", "dispatch");
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return { ok: false, error: "Invalid subscription." };
  }

  await db
    .insert(pushSubscriptions)
    .values({
      userId: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      // This browser now belongs to whoever is logged in; refresh its keys but
      // keep any existing department preferences.
      set: {
        userId: user.id,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        updatedAt: new Date(),
      },
    });

  const row = await db.query.pushSubscriptions.findFirst({
    where: eq(pushSubscriptions.endpoint, sub.endpoint),
  });
  return {
    ok: true,
    departments: (row?.departments as Department[]) ?? [...DEPARTMENTS],
  };
}

/** Remove this device's subscription. */
export async function unsubscribeUser(
  endpoint: string,
): Promise<{ ok: boolean }> {
  const user = await requireRole("buyer", "butcher", "dispatch");
  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.endpoint, endpoint),
        eq(pushSubscriptions.userId, user.id),
      ),
    );
  return { ok: true };
}

/** Update which departments this device is pinged for. */
export async function updatePushDepartments(
  endpoint: string,
  departments: Department[],
): Promise<{ ok: boolean; departments: Department[] }> {
  const user = await requireRole("buyer", "butcher", "dispatch");
  const clean = cleanDepartments(departments);
  await db
    .update(pushSubscriptions)
    .set({ departments: clean, updatedAt: new Date() })
    .where(
      and(
        eq(pushSubscriptions.endpoint, endpoint),
        eq(pushSubscriptions.userId, user.id),
      ),
    );
  return { ok: true, departments: clean };
}

/** Read this device's current subscription state (for hydrating the UI). */
export async function getPushState(endpoint: string): Promise<PushState> {
  const user = await requireRole("buyer", "butcher", "dispatch");
  const row = await db.query.pushSubscriptions.findFirst({
    where: and(
      eq(pushSubscriptions.endpoint, endpoint),
      eq(pushSubscriptions.userId, user.id),
    ),
  });
  return {
    subscribed: !!row,
    departments: (row?.departments as Department[]) ?? [...DEPARTMENTS],
  };
}

/** Send a test banner to every device this user has registered. */
export async function sendTestNotification(): Promise<{ ok: boolean }> {
  const user = await requireRole("buyer", "butcher", "dispatch");
  await sendTestPush(user.id);
  return { ok: true };
}
