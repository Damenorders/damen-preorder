"use client";

// Pending ⇄ Fixed for one Codes to Fix line — buyers and admin only (the page
// renders a plain badge for reps; the action re-checks the role).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCodeFixLineStatus } from "@/app/actions/code-fixes";

export default function CodeFixStatusToggle({
  lineId,
  status,
}: {
  lineId: number;
  status: "pending" | "fixed";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fixed = status === "fixed";

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await setCodeFixLineStatus(lineId, fixed ? "pending" : "fixed");
            if (!r.ok) setError(r.error);
            else router.refresh();
          })
        }
        className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-semibold transition disabled:opacity-60 ${
          fixed
            ? "bg-green-100 text-green-800 hover:bg-green-200"
            : "bg-amber-100 text-amber-900 hover:bg-amber-200"
        }`}
        title={fixed ? "Mark as pending" : "Mark as fixed"}
      >
        {pending ? "…" : fixed ? "✓ Fixed" : "Pending"}
      </button>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
