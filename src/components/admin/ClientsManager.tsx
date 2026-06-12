"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminCreateClient, adminUpdateClient } from "@/app/actions/admin";

interface ClientRow {
  id: number;
  clientName: string;
  active: boolean;
  externalId: string | null;
}

const inputClass =
  "rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-base outline-none focus:border-accent-600 focus:ring-2 focus:ring-accent-100";

export default function ClientsManager({ clients }: { clients: ClientRow[] }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      setNewName("");
      setEditingId(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Add a client</h2>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Client name"
            className={`${inputClass} flex-1`}
          />
          <button
            type="button"
            disabled={pending || !newName.trim()}
            onClick={() => run(() => adminCreateClient(newName))}
            className="rounded-xl bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </section>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {clients.map((client) => (
          <li
            key={client.id}
            className={`flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm ${
              client.active ? "" : "opacity-60"
            }`}
          >
            {editingId === client.id ? (
              <span className="flex flex-1 gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={`${inputClass} flex-1`}
                />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(() => adminUpdateClient(client.id, { name: editName }))
                  }
                  className="rounded-xl bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-600"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <>
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {client.clientName}
                  </span>
                  <span className="text-xs text-neutral-400">
                    {client.externalId}
                    {client.active ? "" : " · inactive"}
                  </span>
                </span>
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(client.id);
                      setEditName(client.clientName);
                    }}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-accent-700 hover:bg-accent-50"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        adminUpdateClient(client.id, { active: !client.active }),
                      )
                    }
                    className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-500 hover:bg-neutral-100"
                  >
                    {client.active ? "Deactivate" : "Reactivate"}
                  </button>
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
