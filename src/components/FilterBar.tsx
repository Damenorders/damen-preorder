"use client";

// URL-driven filter bar. Each control writes its value into the query string;
// the server component re-renders with filtered data. Used by All Submissions
// (SPEC.md §14) and the Buyer Table (§18) with different field sets.

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// A date filter whose entire card opens the native picker on click — not just
// the small calendar icon.
function DateFilterInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <label
      className="block cursor-pointer text-xs font-medium text-neutral-600"
      onClick={() => {
        // Open the calendar on a click anywhere on the card — including the
        // input's text area, which the native control alone ignores.
        try {
          ref.current?.showPicker?.();
        } catch {
          ref.current?.focus();
        }
      }}
    >
      {label}
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full cursor-pointer rounded-lg border border-neutral-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-accent-600"
      />
    </label>
  );
}

export interface SelectField {
  type: "select";
  param: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  /** Label for an empty "no filter" choice; omit when options cover everything */
  emptyLabel?: string;
  /** Value the page applies when the param is absent (e.g. default views) */
  defaultValue?: string;
}
export interface DateField {
  type: "date";
  param: string;
  label: string;
}
export interface CheckboxField {
  type: "checkbox";
  param: string;
  label: string;
}
export interface MultiField {
  type: "multi";
  param: string;
  label: string;
  /** Toggle chips; selected values are comma-joined into the param */
  options: Array<{ value: string; label: string }>;
}
export type FilterField = SelectField | DateField | CheckboxField | MultiField;

export default function FilterBar({
  fields,
  activeCount,
}: {
  fields: FilterField[];
  activeCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(activeCount > 0);

  // Filter memory: each page remembers its last-used filters on this device.
  const storageKey = `damen-filters:${pathname}`;

  // Restore on arrival when the URL carries no filters of its own.
  useEffect(() => {
    if (searchParams.toString() !== "") return;
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(storageKey);
    } catch {
      // storage unavailable (private mode etc.) — just show defaults
    }
    if (saved) {
      router.replace(`${pathname}?${saved}`, { scroll: false });
    }
    // run once per mount — restoring is an arrival-time decision only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remember every filter change.
  useEffect(() => {
    const qs = searchParams.toString();
    if (qs === "") return;
    try {
      window.localStorage.setItem(storageKey, qs);
    } catch {
      // ignore — filters still work for this visit
    }
  }, [searchParams, storageKey]);

  function setParam(param: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(param, value);
    } else {
      params.delete(param);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function clearAll() {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    router.replace(pathname, { scroll: false });
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg px-2 py-1.5 text-sm font-semibold text-neutral-700"
        >
          Filters{activeCount > 0 ? ` (${activeCount})` : ""} {open ? "▴" : "▾"}
        </button>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="rounded-lg px-2 py-1.5 text-sm font-medium text-accent-700 hover:bg-accent-50"
          >
            Reset
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {fields.map((field) => {
            const key = `${field.type}-${field.param}`;
            const raw = searchParams.get(field.param) ?? "";
            if (field.type === "select") {
              const current = raw || (field.defaultValue ?? "");
              return (
                <label key={key} className="block text-xs font-medium text-neutral-600">
                  {field.label}
                  <select
                    value={current}
                    onChange={(e) => setParam(field.param, e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-accent-600"
                  >
                    {field.emptyLabel !== undefined && (
                      <option value="">{field.emptyLabel}</option>
                    )}
                    {field.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              );
            }
            if (field.type === "multi") {
              const selected = raw.split(",").filter(Boolean);
              const toggleValue = (value: string) => {
                const next = selected.includes(value)
                  ? selected.filter((v) => v !== value)
                  : [...selected, value];
                setParam(field.param, next.join(","));
              };
              return (
                <div key={key} className="col-span-2 sm:col-span-3">
                  <p className="text-xs font-medium text-neutral-600">{field.label}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {field.options.map((o) => {
                      const on = selected.includes(o.value);
                      return (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => toggleValue(o.value)}
                          className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                            on
                              ? "bg-accent-600 text-white"
                              : "border border-neutral-300 text-neutral-700 hover:border-accent-600"
                          }`}
                        >
                          {o.label}
                          {on ? " ✓" : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }
            const current = raw;
            if (field.type === "date") {
              return (
                <DateFilterInput
                  key={key}
                  label={field.label}
                  value={current}
                  onChange={(value) => setParam(field.param, value)}
                />
              );
            }
            return (
              <label
                key={key}
                className="flex items-end gap-2 pb-2 text-sm font-medium text-neutral-700"
              >
                <input
                  type="checkbox"
                  checked={current === "1"}
                  onChange={(e) => setParam(field.param, e.target.checked ? "1" : "")}
                  className="h-5 w-5 rounded border-neutral-300 accent-[#0d9488]"
                />
                {field.label}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
