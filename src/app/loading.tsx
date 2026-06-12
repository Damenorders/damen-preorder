export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <div className="flex flex-col items-center gap-3">
        <span
          aria-hidden
          className="h-8 w-8 animate-spin rounded-full border-[3px] border-neutral-200 border-t-accent-600"
        />
        <p className="text-sm text-neutral-400">Loading…</p>
      </div>
    </div>
  );
}
