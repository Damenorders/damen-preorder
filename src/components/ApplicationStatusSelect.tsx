"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setApplicationStatus } from "@/app/actions/applications";
import type { ApplicationStatus } from "@/db/schema";

const STATUSES: ApplicationStatus[] = ["new", "approved", "rejected"];
const labels: Record<ApplicationStatus, string> = {
  new: "New",
  approved: "Approved",
  rejected: "Rejected",
};
const colors: Record<ApplicationStatus, string> = {
  new: "border-amber-300 bg-amber-100 text-amber-900",
  approved: "border-emerald-800 bg-emerald-800 text-white",
  rejected: "border-red-300 bg-red-100 text-red-800",
};

export default function ApplicationStatusSelect({
  id,
  value,
}: {
  id: number;
  value: ApplicationStatus;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col">
      <select
        value={value}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            setError(null);
            const r = await setApplicationStatus(
              id,
              e.target.value as ApplicationStatus,
            );
            if (!r.ok) setError(r.error);
            else router.refresh();
          })
        }
        className={`rounded-lg border px-2.5 py-1.5 text-sm font-medium outline-none disabled:opacity-50 ${colors[value]}`}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s} className="bg-white text-neutral-900">
            {labels[s]}
          </option>
        ))}
      </select>
      {error && <span className="mt-1 text-xs text-red-600">{error}</span>}
    </span>
  );
}
