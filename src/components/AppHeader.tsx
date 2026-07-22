import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import type { User } from "@/db/schema";

const roleLabels: Record<User["role"], string> = {
  admin: "Admin",
  buyer: "Buyer",
  rep: "Rep",
  picker: "Picker",
  scheduling: "Scheduling",
  clients: "Clients",
  butcher: "Butcher",
  dispatch: "Dispatch",
  owner: "Owner",
};

export default function AppHeader({ user }: { user: User }) {
  return (
    <header className="sticky top-0 z-10 bg-accent-700 shadow-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {/* brightness-0 invert renders the blue wordmark in white */}
          <Image
            src="/damen-logo.png"
            alt="Damen service alimentaire"
            width={960}
            height={540}
            priority
            className="-my-3 h-16 w-auto brightness-0 invert"
          />
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-widest text-cyan-flash">
              Preorders
            </p>
            <p className="truncate text-xs text-white/80">
              {user.name}
              <span className="ml-1.5 inline-block rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium text-white">
                {roleLabels[user.role]}
              </span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Command Center — buyer/admin only (the page is gated to them). */}
          {(user.role === "buyer" || user.role === "admin") && (
            <Link
              href="/buyer/dashboard"
              aria-label="Command Center"
              title="Command Center"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 text-white transition hover:bg-white/10"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden
              >
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
              </svg>
            </Link>
          )}
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-full border border-white/30 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
