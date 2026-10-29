"use client";

// Delete a Codes to Fix entry. Asks in the page (never confirm(), which fails
// silently in a webview — CLAUDE.md known trap 1).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCodeFix } from "@/app/actions/code-fixes";

export default function CodeFixDeleteButton({ id, clientName }: { id: number; clientName: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:border-red-600 hover:bg-red-50"
      >
        Delete
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 text-sm">
      <span className="text-red-800">Delete the {clientName} entry and all its products?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await deleteCodeFix(id);
            if (!r.ok) setError(r.error);
            else router.refresh();
          })
        }
        className="rounded-md bg-red-600 px-3 py-1 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Yes, delete"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setAsking(false)}
        className="rounded-md px-3 py-1 font-medium text-neutral-700 hover:bg-white"
      >
        Cancel
      </button>
      {error && <span className="w-full text-xs text-red-700">{error}</span>}
    </div>
  );
}
