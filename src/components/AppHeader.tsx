import { signOut } from "@/app/actions/auth";
import type { User } from "@/db/schema";

const roleLabels: Record<User["role"], string> = {
  admin: "Admin",
  buyer: "Buyer",
  rep: "Rep",
  picker: "Picker",
};

export default function AppHeader({ user }: { user: User }) {
  return (
    <header className="sticky top-0 z-10 bg-accent-700 shadow-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold leading-tight tracking-tight text-white">
            Damen
            <span className="ml-2 align-middle text-[11px] font-medium uppercase tracking-widest text-cyan-flash">
              Preorders
            </span>
          </p>
          <p className="truncate text-xs text-white/70">
            {user.name}
            <span className="ml-1.5 inline-block rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium text-white">
              {roleLabels[user.role]}
            </span>
          </p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-full border border-white/30 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
