"use client";

// Print controls for the pickup print view. Auto-opens the browser print
// dialog once on load (so "Save as PDF" is one tap), and offers a manual
// button. Screen-only — hidden when printing.

import { useEffect } from "react";

export default function PrintButton({ auto = true }: { auto?: boolean }) {
  useEffect(() => {
    if (!auto) return;
    // Let the logo/layout settle before opening the dialog.
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [auto]);

  return (
    <div className="no-print mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4">
      <a
        href="/buyer/pickups"
        className="text-sm font-medium text-accent-700 hover:underline"
      >
        ← Back to Pickups
      </a>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-xl bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-700"
      >
        🖨 Print / Save as PDF
      </button>
    </div>
  );
}
