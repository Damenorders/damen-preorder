import Link from "next/link";

interface CardLink {
  label: string;
  href?: string; // omitted → shown as a disabled "coming soon" item
  /** Filled accent style for the card's main everyday action */
  primary?: boolean;
}

export function DashboardCard({
  title,
  subtitle,
  links,
}: {
  title: string;
  subtitle?: string;
  links: CardLink[];
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-neutral-500">{subtitle}</p>}
      <div className="mt-4 flex flex-col gap-2">
        {links.map((link) =>
          link.href ? (
            <Link
              key={link.label}
              href={link.href}
              className={
                link.primary
                  ? "rounded-xl bg-accent-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-700"
                  : "rounded-xl bg-accent-50 px-4 py-3 text-sm font-medium text-accent-800 transition hover:bg-accent-100"
              }
            >
              {link.label}
            </Link>
          ) : (
            <span
              key={link.label}
              className="cursor-not-allowed rounded-xl bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-400"
              title="Coming in a later phase"
            >
              {link.label} · soon
            </span>
          ),
        )}
      </div>
    </section>
  );
}
