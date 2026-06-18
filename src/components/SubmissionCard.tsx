"use client";

// Compact submission row that expands to full detail — SPEC.md §15.
// Receives a SubmissionView, which never contains buyer_table_status.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { departmentLabels, submissionStatusLabels, weightUnit } from "@/lib/labels";
import { formatDate, formatDateTime } from "@/lib/dates";
import { deleteOrder } from "@/app/actions/orders";
import StatusSelect from "@/components/StatusSelect";
import LineWeightInput from "@/components/LineWeightInput";
import type { SubmissionView } from "@/lib/orders-data";

// Same colour language as the buyer's dropdowns:
// Pending yellow, Ready green, Shipped dark green.
const statusStyles: Record<SubmissionView["submissionStatus"], string> = {
  pending: "bg-amber-100 text-amber-900",
  ready: "bg-green-100 text-green-800",
  shipped: "bg-emerald-800 text-white",
};

export default function SubmissionCard({
  submission,
  canEdit,
  showRep,
  showDepartment = false,
  manageStatus = false,
  editButton = false,
  canDelete = false,
  canEditWeight = false,
}: {
  submission: SubmissionView;
  /** Full edit: shows the Edit link to the order edit page */
  canEdit: boolean;
  showRep: boolean;
  /** Show the module name (used on the cross-module All Submissions page) */
  showDepartment?: boolean;
  /** Buyer/admin only: render the submission-status editor (SPEC.md §11) */
  manageStatus?: boolean;
  /** Edit Form mode: show an Edit button in place of the status */
  editButton?: boolean;
  /** Buyer/admin only: allow deleting the submission */
  canDelete?: boolean;
  /** Inline weight editing without full edit rights (e.g. Scheduling) */
  canEditWeight?: boolean;
}) {
  const weightEditable = canEdit || canEditWeight;
  const [open, setOpen] = useState(false);
  const unit = weightUnit(submission.department);
  const router = useRouter();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();

  function handleDelete() {
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteOrder(submission.id);
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      router.refresh();
    });
  }

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
            {totalWeight > 0 ? (
              <>
                {" · "}
                <span className="font-semibold text-neutral-700">
                  {totalWeight.toFixed(1)} {unit}
                </span>
              </>
            ) : (
              ""
            )}
          </p>
        </button>
        {/* Status is always shown; the Edit button appears alongside it (it
            no longer replaces the status). */}
        <div className="flex shrink-0 items-center gap-2">
          {manageStatus ? (
            <StatusSelect
              kind="submission"
              orderId={submission.id}
              value={submission.submissionStatus}
            />
          ) : (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[submission.submissionStatus]}`}
            >
              {submissionStatusLabels[submission.submissionStatus]}
            </span>
          )}
          {editButton && canEdit && (
            <Link
              href={`/orders/edit/${submission.id}`}
              className="rounded-xl bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-700"
            >
              Edit
            </Link>
          )}
        </div>
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
                <p className="mt-1 flex items-center gap-2 text-sm text-neutral-700">
                  {line.quantity != null && <span>Qty {line.quantity}</span>}
                  {weightEditable ? (
                    <LineWeightInput
                      lineId={line.id}
                      initial={line.weight}
                      unit={unit}
                    />
                  ) : line.weight ? (
                    <span>
                      <span className="font-semibold">{line.weight}</span> {unit}
                    </span>
                  ) : (
                    <span>—</span>
                  )}
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
            <div className="flex items-center gap-2">
              {canEdit && (
                <Link
                  href={`/orders/edit/${submission.id}`}
                  className="rounded-lg bg-accent-50 px-3 py-2 text-sm font-medium text-accent-800 hover:bg-accent-100"
                >
                  Edit
                </Link>
              )}
              {canDelete &&
                (confirmingDelete ? (
                  <span className="flex items-center gap-2">
                    <span className="text-sm text-neutral-600">Delete?</span>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      {deleting ? "Deleting…" : "Yes, delete"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      disabled={deleting}
                      className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                  >
                    Delete
                  </button>
                ))}
            </div>
          </div>
          {deleteError && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {deleteError}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
