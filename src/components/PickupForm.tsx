"use client";

// New Pickup form (buyer/admin). Self-learning supplier list: typing a pickup
// location that's been used before auto-fills its saved address, so the address
// is entered once. Same look and autocomplete as the order/error forms.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createPickup, updatePickup } from "@/app/actions/pickups";
import DateField from "@/components/DateField";

export interface SupplierOption {
  name: string;
  address: string;
}

export interface PickupInitial {
  id: number;
  supplierName: string;
  address: string;
  poNumber: string;
  pickupDate: string;
  amountOfStock: string;
  note: string;
  driver: string;
}

export default function PickupForm({
  suppliers,
  doneHref,
  pickup,
}: {
  suppliers: SupplierOption[];
  doneHref: string;
  pickup?: PickupInitial;
}) {
  const router = useRouter();
  const editing = pickup != null;
  const [supplierName, setSupplierName] = useState(pickup?.supplierName ?? "");
  const [supplierFocused, setSupplierFocused] = useState(false);
  const [addressTouched, setAddressTouched] = useState(false);
  const [poNumber, setPoNumber] = useState(pickup?.poNumber ?? "");
  const [pickupDate, setPickupDate] = useState(pickup?.pickupDate ?? "");
  const [address, setAddress] = useState(pickup?.address ?? "");
  const [amountOfStock, setAmountOfStock] = useState(pickup?.amountOfStock ?? "");
  const [note, setNote] = useState(pickup?.note ?? "");
  const [driver, setDriver] = useState(pickup?.driver ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const suggestions = useMemo(() => {
    const typed = supplierName.trim().toLowerCase();
    if (!typed) return [];
    return suppliers
      .filter(
        (s) =>
          s.name.toLowerCase().includes(typed) &&
          s.name.toLowerCase() !== typed,
      )
      .slice(0, 6);
  }, [supplierName, suppliers]);

  const ghostRemainder = useMemo(() => {
    if (!supplierName.trim()) return "";
    const lower = supplierName.toLowerCase();
    const match = suppliers.find(
      (s) =>
        s.name.toLowerCase().startsWith(lower) &&
        s.name.length > supplierName.length,
    );
    return match ? match.name.slice(supplierName.length) : "";
  }, [supplierName, suppliers]);

  // Fill the address from a known supplier — unless the user has typed their
  // own address, in which case we leave it alone.
  function applySupplier(name: string) {
    setSupplierName(name);
    setSupplierFocused(false);
    const match = suppliers.find(
      (s) => s.name.toLowerCase() === name.toLowerCase(),
    );
    if (match && match.address && !addressTouched) setAddress(match.address);
  }

  // When leaving the name field, auto-fill the address of an exact match.
  function maybeFillAddressOnBlur() {
    const match = suppliers.find(
      (s) => s.name.toLowerCase() === supplierName.trim().toLowerCase(),
    );
    if (match && match.address && !address.trim()) setAddress(match.address);
  }

  const inputClass =
    "mt-1.5 block w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base outline-none focus:border-accent-600 focus:ring-2 focus:ring-accent-100";

  async function handleSubmit() {
    setError(null);
    if (!supplierName.trim()) return setError("Enter a pickup location.");
    if (!pickupDate) return setError("Choose a date.");
    if (!poNumber.trim()) return setError("Enter a PO number.");
    if (!amountOfStock.trim()) return setError("Enter the amount of stock.");

    setSubmitting(true);
    const payload = {
      supplierName: supplierName.trim(),
      address,
      poNumber,
      pickupDate,
      amountOfStock,
      note,
      driver,
    };
    const result = editing
      ? await updatePickup(pickup.id, payload)
      : await createPickup(payload);
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
        <h2 className="text-base font-semibold">Pickup details</h2>

        {/* Pickup Location / Supplier — self-learning autocomplete */}
        <div className="relative mt-4">
          <label className="block text-sm font-medium text-neutral-700">
            Pickup Location
            <span className="relative mt-1.5 block">
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                onFocus={() => setSupplierFocused(true)}
                onBlur={() => {
                  setSupplierFocused(false);
                  maybeFillAddressOnBlur();
                }}
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
                    applySupplier(supplierName + ghostRemainder);
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
              {suggestions.map((s) => (
                <li key={s.name}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      applySupplier(s.name);
                    }}
                    className="flex w-full flex-col px-4 py-2.5 text-left hover:bg-accent-50"
                  >
                    <span className="text-base">{s.name}</span>
                    {s.address && (
                      <span className="text-xs text-neutral-400">
                        {s.address}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-neutral-700">
            PO #
            <input
              type="text"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              placeholder="e.g. 10482"
              className={inputClass}
            />
          </label>
          <DateField
            label="Date"
            value={pickupDate}
            onChange={setPickupDate}
            labelClassName="text-sm font-medium text-neutral-700"
            inputClassName={inputClass}
          />
        </div>

        <label className="mt-4 block text-sm font-medium text-neutral-700">
          Address
          <textarea
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setAddressTouched(true);
            }}
            rows={2}
            className={inputClass}
            placeholder="Auto-fills for known suppliers — or type a new address"
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-neutral-700">
          Amount of stock
          <textarea
            value={amountOfStock}
            onChange={(e) => setAmountOfStock(e.target.value)}
            rows={2}
            className={inputClass}
            placeholder="e.g. 12 boxes, 3 pallets"
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-neutral-700">
          Note <span className="font-normal text-neutral-400">(optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className={inputClass}
            placeholder="Anything the driver should know"
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-neutral-700">
          Driver <span className="font-normal text-neutral-400">(optional)</span>
          <input
            type="text"
            value={driver}
            onChange={(e) => setDriver(e.target.value)}
            placeholder="Driver name"
            className={inputClass}
          />
        </label>
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
            : "Save pickup"}
      </button>
    </div>
  );
}
