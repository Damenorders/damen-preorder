"use client";

// SPEC.md §26 — subscribes to the data-free "orders changed" broadcast and
// refetches the current page's server data. Drop into any page that shows
// order data and it stays live without manual refresh. Pass `channel` to listen
// on a different topic (Product Lists have their own).

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LiveRefresh({
  channel = "orders",
}: {
  /** Broadcast topic to listen on. Product Lists use their own. */
  channel?: string;
} = {}) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const subscription = supabase
      .channel(channel)
      .on("broadcast", { event: "changed" }, () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => router.refresh(), 250);
      })
      .subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(subscription);
    };
  }, [router, channel]);

  return null;
}
