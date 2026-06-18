"use client";

// Inline weight editor on the expanded submission row. Shows a Save button
// only once the value differs from what's stored.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateLineWeight } from "@/app/actions/orders";

export default function LineWeightInput({
  lineId,
  initial,
}: {
  lineId: number;
  initial: string | null;
}) {
  const initialValue = initial ? String(Number(initial)) : "";
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const dirty = value !== initialValue && value !== "";

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateLineWeight(lineId, Number(value));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col">
      <span className="inline-flex items-center gap-1.5">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.1"
          value={value}
          disabled={pending}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && dirty) save();
          }}
          className="w-20 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm font-semibold outline-none focus:border-accent-600 focus:ring-2 focus:ring-accent-100 disabled:opacity-50"
          aria-label="Weight in kg"
        />
        <span className="text-sm text-neutral-500">kg</span>
        {dirty && (
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-lg bg-accent-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-accent-700 disabled:opacity-50"
          >
            {pending ? "…" : "Save"}
          </button>
        )}
      </span>
      {error && <span className="mt-1 text-xs text-red-600">{error}</span>}
    </span>
  );
}
