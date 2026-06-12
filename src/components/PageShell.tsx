import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import type { User } from "@/db/schema";

export default function PageShell({
  user,
  backHref,
  backLabel,
  title,
  subtitle,
  wide = false,
  full = false,
  children,
}: {
  user: User;
  backHref: string;
  backLabel: string;
  title: string;
  subtitle?: string;
  wide?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <AppHeader user={user} />
      <main
        className={`mx-auto w-full flex-1 px-4 py-6 ${full ? "max-w-[1500px]" : wide ? "max-w-5xl" : "max-w-2xl"}`}
      >
        <Link
          href={backHref}
          className="text-sm font-medium text-accent-700 hover:underline"
        >
          ← {backLabel}
        </Link>
        <h1 className="mt-2 text-xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </main>
    </>
  );
}
