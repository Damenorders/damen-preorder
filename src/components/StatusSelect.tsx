"use client";

// Inline status dropdown for buyers/admins. kind="submission" edits
// submission_status (§11); kind="buyer" edits buyer_table_status (§12).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setBuyerTableStatus,
  setSubmissionStatus,
} from "@/app/actions/status";
import {
  buyerTableStatusLabels,
  submissionStatusLabels,
} from "@/lib/labels";
import type { BuyerTableStatus, SubmissionStatus } from "@/db/schema";

type Props = (
  | { kind: "submission"; orderId: number; value: SubmissionStatus }
  | { kind: "buyer"; orderId: number; value: BuyerTableStatus }
) & { compact?: boolean };

// Colour coding: Pending yellow, Ready green, Received/Shipped dark green;
// in-between buyer states get their own tints.
const statusColors: Record<string, string> = {
  pending: "border-amber-300 bg-amber-100 text-amber-900",
  ready: "border-green-300 bg-green-100 text-green-800",
  shipped: "border-emerald-800 bg-emerald-800 text-white",
  ordered: "border-sky-300 bg-sky-100 text-sky-800",
  pending_delivery: "border-orange-300 bg-orange-100 text-orange-800",
  pending_pickup: "border-violet-300 bg-violet-100 text-violet-800",
  received: "border-emerald-800 bg-emerald-800 text-white",
};

export default function StatusSelect(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const labels: Record<string, string> =
    props.kind === "submission"
      ? submissionStatusLabels
      : buyerTableStatusLabels;

  function handleChange(next: string) {
    setError(null);
    startTransition(async () => {
      const result =
        props.kind === "submission"
          ? await setSubmissionStatus(props.orderId, next as SubmissionStatus)
          : await setBuyerTableStatus(props.orderId, next as BuyerTableStatus);
      if (!result.ok) {
        setError(result.error ?? "Could not update status.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col">
      <select
        value={props.value}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value)}
        className={`rounded-lg border font-medium outline-none focus:ring-2 focus:ring-accent-100 disabled:opacity-50 ${
          props.compact ? "px-1.5 py-1 text-xs" : "px-2.5 py-2 text-sm"
        } ${statusColors[props.value] ?? "border-neutral-300 bg-white"}`}
        aria-label={
          props.kind === "submission" ? "Submission status" : "Buyer status"
        }
      >
        {Object.entries(labels).map(([value, label]) => (
          <option key={value} value={value} className="bg-white text-neutral-900">
            {label}
          </option>
        ))}
      </select>
      {error && <span className="mt-1 text-xs text-red-600">{error}</span>}
    </span>
  );
}
