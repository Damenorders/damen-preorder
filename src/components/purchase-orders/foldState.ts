"use client";

// Which sections are unfolded, per view, for this browser tab only. Each view
// has its own key, so folding a supplier on Next order never folds it on
// Suppliers. Storage can throw on a restricted origin; a fold state is never
// worth a blank page, so every access is guarded and an in-memory copy carries
// on without it.

import { useMemo, useSyncExternalStore } from "react";

type Opened = Record<string, boolean>;

const memory = new Map<string, string>();
const listeners = new Map<string, Set<() => void>>();

function read(key: string): string {
  try {
    return sessionStorage.getItem(key) ?? memory.get(key) ?? "{}";
  } catch {
    return memory.get(key) ?? "{}";
  }
}

function write(key: string, value: Opened) {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  try {
    sessionStorage.setItem(key, raw);
  } catch {
    // Folding still works for this page view.
  }
  listeners.get(key)?.forEach((fn) => fn());
}

function parse(raw: string): Opened {
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

/** Server render and hydration both see everything folded. */
export function useFoldState(key: string) {
  const raw = useSyncExternalStore(
    (fn) => {
      const set = listeners.get(key) ?? new Set();
      set.add(fn);
      listeners.set(key, set);
      return () => {
        set.delete(fn);
      };
    },
    () => read(key),
    () => "{}",
  );
  const opened = useMemo(() => parse(raw), [raw]);

  return {
    opened,
    toggle(section: string) {
      const next = { ...opened };
      if (next[section]) delete next[section];
      else next[section] = true;
      write(key, next);
    },
    open(section: string) {
      if (!opened[section]) write(key, { ...opened, [section]: true });
    },
  };
}
