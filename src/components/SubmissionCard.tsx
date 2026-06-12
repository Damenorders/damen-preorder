"use client";

// Compact submission row that expands to full detail — SPEC.md §15.
// Receives a SubmissionView, which never contains buyer_table_status.

import { useState } from "react";
import Link from "next/link";
import { departmentLabels, submissionStatusLabels } from "@/lib/labels";
import StatusSelect from "@/components/StatusSelect";
import type { SubmissionView } from "@/lib/orders-data";

// Same colour language as the buyer's dropdowns:
// Pending yellow, Ready green, Shipped dark green.
const statusStyles: Record<SubmissionView["submissionStatus"], string> = {
  pending: "bg-amber-100 text-amber-900",
  ready: "bg-green-100 text-green-800",
  shipped: "bg-emerald-800 text-white",
};

function formatDateTime(value: Date | string) {
  return new Date(value).toLocaleString("en-US", {
    timeZone: "America/Montreal",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// "Jun 12, 2026" — for plain dates (delivery) and timestamps (submission)
function formatDate(value: Date | string) {
  const date =
    typeof value === "string" ? new Date(`${value}T12:00:00`) : value;
  return date.toLocaleDateString("en-US", {
    timeZone: "America/Montreal",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function SubmissionCard({
  submission,
  canEdit,
  showRep,
  showDepartment = false,
  manageStatus = false,
}: {
  submission: SubmissionView;
  canEdit: boolean;
  showRep: boolean;
  /** Show the module name (used on the cross-module All Submissions page) */
  showDepartment?: boolean;
  /** Buyer/admin only: render the submission-status editor (SPEC.md §11) */
  manageStatus?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const totalWeight = submission.lines.reduce(
    (sum, l) => sum + (l.weight ? Number(l.weight) : 0),
    0,
  );
  const productSummary =
    submission.lines.length === 1
      ? submission.lines[0].product
      : `${submission.lines[0]?.product ?? "—"} +${submission.lines.length - 1} more`;

  return (
    <li className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
      {/* Compact row: Client | Delivery | Product | Qty | Weight | Status.
          With manageStatus, the status is an inline dropdown — no need to
          open the order to change it. */}
      <div className="flex w-full items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="truncate font-medium">{submission.clientName}</p>
          <p className="mt-0.5 truncate text-sm text-neutral-500">
            {formatDate(submission.deliveryDate)} · {productSummary}
            {totalWeight > 0 ? ` · ${totalWeight.toFixed(1)} kg` : ""}
          </p>
        </button>
        {manageStatus ? (
          <StatusSelect
            kind="submission"
            orderId={submission.id}
            value={submission.submissionStatus}
          />
        ) : (
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[submission.submissionStatus]}`}
          >
            {submissionStatusLabels[submission.submissionStatus]}
          </span>
        )}
      </div>

      {/* Expanded detail: specs, notes, times */}
      {open && (
        <div className="border-t border-neutral-100 px-4 py-3">
          <ul className="flex flex-col gap-2">
            {submission.lines.map((line) => (
              <li key={line.id} className="rounded-xl bg-neutral-50 px-3 py-2.5">
                <p className="font-medium">{line.product}</p>
                {line.specs && (
                  <p className="mt-0.5 text-sm text-neutral-600">{line.specs}</p>
                )}
                <p className="mt-0.5 text-sm text-neutral-700">
                  Qty {line.quantity}
                  {line.weight ? ` · ${line.weight} kg` : ""}
                </p>
                {line.notes && (
                  <p className="mt-0.5 text-sm italic text-neutral-500">
                    “{line.notes}”
                  </p>
                )}
              </li>
            ))}
          </ul>

          {submission.notes && (
            <p className="mt-3 text-sm text-neutral-600">
              <span className="font-medium">Order notes:</span> {submission.notes}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-400">
            <span>
              {submission.externalId}
              {showDepartment
                ? ` · ${departmentLabels[submission.department]}`
                : ""}
              {showRep ? ` · ${submission.repName}` : ""} · Submitted{" "}
              {formatDateTime(submission.createdAt)}
              {+submission.updatedAt !== +submission.createdAt
                ? ` · Updated ${formatDateTime(submission.updatedAt)}`
                : ""}
            </span>
            {canEdit && (
              <Link
                href={`/orders/edit/${submission.id}`}
                className="rounded-lg bg-accent-50 px-3 py-2 text-sm font-medium text-accent-800 hover:bg-accent-100"
              >
                Edit
              </Link>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
