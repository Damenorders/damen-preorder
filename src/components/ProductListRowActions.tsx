"use client";

// Delete for one Product List row. Two taps: the button turns into an explicit
// confirm, so a mis-tap on a phone can't wipe a list someone spent a walk
// building. Deleting takes its items with it.

import { useState } from "react";
import { deleteProductList } from "@/app/actions/product-lists";

export default function ProductListRowActions({
  listId,
  name,
}: {
  listId: number;
  name: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-xl px-4 py-2.5 text-sm font-medium text-neutral-500 transition hover:bg-neutral-100"
      >
        Delete
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        disabled={deleting}
        onClick={async () => {
          setDeleting(true);
          await deleteProductList(listId);
          setDeleting(false);
          setConfirming(false);
        }}
        className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-neutral-300"
      >
        {deleting ? "Deleting…" : `Delete “${name}”`}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-500"
      >
        Cancel
      </button>
    </span>
  );
}
