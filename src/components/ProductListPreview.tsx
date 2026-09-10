"use client";

// "View" on a Current Product Lists row: opens the list's items in place, so
// the buyer can read a list to a client on the phone without entering the
// builder and risking a stray tap on a price box or the remove button.
// Lines load only when opened, and reload when the list changes underneath
// (a teammate's tap arrives over the live channel and bumps `updatedAt`).

import { useEffect, useRef, useState } from "react";
import {
  getProductListLines,
  type ProductListLine,
} from "@/app/actions/product-lists";
import { formatMoney } from "@/lib/money";

export default function ProductListPreview({
  listId,
  listName,
  updatedAt,
}: {
  listId: number;
  listName: string;
  /** Epoch ms of the list's last change — the cache key for loaded lines. */
  updatedAt: number;
}) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<ProductListLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadedKey = useRef<string | null>(null);
  const key = `${listId}:${updatedAt}`;

  useEffect(() => {
    if (!open || loadedKey.current === key) return;
    let cancelled = false;

    (async () => {
      try {
        const rows = await getProductListLines(listId);
        if (cancelled) return;
        loadedKey.current = key;
        setLines(rows);
        setError(null);
      } catch {
        if (!cancelled) setError("Couldn't load this list. Try again.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, key, listId]);

  const total = (lines ?? []).reduce((sum, line) => sum + (line.price ?? 0), 0);
  const unpriced = (lines ?? []).filter((line) => line.price === null).length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        className="rounded-xl bg-accent-50 px-4 py-2.5 text-sm font-medium text-accent-800 transition hover:bg-accent-100"
      >
        {open ? "Hide list" : "View list"}
      </button>

      {open && (
        <div className="mt-3 w-full basis-full overflow-hidden rounded-xl border border-neutral-200">
          {error && (
            <p className="px-3 py-3 text-sm text-red-700">{error}</p>
          )}

          {!error && lines === null && (
            <p className="px-3 py-3 text-sm text-neutral-500">Loading…</p>
          )}

          {!error && lines?.length === 0 && (
            <p className="px-3 py-3 text-sm text-neutral-500">
              This list has no items yet.
            </p>
          )}

          {!error && lines && lines.length > 0 && (
            <>
              <ol>
                {lines.map((line, index) => (
                  <li
                    key={line.itemCode}
                    className="flex items-center gap-3 border-b border-neutral-100 px-3 py-2 last:border-b-0"
                  >
                    <span className="w-6 shrink-0 text-xs text-neutral-400">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-neutral-900">
                        {line.description}
                      </span>
                      <span className="block text-xs text-neutral-500">
                        {line.itemCode}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 text-sm tabular-nums ${
                        line.priceOverride !== null
                          ? "font-medium text-accent-800"
                          : line.price === null
                            ? "text-amber-700"
                            : "text-neutral-700"
                      }`}
                      title={
                        line.priceOverride !== null
                          ? "Price set by hand for this list"
                          : undefined
                      }
                    >
                      {formatMoney(line.price)}
                    </span>
                  </li>
                ))}
              </ol>

              <div className="flex items-baseline justify-between bg-neutral-50 px-3 py-2">
                <span className="text-sm font-semibold">
                  Total · {lines.length}{" "}
                  {lines.length === 1 ? "item" : "items"}
                </span>
                <span className="text-right">
                  <span className="block text-sm font-semibold">
                    {formatMoney(total)}
                  </span>
                  {unpriced > 0 && (
                    <span className="block text-xs text-amber-700">
                      {unpriced} with no price
                    </span>
                  )}
                </span>
              </div>
            </>
          )}

          <p className="sr-only">Contents of {listName}</p>
        </div>
      )}
    </>
  );
}
