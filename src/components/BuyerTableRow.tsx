"use client";

// One buyer-table line. Clicking the row expands a detail row showing the full
// note (which is otherwise clamped/cut off in the dense table).

import { useState } from "react";
import Link from "next/link";
import StatusSelect from "@/components/StatusSelect";
import { formatDate, formatDateTime } from "@/lib/dates";
import { weightUnit } from "@/lib/labels";
import type { BuyerTableRow as Row } from "@/lib/buyer-data";

// Spec chips in soft tints; colour derived from the chip's first word so the
// same attribute keeps the same colour on every row.
const chipColors = [
  "bg-pink-100 text-pink-900",
  "bg-orange-100 text-orange-900",
  "bg-amber-100 text-amber-900",
  "bg-sky-100 text-sky-900",
  "bg-violet-100 text-violet-900",
  "bg-teal-100 text-teal-900",
];
function chipColorFor(part: string): string {
  const word = part.split(" ")[0];
  let hash = 0;
  for (let i = 0; i < word.length; i++) {
    hash = (hash * 31 + word.charCodeAt(i)) % 9973;
  }
  return chipColors[hash % chipColors.length];
}

const tdClass = "border-b border-neutral-100 px-2 py-1 align-top text-[13px]";

export default function BuyerTableRow({
  row,
  index,
  today,
  tomorrow,
}: {
  row: Row;
  index: number;
  today: string;
  tomorrow: string;
}) {
  const [open, setOpen] = useState(false);
  const zebra = index % 2 === 1 ? "bg-neutral-100" : "bg-white";
  const tag =
    row.deliveryDate === today
      ? "today"
      : row.deliveryDate === tomorrow
        ? "tomorrow"
        : null;
  const notes = [row.lineNotes, row.orderNotes].filter(Boolean).join(" — ");
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <>
      <tr
        onClick={() => setOpen((o) => !o)}
        className={`cursor-pointer transition-colors hover:bg-accent-50 ${zebra}`}
      >
        <td className={`${tdClass} font-medium`}>{row.clientName}</td>
        <td className={tdClass} onClick={stop}>
          <StatusSelect kind="buyer" orderId={row.orderId} value={row.status} compact />
        </td>
        <td className={`${tdClass} whitespace-nowrap`}>
          {formatDate(row.deliveryDate)}
          {tag && (
            <span
              className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
                tag === "today"
                  ? "bg-cyan-soft text-accent-800"
                  : "bg-accent-50 text-accent-800"
              }`}
            >
              {tag}
            </span>
          )}
        </td>
        <td className={`${tdClass} whitespace-nowrap text-right tabular-nums`}>
          {row.weight ? `${row.weight} ${weightUnit(row.department)}` : "—"}
        </td>
        <td className={`${tdClass} whitespace-nowrap font-medium`}>{row.product}</td>
        <td className={tdClass}>
          <span className="flex flex-wrap gap-0.5">
            {row.specs
              ? row.specs.split(" · ").map((part, idx) => (
                  <span
                    key={idx}
                    className={`whitespace-nowrap rounded px-1 py-0.5 text-[11px] font-medium ${
                      // Other Preorders specs are always turquoise so they stand out.
                      row.department === "other"
                        ? "bg-teal-200 text-teal-900"
                        : chipColorFor(part)
                    }`}
                  >
                    {part}
                  </span>
                ))
              : "—"}
          </span>
        </td>
        <td className={`${tdClass} text-right tabular-nums`}>{row.quantity ?? "—"}</td>
        <td className={`${tdClass} max-w-[180px]`}>
          {notes ? (
            <span className="flex items-center gap-1 text-neutral-600">
              <span className="line-clamp-1">{notes}</span>
              <span className="shrink-0 text-neutral-400">{open ? "▾" : "▸"}</span>
            </span>
          ) : (
            "—"
          )}
        </td>
        <td className={`${tdClass} whitespace-nowrap text-neutral-500`}>
          {formatDateTime(row.createdAt)}
        </td>
        <td className={`${tdClass} whitespace-nowrap text-neutral-500`}>
          {formatDateTime(row.updatedAt)}
        </td>
        <td className={`${tdClass} whitespace-nowrap text-neutral-500`}>{row.repName}</td>
        <td className={tdClass} onClick={stop}>
          <Link
            href={`/orders/edit/${row.orderId}`}
            className="rounded-md bg-accent-50 px-2 py-1 text-xs font-medium text-accent-800 hover:bg-accent-100"
          >
            Edit
          </Link>
        </td>
      </tr>
      {open && (
        <tr className={zebra}>
          <td
            colSpan={12}
            className="border-b border-neutral-200 px-3 py-2.5 text-[13px] text-neutral-700"
          >
            <span className="font-semibold text-neutral-500">Note: </span>
            {notes || (
              <span className="text-neutral-400">No note for this line.</span>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
