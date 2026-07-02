"use client";

// Order-alert settings for a buyer/butcher device. Registers a Web Push
// subscription (the browser's own lockscreen banner — no app store), lets the
// person pick which departments ping them, and self-heals stale state.

import { useCallback, useEffect, useState } from "react";
import { DEPARTMENTS, departmentLabels } from "@/lib/labels";
import type { Department } from "@/db/schema";
import {
  subscribeUser,
  unsubscribeUser,
  updatePushDepartments,
  getPushState,
  sendTestNotification,
  type SerializedSubscription,
} from "@/app/actions/push";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

function serialize(sub: PushSubscription): SerializedSubscription {
  const json = sub.toJSON();
  return {
    endpoint: json.endpoint!,
    keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
  };
}

export default function PushNotificationsSettings() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([
    ...DEPARTMENTS,
  ]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  // Hydrate: detect support/platform and load any existing subscription state.
  useEffect(() => {
    setIsIOS(
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
        !("MSStream" in window),
    );
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        // iOS Safari standalone flag
        (navigator as unknown as { standalone?: boolean }).standalone === true,
    );

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSupported(false);
      return;
    }
    setSupported(true);

    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const state = await getPushState(sub.endpoint);
          setSubscribed(state.subscribed);
          if (state.subscribed) setDepartments(state.departments);
        }
      } catch {
        // Registration can fail on unsupported/insecure contexts; leave as-is.
      }
    })();
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage(
          "Notifications are blocked. Enable them for this site in your browser settings.",
        );
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        setMessage("Push keys are not configured on the server yet.");
        return;
      }
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        }));
      const res = await subscribeUser(serialize(sub));
      if (!res.ok) {
        setMessage(res.error ?? "Could not enable alerts.");
        return;
      }
      setSubscribed(true);
      if (res.departments) setDepartments(res.departments);
      setMessage("Alerts enabled on this device.");
    } catch {
      setMessage("Could not enable alerts on this device.");
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribeUser(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setMessage(null);
    } catch {
      setMessage("Could not turn off alerts.");
    } finally {
      setBusy(false);
    }
  }, []);

  const toggleDepartment = useCallback(
    async (dep: Department) => {
      const next = departments.includes(dep)
        ? departments.filter((d) => d !== dep)
        : [...departments, dep];
      setDepartments(next); // optimistic
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) await updatePushDepartments(sub.endpoint, next);
      } catch {
        setMessage("Could not save your department choice.");
      }
    },
    [departments],
  );

  const test = useCallback(async () => {
    setBusy(true);
    try {
      await sendTestNotification();
      setMessage("Test sent — check your notifications.");
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold">Order Alerts</h2>
      <p className="mt-0.5 text-sm text-neutral-500">
        Get a phone banner when a new order is placed.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {supported === false && (
          <p className="rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
            This browser can’t show push notifications.
          </p>
        )}

        {/* iOS must be installed to the Home Screen before push works. */}
        {isIOS && !isStandalone && (
          <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">One step first (iPhone/iPad)</p>
            <p className="mt-1">
              Tap the Share button <span aria-hidden>⎋</span> in Safari, then{" "}
              <span className="font-medium">“Add to Home Screen”</span>. Open
              Damen from that new icon and turn on alerts there.
            </p>
          </div>
        )}

        {supported && (
          <>
            {!subscribed ? (
              <button
                type="button"
                onClick={enable}
                disabled={busy || (isIOS && !isStandalone)}
                className="rounded-xl bg-accent-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-700 disabled:opacity-50"
              >
                🔔 Enable order alerts
              </button>
            ) : (
              <>
                <div className="rounded-xl bg-accent-50 px-4 py-3">
                  <p className="text-sm font-medium text-accent-800">
                    Alerts are on for this device. Ping me for:
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    {DEPARTMENTS.map((dep) => (
                      <label
                        key={dep}
                        className="flex cursor-pointer items-center gap-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={departments.includes(dep)}
                          onChange={() => toggleDepartment(dep)}
                          className="h-4 w-4 rounded border-neutral-300 accent-accent-600"
                        />
                        <span>{departmentLabels[dep]}</span>
                      </label>
                    ))}
                  </div>
                  {departments.length === 0 && (
                    <p className="mt-2 text-xs text-amber-700">
                      No departments selected — you won’t receive any alerts.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={test}
                    disabled={busy}
                    className="rounded-xl bg-accent-50 px-4 py-2.5 text-sm font-medium text-accent-800 transition hover:bg-accent-100 disabled:opacity-50"
                  >
                    Send test
                  </button>
                  <button
                    type="button"
                    onClick={disable}
                    disabled={busy}
                    className="rounded-xl bg-neutral-50 px-4 py-2.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-50"
                  >
                    Turn off on this device
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {message && <p className="text-sm text-neutral-600">{message}</p>}
      </div>
    </section>
  );
}
