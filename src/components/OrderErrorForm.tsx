"use client";

// Order Errors form — a single flat report (customer, date, order #, error
// type, department, note). Same look and client autocomplete as the order
// forms, but no product lines.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createOrderError } from "@/app/actions/errors";
import DateField from "@/components/DateField";
import {
  ERROR_DEPARTMENTS,
  errorDepartmentLabels,
  ERROR_TYPES,
  errorTypeLabels,
} from "@/lib/labels";

export default function OrderErrorForm({
  clients,
  doneHref,
}: {
  clients: string[];
  doneHref: string;
}) {
  const router = useRouter();
  const [customerName, setCustomerName] = useState("");
  const [customerFocused, setCustomerFocused] = useState(false);
  const [errorDate, setErrorDate] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [errorType, setErrorType] = useState("");
  const [department, setDepartment] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const suggestions = useMemo(() => {
    const typed = customerName.trim().toLowerCase();
    if (!typed) return [];
    return clients
      .filter((n) => n.toLowerCase().includes(typed) && n.toLowerCase() !== typed)
      .slice(0, 6);
  }, [customerName, clients]);

  const ghostRemainder = useMemo(() => {
    if (!customerName.trim()) return "";
    const lower = customerName.toLowerCase();
    const match = clients.find(
      (n) => n.toLowerCase().startsWith(lower) && n.length > customerName.length,
    );
    return match ? match.slice(customerName.length) : "";
  }, [customerName, clients]);

  const inputClass =
    "mt-1.5 block w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base outline-none focus:border-accent-600 focus:ring-2 focus:ring-accent-100";

  async function handleSubmit() {
    setError(null);
    if (!customerName.trim()) return setError("Enter a customer name.");
    if (!errorDate) return setError("Choose a date.");
    if (!errorType) return setError("Choose an error type.");
    if (!department) return setError("Choose a department.");

    setSubmitting(true);
    const result = await createOrderError({
      customerName: customerName.trim(),
      errorDate,
      orderNumber,
      errorType,
      department,
      note,
    });
    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    router.push(doneHref);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold">Error details</h2>

        {/* Customer — self-learning autocomplete */}
        <div className="relative mt-4">
          <label className="block text-sm font-medium text-neutral-700">
            Customer Name
            <span className="relative mt-1.5 block">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                onFocus={() => setCustomerFocused(true)}
                onBlur={() => setCustomerFocused(false)}
                onKeyDown={(e) => {
                  if (!ghostRemainder) return;
                  const atEnd = e.currentTarget.selectionStart === customerName.length;
                  if (e.key === "Tab" || e.key === "Enter" || (e.key === "ArrowRight" && atEnd)) {
                    e.preventDefault();
                    setCustomerName(customerName + ghostRemainder);
                  }
                }}
                placeholder="Start typing — pick a match or enter a new customer"
                autoComplete="off"
                className="block w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base outline-none focus:border-accent-600 focus:ring-2 focus:ring-accent-100"
              />
              {customerFocused && ghostRemainder && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre rounded-xl border border-transparent px-4 text-base"
                >
                  <span className="invisible">{customerName}</span>
                  <span className="text-neutral-400">{ghostRemainder}</span>
                </span>
              )}
            </span>
          </label>
          {customerFocused && suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
              {suggestions.map((n) => (
                <li key={n}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setCustomerName(n);
                      setCustomerFocused(false);
                    }}
                    className="w-full px-4 py-3 text-left text-base hover:bg-accent-50"
                  >
                    {n}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DateField
            label="Date"
            value={errorDate}
            onChange={setErrorDate}
            labelClassName="text-sm font-medium text-neutral-700"
            inputClassName={inputClass}
          />
          <label className="block text-sm font-medium text-neutral-700">
            Order # <span className="font-normal text-neutral-400">(optional)</span>
            <input
              type="text"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="e.g. 10482"
              className={inputClass}
            />
          </label>
        </div>

        {/* Department */}
        <div className="mt-4">
          <p className="text-sm font-medium text-neutral-700">Department</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {ERROR_DEPARTMENTS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDepartment(d)}
                className={`rounded-xl border px-4 py-2.5 text-base font-medium transition ${
                  department === d
                    ? "border-accent-600 bg-accent-600 text-white"
                    : "border-neutral-300 hover:border-accent-600"
                }`}
              >
                {errorDepartmentLabels[d]}
              </button>
            ))}
          </div>
        </div>

        {/* Error type */}
        <div className="mt-4">
          <p className="text-sm font-medium text-neutral-700">Error Type</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {ERROR_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setErrorType(t)}
                className={`rounded-xl border px-4 py-2.5 text-base font-medium transition ${
                  errorType === t
                    ? "border-accent-600 bg-accent-600 text-white"
                    : "border-neutral-300 hover:border-accent-600"
                }`}
              >
                {errorTypeLabels[t]}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-4 block text-sm font-medium text-neutral-700">
          Note <span className="font-normal text-neutral-400">(which item was the error for?)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className={inputClass}
            placeholder="Describe the item and what went wrong"
          />
        </label>
      </section>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="rounded-xl bg-accent-600 px-4 py-4 text-base font-semibold text-white transition hover:bg-accent-700 disabled:opacity-60"
      >
        {submitting ? "Submitting…" : "Submit error report"}
      </button>
    </div>
  );
}
