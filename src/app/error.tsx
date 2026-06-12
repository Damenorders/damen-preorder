"use client";

// Friendly error state for any page failure (network blip, transient
// database hiccup, unexpected bug). Most transient cases recover on retry.

import Link from "next/link";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-24">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Usually this is a brief connection hiccup. Trying again almost always
          fixes it.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 w-full rounded-xl bg-accent-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-accent-700"
        >
          Try again
        </button>
        <Link
          href="/"
          className="mt-3 inline-block text-sm font-medium text-accent-700 hover:underline"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
