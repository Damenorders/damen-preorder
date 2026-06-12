"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminCreateUser, adminUpdateUser } from "@/app/actions/admin";
import type { Role } from "@/db/schema";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
}

const roleLabels: Record<Role, string> = {
  admin: "Admin",
  buyer: "Buyer",
  rep: "Rep",
};

const inputClass =
  "rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-base outline-none focus:border-accent-600 focus:ring-2 focus:ring-accent-100";

export default function UsersManager({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", role: "rep" as Role, password: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string }>, reset = false) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      if (reset) setForm({ name: "", email: "", role: "rep", password: "" });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Add a user</h2>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Name"
            className={inputClass}
          />
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="email@damenalimentaire.com"
            className={inputClass}
          />
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
            className={inputClass}
          >
            {Object.entries(roleLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="Temporary password (min 8 chars)"
            className={inputClass}
          />
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => adminCreateUser(form), true)}
          className="mt-3 rounded-xl bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50"
        >
          Create user
        </button>
        <p className="mt-2 text-xs text-neutral-400">
          Share the temporary password with them privately; they can change it later.
        </p>
      </section>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {users.map((u) => (
          <li
            key={u.id}
            className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm ${
              u.active ? "" : "opacity-60"
            }`}
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">
                {u.name}
                {u.id === currentUserId && (
                  <span className="ml-1.5 text-xs font-normal text-neutral-400">(you)</span>
                )}
              </span>
              <span className="block truncate text-xs text-neutral-400">
                {u.email}
                {u.active ? "" : " · deactivated"}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <select
                value={u.role}
                disabled={pending}
                onChange={(e) =>
                  run(() => adminUpdateUser(u.id, { role: e.target.value as Role }))
                }
                className="rounded-lg border border-neutral-300 bg-white px-2.5 py-2 text-sm font-medium outline-none focus:border-accent-600 disabled:opacity-50"
                aria-label={`Role for ${u.name}`}
              >
                {Object.entries(roleLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={pending || u.id === currentUserId}
                onClick={() => run(() => adminUpdateUser(u.id, { active: !u.active }))}
                className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-500 hover:bg-neutral-100 disabled:opacity-40"
              >
                {u.active ? "Deactivate" : "Reactivate"}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
