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
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">Damen Preorder</p>
          <p className="truncate text-xs text-neutral-500">
            {user.name}
            <span className="ml-1.5 inline-block rounded-full bg-accent-50 px-2 py-0.5 text-[11px] font-medium text-accent-800">
              {roleLabels[user.role]}
            </span>
          </p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
