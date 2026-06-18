import Link from "next/link";
import type { CardCorner } from "@/lib/labels";

interface CardLink {
  label: string;
  href?: string; // omitted → shown as a disabled "coming soon" item
  /** Filled accent style for the card's main everyday action */
  primary?: boolean;
  /** "highlight" → a blue slightly lighter than the header (Fill Form, Buyer Table) */
  variant?: "highlight";
}

// Corner accent colours (meat red, fish blue, other orange).
const cornerColorHex: Record<CardCorner["color"], string> = {
  red: "#dc2626",
  blue: "#2563eb",
  orange: "#f97316",
};

export function DashboardCard({
  title,
  subtitle,
  links,
  corner,
}: {
  title: string;
  subtitle?: string;
  links: CardLink[];
  /** Optional coloured triangle accent in a top corner */
  corner?: CardCorner;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      {corner && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background: `radial-gradient(65% 65% at ${
              corner.position === "tl" ? "top left" : "top right"
            }, ${cornerColorHex[corner.color]} 0%, ${cornerColorHex[corner.color]}00 45%)`,
          }}
        />
      )}
      <h2 className="relative z-10 text-base font-semibold">{title}</h2>
      {subtitle && (
        <p className="relative z-10 mt-0.5 text-sm text-neutral-500">{subtitle}</p>
      )}
      <div className="relative z-10 mt-4 flex flex-col gap-2">
        {links.map((link) =>
          link.href ? (
            <Link
              key={link.label}
              href={link.href}
              className={
                link.variant === "highlight"
                  ? "rounded-xl bg-[#4d61bd] px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-700"
                  : link.primary
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
