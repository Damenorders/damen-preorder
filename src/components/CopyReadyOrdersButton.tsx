"use client";

// One-click copy of all Ready meat orders as WhatsApp-ready text, so the
// butcher can paste straight into the dispatch group instead of rewriting it.

import { useState } from "react";

export default function CopyReadyOrdersButton({
  text,
  count,
}: {
  text: string;
  count: number;
}) {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for browsers without the async clipboard API.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        // give up silently; the preview still lets them copy manually
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm font-medium text-neutral-600 transition hover:border-accent-600"
        >
          {showPreview ? "Hide" : "Preview"}
        </button>
        <button
          type="button"
          onClick={copy}
          className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
        >
          {copied ? "✓ Copied!" : `📋 Copy ready orders (${count})`}
        </button>
      </div>
      {showPreview && (
        <pre className="max-h-80 w-full overflow-auto whitespace-pre-wrap rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-left text-sm text-neutral-800">
          {text}
        </pre>
      )}
    </div>
  );
}
