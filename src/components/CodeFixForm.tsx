"use client";

// Codes to Fix form — a client, a note, and one or more product lines. Each
// line pairs the client's special SKU and price with the general SKU. Typing
// a SKU fills its description from the template; typing a description fills
// its SKU when exactly one SKU has it (otherwise the rep picks from the list).

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveCodeFix } from "@/app/actions/code-fixes";
import {
  buildLookup,
  findByDescription,
  findBySku,
  searchCatalog,
  type CatalogItem,
  type CatalogLookup,
  type CodeFixLineInput,
} from "@/lib/code-fix";

type Line = CodeFixLineInput & { key: number };

const blankLine = (key: number): Line => ({
  key,
  clientSku: "",
  clientDescription: "",
  price: "",
  generalSku: "",
  generalDescription: "",
});

const inputClass =
  "mt-1.5 block w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base outline-none focus:border-accent-600 focus:ring-2 focus:ring-accent-100";

export default function CodeFixForm({
  catalog,
  clients,
  initial,
  doneHref,
}: {
  catalog: CatalogItem[];
  clients: string[];
  initial?: { id: number; clientName: string; note: string; lines: CodeFixLineInput[] };
  doneHref: string;
}) {
  const router = useRouter();
  const lookup = useMemo(() => buildLookup(catalog), [catalog]);
  const [clientName, setClientName] = useState(initial?.clientName ?? "");
  const [clientFocused, setClientFocused] = useState(false);
  const [note, setNote] = useState(initial?.note ?? "");
  const [lines, setLines] = useState<Line[]>(
    initial?.lines.length ? initial.lines.map((l, i) => ({ ...l, key: i })) : [blankLine(0)],
  );
  const [nextKey, setNextKey] = useState(lines.length);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const suggestions = useMemo(() => {
    const typed = clientName.trim().toLowerCase();
    if (!typed) return [];
    return clients
      .filter((n) => n.toLowerCase().includes(typed) && n.toLowerCase() !== typed)
      .slice(0, 6);
  }, [clientName, clients]);

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((ls) => [...ls, blankLine(nextKey)]);
    setNextKey((k) => k + 1);
  }

  async function handleSubmit() {
    setError(null);
    if (!clientName.trim()) return setError("Enter the client name.");
    setSubmitting(true);
    const result = await saveCodeFix({
      id: initial?.id,
      clientName: clientName.trim(),
      note,
      lines: lines.map((l) => ({
        id: l.id,
        clientSku: l.clientSku,
        // A template SKU always sends the template's description.
        clientDescription: findBySku(lookup, l.clientSku)?.description ?? l.clientDescription,
        price: l.price,
        generalSku: l.generalSku,
        generalDescription: findBySku(lookup, l.generalSku)?.description ?? l.generalDescription,
      })),
    });
    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    router.push(doneHref);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="relative">
          <label className="block text-sm font-medium text-neutral-700">
            Client Name
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              onFocus={() => setClientFocused(true)}
              onBlur={() => setClientFocused(false)}
              placeholder="Start typing — pick a match or enter a new client"
              autoComplete="off"
              className={inputClass}
            />
          </label>
          {clientFocused && suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
              {suggestions.map((n) => (
                <li key={n}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setClientName(n);
                      setClientFocused(false);
                    }}
                    className="w-full px-4 py-3 text-left text-base hover:bg-accent-50"
                  >
                    {n}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {lines.map((line, i) => (
        <section
          key={line.key}
          className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Product {i + 1}</h2>
            {lines.length > 1 && (
              <button
                type="button"
                onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))}
                className="rounded-lg px-2 py-1 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                Remove
              </button>
            )}
          </div>

          <SkuPicker
            lookup={lookup}
            label="Client SKU"
            optional
            sku={line.clientSku}
            description={line.clientDescription}
            onChange={(sku, description) =>
              updateLine(line.key, { clientSku: sku, clientDescription: description })
            }
          />

          <label className="mt-4 block text-sm font-medium text-neutral-700">
            Client Price ($)
            <input
              type="text"
              inputMode="decimal"
              value={line.price}
              onChange={(e) => updateLine(line.key, { price: e.target.value })}
              placeholder="e.g. 30"
              className={`${inputClass} sm:max-w-48`}
            />
          </label>

          <SkuPicker
            lookup={lookup}
            label="General SKU (equivalent code)"
            sku={line.generalSku}
            description={line.generalDescription}
            onChange={(sku, description) =>
              updateLine(line.key, { generalSku: sku, generalDescription: description })
            }
          />
        </section>
      ))}

      <button
        type="button"
        onClick={addLine}
        className="rounded-xl border-2 border-dashed border-neutral-300 px-4 py-3 text-base font-medium text-neutral-700 hover:border-accent-600 hover:text-accent-700"
      >
        + Add another product
      </button>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium text-neutral-700">
          Note <span className="font-normal text-neutral-400">(optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className={inputClass}
            placeholder="Anything the buyer should know"
          />
        </label>
      </section>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="rounded-xl bg-accent-600 px-4 py-4 text-base font-semibold text-white transition hover:bg-accent-700 disabled:opacity-60"
      >
        {submitting ? "Saving…" : initial ? "Save changes" : "Submit"}
      </button>
    </div>
  );
}

/**
 * A SKU + description pair. A SKU found in the template shows the template's
 * description (read-only); one not in it lets the rep type the description.
 */
function SkuPicker({
  lookup,
  label,
  optional = false,
  sku,
  description,
  onChange,
}: {
  lookup: CatalogLookup;
  label: string;
  optional?: boolean;
  sku: string;
  description: string;
  onChange: (sku: string, description: string) => void;
}) {
  const [focused, setFocused] = useState<"sku" | "description" | null>(null);
  const hit = sku.trim() ? findBySku(lookup, sku) : null;
  const shownDescription = hit ? hit.description : description;
  const query = focused === "sku" ? sku : focused === "description" ? description : "";
  const matches = useMemo(
    () => (focused && !(focused === "sku" && hit) ? searchCatalog(lookup, query) : []),
    [lookup, query, focused, hit],
  );

  function typeDescription(text: string) {
    // Exactly one SKU with this description fills the SKU; two or more wait
    // for the rep to pick one from the list.
    const same = findByDescription(lookup, text);
    if (!sku.trim() && same.length === 1) onChange(same[0].sku, same[0].description);
    else onChange(sku, text);
  }

  const list = matches.length > 0 && (
    <ul className="absolute left-0 right-0 z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-lg">
      {matches.map((m) => (
        <li key={m.sku}>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onChange(m.sku, m.description);
              setFocused(null);
            }}
            className="flex w-full gap-3 px-4 py-2.5 text-left text-sm hover:bg-accent-50"
          >
            <span className="w-28 shrink-0 font-mono font-semibold">{m.sku}</span>
            <span>{m.description}</span>
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[12rem_1fr]">
      <div className="relative">
        <label className="block text-sm font-medium text-neutral-700">
          {label} {optional && <span className="font-normal text-neutral-400">(optional)</span>}
          <input
            type="text"
            value={sku}
            onChange={(e) => onChange(e.target.value.toUpperCase(), hit ? "" : description)}
            onFocus={() => setFocused("sku")}
            onBlur={() => setFocused(null)}
            placeholder="SKU"
            autoComplete="off"
            autoCapitalize="characters"
            className={`${inputClass} font-mono`}
          />
        </label>
        {focused === "sku" && list}
      </div>
      <div className="relative">
        <label className="block text-sm font-medium text-neutral-700">
          Description
          {sku.trim() && !hit && (
            <span className="ml-2 rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900">
              Not in template — type the description
            </span>
          )}
          <input
            type="text"
            value={shownDescription}
            readOnly={!!hit}
            onChange={(e) => typeDescription(e.target.value)}
            onFocus={() => setFocused("description")}
            onBlur={() => setFocused(null)}
            placeholder="Description"
            autoComplete="off"
            className={`${inputClass} ${hit ? "bg-neutral-50 text-neutral-700" : ""}`}
          />
        </label>
        {focused === "description" && !hit && list}
      </div>
    </div>
  );
}
