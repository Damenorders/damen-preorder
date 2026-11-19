"use client";

// Buyer Table rows with tick-to-select and a bulk status change. Status lives
// on the order, so changing a selected line changes its whole order — the
// confirm dialog says how many orders and lines that is.

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import BuyerTableRow from "@/components/BuyerTableRow";
import { setBuyerTableStatusBulk } from "@/app/actions/status";
import { buyerTableStatusLabels } from "@/lib/labels";
import type { BuyerTableStatus } from "@/db/schema";
import type { BuyerTableRow as Row } from "@/lib/buyer-data";

const STATUS_ORDER: BuyerTableStatus[] = [
  "pending",
  "ordered",
  "pending_delivery",
  "pending_pickup",
  "received",
];

const thClass =
  "sticky top-0 whitespace-nowrap border-b border-neutral-200 bg-neutral-50 px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500";

export default function BuyerTableView({
  rows,
  today,
  tomorrow,
}: {
  rows: Row[];
  today: string;
  tomorrow: string;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [target, setTarget] = useState<BuyerTableStatus | "">("");
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, startTransition] = useTransition();

  // Only lines still on screen count (filters or live refresh can drop some).
  const selectedRows = useMemo(
    () => rows.filter((r) => picked.has(r.lineId)),
    [rows, picked],
  );
  const selectedOrderIds = useMemo(
    () => [...new Set(selectedRows.map((r) => r.orderId))],
    [selectedRows],
  );
  // Every on-screen line the change will touch (whole orders).
  const affectedLines = rows.filter((r) => selectedOrderIds.includes(r.orderId)).length;
  const allSelected = rows.length > 0 && selectedRows.length === rows.length;

  // Last row ticked or unticked without Shift — the start of a Shift range.
  const anchor = useRef<number | null>(null);

  function toggle(lineId: number, shift: boolean) {
    setMessage(null);
    const willSelect = !picked.has(lineId);
    const from = anchor.current === null ? -1 : rows.findIndex((r) => r.lineId === anchor.current);
    const to = rows.findIndex((r) => r.lineId === lineId);
    const next = new Set(picked);
    if (shift && from !== -1 && to !== -1) {
      // Every row from the anchor to this one takes this row's new state.
      const [a, b] = from < to ? [from, to] : [to, from];
      for (let i = a; i <= b; i++) {
        if (willSelect) next.add(rows[i].lineId);
        else next.delete(rows[i].lineId);
      }
    } else {
      if (willSelect) next.add(lineId);
      else next.delete(lineId);
      anchor.current = lineId;
    }
    setPicked(next);
  }
  function toggleAll() {
    setMessage(null);
    setPicked(allSelected ? new Set() : new Set(rows.map((r) => r.lineId)));
  }

  function apply() {
    if (!target) return;
    const status = target;
    startTransition(async () => {
      const result = await setBuyerTableStatusBulk(selectedOrderIds, status);
      setConfirming(false);
      if (!result.ok) {
        setMessage({ ok: false, text: result.error ?? "Could not change the status." });
        return;
      }
      setMessage({
        ok: true,
        text: `${result.changed} order${result.changed === 1 ? "" : "s"} set to ${buyerTableStatusLabels[status]}.`,
      });
      setPicked(new Set());
      setTarget("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-2 text-sm ${
          selectedRows.length > 0
            ? "border-accent-600 bg-accent-50"
            : "border-neutral-200 bg-white"
        }`}
      >
        <button
          type="button"
          onClick={toggleAll}
          className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 font-medium text-neutral-700 hover:border-accent-600"
        >
          {allSelected ? "Clear selection" : `Select all (${rows.length})`}
        </button>
        {selectedRows.length > 0 ? (
          <>
            <span className="font-medium text-neutral-800">
              {selectedRows.length} line{selectedRows.length === 1 ? "" : "s"} selected ·{" "}
              {selectedOrderIds.length} order{selectedOrderIds.length === 1 ? "" : "s"}
            </span>
            <label className="flex items-center gap-1.5">
              <span className="text-neutral-600">Change status to</span>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value as BuyerTableStatus | "")}
                className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5"
              >
                <option value="">Choose…</option>
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {buyerTableStatusLabels[s]}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!target || busy}
              onClick={() => setConfirming(true)}
              className="rounded-full bg-accent-600 px-4 py-1.5 font-medium text-white disabled:opacity-40"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => setPicked(new Set())}
              className="text-neutral-500 underline-offset-2 hover:underline"
            >
              Cancel
            </button>
          </>
        ) : (
          <span className="text-neutral-500">
            Tick rows to change their status together. Hold Shift to tick every row in between.
          </span>
        )}
        {message && (
          <span className={message.ok ? "text-emerald-700" : "text-red-600"}>
            {message.text}
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full min-w-[1100px] border-collapse">
          <thead>
            <tr>
              <th className={`${thClass} w-8 text-center`}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = selectedRows.length > 0 && !allSelected;
                  }}
                  onChange={toggleAll}
                  aria-label="Select all rows"
                  className="h-4 w-4 cursor-pointer accent-accent-600"
                />
              </th>
              <th className={thClass}>Client Name</th>
              <th className={thClass}>Status</th>
              <th className={thClass}>Delivery Date</th>
              <th className={`${thClass} text-right`}>Weight</th>
              <th className={`${thClass} text-right`}>Qty</th>
              <th className={thClass}>Product</th>
              <th className={thClass}>Specs</th>
              <th className={thClass}>Notes</th>
              <th className={thClass}>Created</th>
              <th className={thClass}>Updated</th>
              <th className={thClass}>Rep</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <BuyerTableRow
                key={row.lineId}
                row={row}
                index={i}
                today={today}
                tomorrow={tomorrow}
                selected={picked.has(row.lineId)}
                onToggleSelect={(shift) => toggle(row.lineId, shift)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {confirming && target && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-base font-semibold">
              Set {selectedOrderIds.length} order{selectedOrderIds.length === 1 ? "" : "s"} to{" "}
              {buyerTableStatusLabels[target]}?
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              Status is per order, so this changes every line of those orders —{" "}
              {affectedLines} line{affectedLines === 1 ? "" : "s"} on this screen
              {affectedLines > selectedRows.length
                ? ` (${affectedLines - selectedRows.length} more than you ticked)`
                : ""}
              .
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(false)}
                className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={apply}
                className="rounded-full bg-accent-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? "Saving…" : "Change status"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
