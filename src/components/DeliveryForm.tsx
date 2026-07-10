"use client";

// New/Edit Delivery form (buyer/admin) — supplier + date only. Shares the
// self-learning supplier autocomplete used by the pickup form.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createDelivery, updateDelivery } from "@/app/actions/deliveries";
import DateField from "@/components/DateField";

export interface DeliveryInitial {
  id: number;
  supplierName: string;
  deliveryDate: string;
}

export default function DeliveryForm({
  supplierNames,
  doneHref,
  delivery,
}: {
  supplierNames: string[];
  doneHref: string;
  delivery?: DeliveryInitial;
}) {
  const router = useRouter();
  const editing = delivery != null;
  const [supplierName, setSupplierName] = useState(delivery?.supplierName ?? "");
  const [supplierFocused, setSupplierFocused] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState(delivery?.deliveryDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const suggestions = useMemo(() => {
    const typed = supplierName.trim().toLowerCase();
    if (!typed) return [];
    return supplierNames
      .filter((n) => n.toLowerCase().includes(typed) && n.toLowerCase() !== typed)
      .slice(0, 6);
  }, [supplierName, supplierNames]);

  const ghostRemainder = useMemo(() => {
    if (!supplierName.trim()) return "";
    const lower = supplierName.toLowerCase();
    const match = supplierNames.find(
      (n) => n.toLowerCase().startsWith(lower) && n.length > supplierName.length,
    );
    return match ? match.slice(supplierName.length) : "";
  }, [supplierName, supplierNames]);

  const inputClass =
    "mt-1.5 block w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base outline-none focus:border-accent-600 focus:ring-2 focus:ring-accent-100";

  async function handleSubmit() {
    setError(null);
    if (!supplierName.trim()) return setError("Enter a supplier name.");
    if (!deliveryDate) return setError("Choose a date.");

    setSubmitting(true);
    const payload = { supplierName: supplierName.trim(), deliveryDate };
    const result = editing
      ? await updateDelivery(delivery.id, payload)
      : await createDelivery(payload);
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
        <h2 className="text-base font-semibold">Delivery details</h2>

        {/* Supplier — self-learning autocomplete */}
        <div className="relative mt-4">
          <label className="block text-sm font-medium text-neutral-700">
            Supplier Name
            <span className="relative mt-1.5 block">
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                onFocus={() => setSupplierFocused(true)}
                onBlur={() => setSupplierFocused(false)}
                onKeyDown={(e) => {
                  if (!ghostRemainder) return;
                  const atEnd =
                    e.currentTarget.selectionStart === supplierName.length;
                  if (
                    e.key === "Tab" ||
                    e.key === "Enter" ||
                    (e.key === "ArrowRight" && atEnd)
                  ) {
                    e.preventDefault();
                    setSupplierName(supplierName + ghostRemainder);
                  }
                }}
                placeholder="Start typing — pick a supplier or enter a new one"
                autoComplete="off"
                className="block w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base outline-none focus:border-accent-600 focus:ring-2 focus:ring-accent-100"
              />
              {supplierFocused && ghostRemainder && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre rounded-xl border border-transparent px-4 text-base"
                >
                  <span className="invisible">{supplierName}</span>
                  <span className="text-neutral-400">{ghostRemainder}</span>
                </span>
              )}
            </span>
          </label>
          {supplierFocused && suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
              {suggestions.map((n) => (
                <li key={n}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSupplierName(n);
                      setSupplierFocused(false);
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

        <div className="mt-4">
          <DateField
            label="Date"
            value={deliveryDate}
            onChange={setDeliveryDate}
            labelClassName="text-sm font-medium text-neutral-700"
            inputClassName={inputClass}
          />
        </div>
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="rounded-xl bg-accent-600 px-4 py-4 text-base font-semibold text-white transition hover:bg-accent-700 disabled:opacity-60"
      >
        {submitting
          ? "Saving…"
          : editing
            ? "Save changes"
            : "Save delivery"}
      </button>
    </div>
  );
}
