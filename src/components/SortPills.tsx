import Link from "next/link";

// Row of pill links for switching list ordering; the active pill is filled.
export default function SortPills({
  value,
  options,
}: {
  value: string;
  options: Array<{ value: string; label: string; href: string }>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-neutral-500">Sort:</span>
      {options.map((o) => (
        <Link
          key={o.value}
          href={o.href}
          className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${
            value === o.value
              ? "bg-accent-600 text-white"
              : "border border-neutral-300 text-neutral-700 hover:border-accent-600"
          }`}
        >
          {o.label}
          {value === o.value ? " ✓" : ""}
        </Link>
      ))}
    </div>
  );
}
