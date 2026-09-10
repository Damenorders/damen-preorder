"use client";

// Product List builder — used one-handed on a phone while walking the
// warehouse. Search the item catalog, tap an item, it lands on the list. Every
// tap saves immediately (the list is shared from the moment it is created), so
// a dead battery mid-walk costs nothing and two people can fill one list at
// once. Inputs stay at 16px so iOS doesn't zoom, and rows keep 44px tap targets.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addProductListItem,
  removeProductListItem,
  renameProductList,
  saveProductList,
  searchCatalog,
  setProductListItemPrice,
  type CatalogHit,
} from "@/app/actions/product-lists";
import { formatMoney } from "@/lib/money";

export interface BuilderItem {
  itemCode: string;
  description: string;
  addedByName: string;
  catalogPrice: number | null;
  priceOverride: number | null;
  price: number | null;
}

export default function ProductListBuilder({
  listId,
  initialName,
  status,
  items,
}: {
  listId: number;
  initialName: string;
  status: "draft" | "saved";
  items: BuilderItem[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Optimistic overlays on the server list: items tapped but not yet confirmed,
  // and items removed but still present in the last server render.
  const [pending, setPending] = useState<Map<string, CatalogHit>>(new Map());
  const [removing, setRemoving] = useState<Set<string>>(new Set());

  const searchRef = useRef<HTMLInputElement>(null);

  // A fresh `items` array means the server (our own action, or a teammate's tap
  // arriving over the live channel) has caught up — drop the overlays it now
  // covers. Adjusting state during render is the supported way to react to new
  // props; doing it in an effect would render the stale list first.
  const [lastItems, setLastItems] = useState(items);
  if (items !== lastItems) {
    setLastItems(items);
    const onServer = new Set(items.map((i) => i.itemCode));
    if ([...pending.keys()].some((code) => onServer.has(code))) {
      setPending((prev) => {
        const next = new Map(prev);
        for (const code of prev.keys()) if (onServer.has(code)) next.delete(code);
        return next;
      });
    }
    // A removal the server has applied is done with; one whose item is back on
    // the list was re-added by someone else and must stop being hidden.
    if (removing.size > 0) {
      setRemoving((prev) => {
        const next = new Set(prev);
        for (const code of prev) if (!onServer.has(code)) next.delete(code);
        return next;
      });
    }
  }

  const shown: BuilderItem[] = useMemo(
    () => [
      ...items.filter((i) => !removing.has(i.itemCode)),
      ...[...pending.entries()]
        .filter(([code]) => !items.some((i) => i.itemCode === code))
        .map(([itemCode, hit]) => ({
          itemCode,
          description: hit.description,
          addedByName: "",
          catalogPrice: hit.price,
          priceOverride: null,
          price: hit.price,
        })),
    ],
    [items, pending, removing],
  );
  const onList = useMemo(
    () => new Set(shown.map((i) => i.itemCode)),
    [shown],
  );
  const total = shown.reduce((sum, i) => sum + (i.price ?? 0), 0);
  const unpriced = shown.filter((i) => i.price === null).length;

  // Debounced catalog search. Results carry the query they answer, so a slow
  // response can never overwrite a newer one and "Searching…" is just the gap
  // between what's typed and what's been answered.
  const trimmedQuery = query.trim();
  const [found, setFound] = useState<{ query: string; hits: CatalogHit[] }>({
    query: "",
    hits: [],
  });
  const results = found.query === trimmedQuery ? found.hits : [];
  const searching = trimmedQuery.length >= 2 && found.query !== trimmedQuery;

  const runId = useRef(0);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const id = ++runId.current;
    const timer = setTimeout(async () => {
      try {
        const hits = await searchCatalog(q);
        if (runId.current === id) setFound({ query: q, hits });
      } catch {
        if (runId.current === id) setError("Search failed. Try again.");
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const add = useCallback(
    async (hit: CatalogHit) => {
      if (onList.has(hit.code)) return;
      setError(null);
      setPending((prev) => new Map(prev).set(hit.code, hit));
      const result = await addProductListItem(listId, hit.code);
      if (!result.ok) {
        setPending((prev) => {
          const next = new Map(prev);
          next.delete(hit.code);
          return next;
        });
        setError(result.error);
      }
    },
    [listId, onList],
  );

  async function remove(itemCode: string) {
    setError(null);
    setRemoving((prev) => new Set(prev).add(itemCode));
    setPending((prev) => {
      const next = new Map(prev);
      next.delete(itemCode);
      return next;
    });
    const result = await removeProductListItem(listId, itemCode);
    if (!result.ok) {
      setRemoving((prev) => {
        const next = new Set(prev);
        next.delete(itemCode);
        return next;
      });
      setError(result.error);
    }
  }

  async function commitName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === initialName) return;
    const result = await renameProductList(listId, trimmed);
    if (!result.ok) setError(result.error);
  }

  async function save() {
    setError(null);
    setSaving(true);
    const result = await saveProductList(listId, name);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/buyer/product-lists");
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label
          htmlFor="list-name"
          className="block text-sm font-medium text-neutral-700"
        >
          List name
        </label>
        <input
          id="list-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-3 text-base"
          placeholder="e.g. Marché Adonis — fall list"
        />
      </div>

      <div>
        <label
          htmlFor="catalog-search"
          className="block text-sm font-medium text-neutral-700"
        >
          Add items from the catalog
        </label>
        <div className="relative mt-1">
          <input
            id="catalog-search"
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="search"
            enterKeyHint="search"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="w-full rounded-xl border border-neutral-300 px-3 py-3 text-base"
            placeholder="Search by description or SKU…"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                searchRef.current?.focus();
              }}
              className="absolute right-1 top-1/2 h-11 w-11 -translate-y-1/2 text-lg text-neutral-400"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        {trimmedQuery.length >= 2 && (
          <div className="mt-2 overflow-hidden rounded-xl border border-neutral-200">
            {searching && (
              <p className="px-3 py-3 text-sm text-neutral-500">Searching…</p>
            )}
            {!searching && results.length === 0 && (
              <p className="px-3 py-3 text-sm text-neutral-500">
                Nothing in the catalog matches “{trimmedQuery}”.
              </p>
            )}
            {!searching &&
              results.map((hit) => {
                const added = onList.has(hit.code);
                return (
                  <button
                    key={hit.code}
                    type="button"
                    disabled={added}
                    onClick={() => add(hit)}
                    className={`flex w-full items-center gap-3 border-b border-neutral-100 px-3 py-3 text-left last:border-b-0 ${
                      added ? "bg-neutral-50" : "active:bg-accent-50"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-neutral-900">
                        {hit.description}
                      </span>
                      <span className="block text-xs text-neutral-500">
                        {hit.code}
                        {hit.price !== null && ` · ${formatMoney(hit.price)}`}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold ${
                        added ? "text-neutral-400" : "bg-accent-600 text-white"
                      }`}
                    >
                      {added ? "On list" : "Add"}
                    </span>
                  </button>
                );
              })}
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div>
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">
            On this list ({shown.length})
          </h2>
          <span className="text-xs text-neutral-500">
            Saved as you tap · updates live
          </span>
        </div>

        {shown.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-neutral-300 px-3 py-6 text-center text-sm text-neutral-500">
            Nothing yet. Search above and tap an item to add it.
          </p>
        ) : (
          <ol className="mt-2 overflow-hidden rounded-xl border border-neutral-200">
            {shown.map((item, index) => (
              <li
                key={item.itemCode}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-neutral-100 px-3 py-2 last:border-b-0"
              >
                <span className="w-6 shrink-0 text-xs text-neutral-400">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 basis-[55%]">
                  <span className="block text-sm font-medium text-neutral-900">
                    {item.description}
                  </span>
                  <span className="block text-xs text-neutral-500">
                    {item.itemCode}
                    {item.addedByName ? ` · ${item.addedByName}` : ""}
                  </span>
                </span>
                <PriceBox
                  listId={listId}
                  item={item}
                  onError={setError}
                />
                <button
                  type="button"
                  onClick={() => remove(item.itemCode)}
                  className="h-11 w-11 shrink-0 rounded-lg text-lg text-neutral-400 active:bg-neutral-100"
                  aria-label={`Remove ${item.description}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
        )}

        {shown.length > 0 && (
          <div className="mt-2 flex items-baseline justify-between rounded-xl bg-neutral-50 px-3 py-2">
            <span className="text-sm font-semibold">Total</span>
            <span className="text-right">
              <span className="block text-sm font-semibold">
                {formatMoney(total)}
              </span>
              {unpriced > 0 && (
                <span className="block text-xs text-amber-700">
                  {unpriced} {unpriced === 1 ? "item has" : "items have"} no
                  price yet
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 -mx-4 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={save}
          disabled={saving || shown.length === 0}
          className="w-full rounded-xl bg-accent-600 px-4 py-3 text-base font-semibold text-white disabled:bg-neutral-300"
        >
          {saving
            ? "Saving…"
            : status === "saved"
              ? "Done — back to Product Lists"
              : "Save to Current Product Lists"}
        </button>
        <p className="mt-2 text-center text-xs text-neutral-500">
          {status === "saved"
            ? "This list is already saved. Changes above are live."
            : "Items are stored the moment you tap them — Save files the list."}
        </p>
      </div>
    </div>
  );
}

/**
 * The price on one line. Empty means "use the uploaded catalog price", which is
 * shown as the placeholder; typing a number overrides it for this list only, so
 * a client-specific price survives the next price-file upload.
 */
function PriceBox({
  listId,
  item,
  onError,
}: {
  listId: number;
  item: BuilderItem;
  onError: (message: string | null) => void;
}) {
  const [text, setText] = useState(
    item.priceOverride === null ? "" : String(item.priceOverride),
  );
  const [saving, setSaving] = useState(false);

  // Follow the server when someone else edits this line.
  const [lastOverride, setLastOverride] = useState(item.priceOverride);
  if (item.priceOverride !== lastOverride) {
    setLastOverride(item.priceOverride);
    setText(item.priceOverride === null ? "" : String(item.priceOverride));
  }

  async function commit() {
    const raw = text.trim().replace(/^\$/, "");
    const next = raw === "" ? null : Number(raw);

    if (next !== null && (!Number.isFinite(next) || next < 0)) {
      onError("Enter a price like 12.50, or clear the box to use the catalog price.");
      setText(item.priceOverride === null ? "" : String(item.priceOverride));
      return;
    }
    if (next === item.priceOverride) return;

    onError(null);
    setSaving(true);
    const result = await setProductListItemPrice(listId, item.itemCode, next);
    setSaving(false);
    if (!result.ok) onError(result.error);
  }

  return (
    <span className="relative shrink-0">
      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-neutral-400">
        $
      </span>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        inputMode="decimal"
        disabled={saving}
        aria-label={`Price for ${item.description}`}
        placeholder={
          item.catalogPrice === null ? "—" : item.catalogPrice.toFixed(2)
        }
        className={`h-11 w-24 rounded-lg border px-2 pl-5 text-right text-base ${
          item.priceOverride !== null
            ? "border-accent-600 font-medium text-accent-800"
            : "border-neutral-300"
        }`}
      />
    </span>
  );
}
