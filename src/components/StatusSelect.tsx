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

type Props =
  | { kind: "submission"; orderId: number; value: SubmissionStatus }
  | { kind: "buyer"; orderId: number; value: BuyerTableStatus };

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
        className="rounded-lg border border-neutral-300 bg-white px-2.5 py-2 text-sm font-medium outline-none focus:border-accent-600 disabled:opacity-50"
        aria-label={
          props.kind === "submission" ? "Submission status" : "Buyer status"
        }
      >
        {Object.entries(labels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {error && <span className="mt-1 text-xs text-red-600">{error}</span>}
    </span>
  );
}
