"use client";

// Dynamic order form — SPEC.md §7–9.
// One order header + many product lines. Product questions are rendered
// purely from the product's form_config data: choose a product → only that
// product's questions appear. Used for both create and edit.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createOrder, updateOrder } from "@/app/actions/orders";
import {
  formatSpecs,
  type ProductFormConfig,
  type SpecsJson,
} from "@/lib/product-config";
import type { Department } from "@/db/schema";
import type { OrderInput } from "@/lib/order-input";

export interface FormProduct {
  id: number;
  productName: string;
  formConfig: ProductFormConfig;
}

export interface FormLine {
  key: string; // local list key
  id?: number; // db id when editing an existing line
  productId: number;
  specsJson: SpecsJson;
  quantity: number;
  weight: string;
  notes: string;
}

interface OrderFormProps {
  department: Department;
  /** Existing client names, used for autocomplete suggestions */
  clients: string[];
  products: FormProduct[];
  mode: "create" | "edit";
  initial?: {
    orderId: number;
    clientName: string;
    deliveryDate: string;
    notes: string;
    lines: FormLine[];
  };
  /** Where to go after a successful submit */
  doneHref: string;
}

interface BuilderState {
  editingKey: string | null; // which list line is being edited, if any
  productId: number | null;
  specsJson: SpecsJson;
  // kept as text so the field can be cleared while typing
  quantity: string;
  weight: string;
  notes: string;
}

const emptyBuilder: BuilderState = {
  editingKey: null,
  productId: null,
  specsJson: {},
  quantity: "1",
  weight: "",
  notes: "",
};

let keyCounter = 0;
function nextKey() {
  keyCounter += 1;
  return `line-${keyCounter}`;
}

export default function OrderForm({
  department,
  clients,
  products,
  mode,
  initial,
  doneHref,
}: OrderFormProps) {
  const router = useRouter();

  // Sections with a single product (Other Preorders) skip the product picker
  // and open straight on that product's questions.
  const singleProduct = products.length === 1 ? products[0] : null;
  const initialBuilder = (): BuilderState =>
    singleProduct
      ? { ...emptyBuilder, productId: singleProduct.id }
      : emptyBuilder;

  const [clientName, setClientName] = useState(initial?.clientName ?? "");
  const [clientFocused, setClientFocused] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState(initial?.deliveryDate ?? "");
  const [orderNotes, setOrderNotes] = useState(initial?.notes ?? "");
  const [lines, setLines] = useState<FormLine[]>(initial?.lines ?? []);
  const [builder, setBuilder] = useState<BuilderState>(initialBuilder);
  const [builderError, setBuilderError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  // Live client suggestions: substring match, hidden once the field is an
  // exact match (nothing left to suggest).
  const clientSuggestions = useMemo(() => {
    const typed = clientName.trim().toLowerCase();
    if (!typed) return [];
    return clients
      .filter((name) => {
        const lower = name.toLowerCase();
        return lower.includes(typed) && lower !== typed;
      })
      .slice(0, 6);
  }, [clientName, clients]);

  // Inline ghost completion: typing "Bistro" shows " du Port" in light grey.
  // Accepted with Tab / → / Enter.
  const ghostRemainder = useMemo(() => {
    if (!clientName.trim()) return "";
    const lower = clientName.toLowerCase();
    const match = clients.find(
      (name) =>
        name.toLowerCase().startsWith(lower) && name.length > clientName.length,
    );
    return match ? match.slice(clientName.length) : "";
  }, [clientName, clients]);

  function acceptGhost() {
    if (ghostRemainder) setClientName(clientName + ghostRemainder);
  }
  const activeProduct = builder.productId
    ? (productById.get(builder.productId) ?? null)
    : null;

  // ----- line builder -------------------------------------------------------

  function chooseProduct(id: number) {
    setBuilder((b) => ({
      ...emptyBuilder,
      editingKey: b.editingKey,
      productId: id,
    }));
    setBuilderError(null);
  }

  function setSpec(key: string, value: string) {
    setBuilder((b) => ({ ...b, specsJson: { ...b.specsJson, [key]: value } }));
  }

  function validateBuilder(): string | null {
    if (!activeProduct) return "Choose a product first.";
    const config = activeProduct.formConfig;
    for (const field of config.fields) {
      if (field.required !== false && !builder.specsJson[field.key]) {
        return `Please choose ${field.label}.`;
      }
    }
    if (config.quantity) {
      const { min, max } = config.quantity;
      const qty = Number(builder.quantity);
      if (
        builder.quantity.trim() === "" ||
        !Number.isInteger(qty) ||
        qty < min ||
        qty > max
      ) {
        return `Quantity must be between ${min} and ${max}.`;
      }
    }
    const weightLabel = config.weightLabel ?? "Weight (kg)";
    if (builder.weight.trim() === "") {
      if (config.weightRequired) return `Enter ${weightLabel}.`;
    } else {
      const w = Number(builder.weight);
      if (!Number.isFinite(w) || w <= 0) {
        return `${weightLabel} must be a positive number.`;
      }
    }
    return null;
  }

  function commitLine() {
    const problem = validateBuilder();
    if (problem) {
      setBuilderError(problem);
      return;
    }
    const line: FormLine = {
      key: builder.editingKey ?? nextKey(),
      id: builder.editingKey
        ? lines.find((l) => l.key === builder.editingKey)?.id
        : undefined,
      productId: builder.productId!,
      specsJson: builder.specsJson,
      // products without a quantity input (meats) are stored as quantity 1
      quantity: activeProduct!.formConfig.quantity
        ? Number(builder.quantity)
        : 1,
      weight: builder.weight,
      notes: builder.notes,
    };
    setLines((prev) =>
      builder.editingKey
        ? prev.map((l) => (l.key === builder.editingKey ? line : l))
        : [...prev, line],
    );
    setBuilder(initialBuilder());
    setBuilderError(null);
  }

  function editLine(line: FormLine) {
    setBuilder({
      editingKey: line.key,
      productId: line.productId,
      specsJson: { ...line.specsJson },
      quantity: String(line.quantity),
      weight: line.weight,
      notes: line.notes,
    });
    setBuilderError(null);
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
    if (builder.editingKey === key) setBuilder(initialBuilder());
  }

  // ----- submit ---------------------------------------------------------------

  async function handleSubmit() {
    setServerError(null);
    if (!clientName.trim()) {
      setServerError("Please enter a client name.");
      return;
    }
    if (!deliveryDate) {
      setServerError("Please choose a delivery date.");
      return;
    }
    if (lines.length === 0) {
      setServerError("Add at least one product to the order.");
      return;
    }

    const input: OrderInput = {
      department,
      clientName: clientName.trim(),
      deliveryDate,
      notes: orderNotes,
      lines: lines.map((l) => ({
        id: l.id,
        productId: l.productId,
        specsJson: l.specsJson,
        quantity: l.quantity,
        weight: l.weight.trim() === "" ? null : Number(l.weight),
        notes: l.notes,
      })),
    };

    setSubmitting(true);
    const result =
      mode === "create"
        ? await createOrder(input)
        : await updateOrder(initial!.orderId, input);
    if (!result.ok) {
      setServerError(result.error);
      setSubmitting(false);
      return;
    }
    router.push(doneHref);
    router.refresh();
  }

  // ----- render ---------------------------------------------------------------

  const inputClass =
    "mt-1.5 block w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base outline-none focus:border-accent-600 focus:ring-2 focus:ring-accent-100";

  return (
    <div className="flex flex-col gap-4">
      {/* Order header — SPEC.md §9 */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold">Order details</h2>
        <div className="relative mt-4">
          <label className="block text-sm font-medium text-neutral-700">
            Client
            <span className="relative mt-1.5 block">
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                onFocus={() => setClientFocused(true)}
                onBlur={() => setClientFocused(false)}
                onKeyDown={(e) => {
                  if (!ghostRemainder) return;
                  const atEnd =
                    e.currentTarget.selectionStart === clientName.length;
                  if (
                    e.key === "Tab" ||
                    e.key === "Enter" ||
                    (e.key === "ArrowRight" && atEnd)
                  ) {
                    e.preventDefault();
                    acceptGhost();
                  }
                }}
                placeholder="Start typing — pick a match or enter a new client"
                autoComplete="off"
                className="block w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base outline-none focus:border-accent-600 focus:ring-2 focus:ring-accent-100"
              />
              {clientFocused && ghostRemainder && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre rounded-xl border border-transparent px-4 text-base"
                >
                  <span className="invisible">{clientName}</span>
                  <span className="text-neutral-400">{ghostRemainder}</span>
                </span>
              )}
            </span>
          </label>
          {clientFocused && clientSuggestions.length > 0 && (
            <ul className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
              {clientSuggestions.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    // onMouseDown so the pick lands before the input blurs
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setClientName(name);
                      setClientFocused(false);
                    }}
                    className="w-full px-4 py-3 text-left text-base hover:bg-accent-50"
                  >
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <span className="mt-1 block text-xs font-normal text-neutral-400">
            New names are saved automatically for next time.
          </span>
        </div>
        <label className="mt-4 block text-sm font-medium text-neutral-700">
          Delivery date
          <input
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-neutral-700">
          General notes <span className="font-normal text-neutral-400">(optional)</span>
          <textarea
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            rows={2}
            className={inputClass}
            placeholder="Anything the buyer should know"
          />
        </label>
      </section>

      {/* Added lines */}
      {lines.length > 0 && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold">
            Products in this order ({lines.length})
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {lines.map((line) => {
              const product = productById.get(line.productId);
              const specs = product
                ? formatSpecs(product.formConfig, line.specsJson)
                : "";
              return (
                <li
                  key={line.key}
                  className={`rounded-xl border px-4 py-3 ${
                    builder.editingKey === line.key
                      ? "border-accent-600 bg-accent-50"
                      : "border-neutral-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {product?.productName ?? "Unknown product"}
                      </p>
                      {specs && (
                        <p className="mt-0.5 text-sm text-neutral-500">{specs}</p>
                      )}
                      <p className="mt-0.5 text-sm text-neutral-700">
                        {[
                          product?.formConfig.quantity
                            ? `Qty ${line.quantity}`
                            : null,
                          line.weight.trim() !== "" ? `${line.weight} kg` : null,
                          line.notes || null,
                        ]
                          .filter(Boolean)
                          .join(" Â· ")}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => editLine(line)}
                        className="rounded-lg px-3 py-2 text-sm font-medium text-accent-700 hover:bg-accent-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLine(line.key)}
                        className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Line builder — choose product, then ONLY its questions (SPEC.md §7) */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold">
          {builder.editingKey
            ? "Edit product"
            : lines.length > 0
              ? "Add another product"
              : "Add a product"}
        </h2>

        {!activeProduct ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => chooseProduct(p.id)}
                className="rounded-xl border border-neutral-300 px-4 py-4 text-base font-medium transition hover:border-accent-600 hover:bg-accent-50"
              >
                {p.productName}
              </button>
            ))}
            {products.length === 0 && (
              <p className="col-span-2 text-sm text-neutral-500">
                No products in this section yet. An admin can add them.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-3">
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold text-accent-800">
                {activeProduct.productName}
              </p>
              {!singleProduct && (
                <button
                  type="button"
                  onClick={() =>
                    setBuilder((b) => ({ ...emptyBuilder, editingKey: b.editingKey }))
                  }
                  className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-500 hover:bg-neutral-100"
                >
                  Change product
                </button>
              )}
            </div>

            {/* Dynamic questions from form_config */}
            {activeProduct.formConfig.fields.map((field) => (
              <div key={field.key} className="mt-4">
                <p className="text-sm font-medium text-neutral-700">{field.label}</p>
                {field.type === "text" ? (
                  <textarea
                    value={builder.specsJson[field.key] ?? ""}
                    onChange={(e) => setSpec(field.key, e.target.value)}
                    rows={3}
                    maxLength={300}
                    placeholder="Write the order in your own words"
                    className={inputClass}
                  />
                ) : (
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {(field.options ?? []).map((option) => {
                      const selected = builder.specsJson[field.key] === option;
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setSpec(field.key, option)}
                          className={`rounded-xl border px-4 py-2.5 text-base font-medium transition ${
                            selected
                              ? "border-accent-600 bg-accent-600 text-white"
                              : "border-neutral-300 hover:border-accent-600"
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            <div
              className={`mt-4 grid gap-3 ${activeProduct.formConfig.quantity && !activeProduct.formConfig.hideWeight ? "grid-cols-2" : "grid-cols-1"}`}
            >
              {activeProduct.formConfig.quantity && (
                <label className="block text-sm font-medium text-neutral-700">
                  Quantity ({activeProduct.formConfig.quantity.min}–
                  {activeProduct.formConfig.quantity.max})
                  <input
                    type="number"
                    inputMode="numeric"
                    min={activeProduct.formConfig.quantity.min}
                    max={activeProduct.formConfig.quantity.max}
                    value={builder.quantity}
                    onChange={(e) =>
                      setBuilder((b) => ({ ...b, quantity: e.target.value }))
                    }
                    className={inputClass}
                  />
                </label>
              )}
              {!activeProduct.formConfig.hideWeight && (
                <label className="block text-sm font-medium text-neutral-700">
                  {activeProduct.formConfig.weightLabel ?? "Weight (kg)"}
                  {!activeProduct.formConfig.weightRequired && (
                    <span className="font-normal text-neutral-400"> (optional)</span>
                  )}
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.1"
                    value={builder.weight}
                    onChange={(e) =>
                      setBuilder((b) => ({ ...b, weight: e.target.value }))
                    }
                    className={inputClass}
                    placeholder="e.g. 42"
                  />
                </label>
              )}
            </div>

            {!activeProduct.formConfig.hideNotes && (
              <label className="mt-4 block text-sm font-medium text-neutral-700">
                Line notes <span className="font-normal text-neutral-400">(optional)</span>
                <input
                  type="text"
                  value={builder.notes}
                  onChange={(e) => setBuilder((b) => ({ ...b, notes: e.target.value }))}
                  className={inputClass}
                  placeholder="Notes for this product only"
                />
              </label>
            )}

            {builderError && (
              <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {builderError}
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={commitLine}
                className="flex-1 rounded-xl bg-accent-600 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-accent-700"
              >
                {builder.editingKey ? "Update product" : "Add to order"}
              </button>
              {(builder.editingKey || lines.length > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    setBuilder(initialBuilder());
                    setBuilderError(null);
                  }}
                  className="rounded-xl border border-neutral-300 px-4 py-3.5 text-base font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {serverError && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverError}
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
          : mode === "create"
            ? "Submit order"
            : "Save changes"}
      </button>
    </div>
  );
}
