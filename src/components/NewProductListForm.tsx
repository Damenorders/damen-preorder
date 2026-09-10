"use client";

// Names the list, creates it, and drops the buyer straight into the builder.
// The list exists on the server from this moment on, so a second phone can join
// it and nothing is lost if the first one dies mid-walk.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProductList } from "@/app/actions/product-lists";

export default function NewProductListForm({
  defaultName,
}: {
  defaultName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    setCreating(true);
    const result = await createProductList(name);
    if (!result.ok) {
      setCreating(false);
      setError(result.error);
      return;
    }
    router.push(`/buyer/product-lists/${result.id}`);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!creating) start();
      }}
      className="flex flex-col gap-4"
    >
      <div>
        <label
          htmlFor="new-list-name"
          className="block text-sm font-medium text-neutral-700"
        >
          List name
        </label>
        <input
          id="new-list-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-3 text-base"
          placeholder="e.g. Marché Adonis — fall list"
        />
        <p className="mt-1 text-xs text-neutral-500">
          Usually the client you’ll print this for. You can rename it later.
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={creating || !name.trim()}
        className="rounded-xl bg-accent-600 px-4 py-3 text-base font-semibold text-white disabled:bg-neutral-300"
      >
        {creating ? "Starting…" : "Start adding items"}
      </button>
    </form>
  );
}
