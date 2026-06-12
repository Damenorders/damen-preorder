import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-24">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-neutral-500">
          That page doesn&apos;t exist or has moved.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block w-full rounded-xl bg-accent-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-accent-700"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
