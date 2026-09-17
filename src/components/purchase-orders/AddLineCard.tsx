"use client";

// The buyer card: quantity, unit, product — no supplier field. The product is
// picked out of our own sales catalogue and the line lands on that product's
// supplier's open order. When the catalogue doesn't know the supplier yet, the
// buyer is asked once and the answer is kept on the product for everyone.

import { useEffect, useRef, useState } from "react";
import {
  addPurchaseLine,
  assignSupplierAndAdd,
  createCatalogProduct,
  listPurchaseSections,
  listPurchaseSuppliers,
  searchPurchaseCatalog,
} from "@/app/actions/purchase-orders";
import {
  PURCHASE_UNITS,
  formatQty,
  matchesQuery,
  matchSupplierName,
  type PurchaseUnit,
} from "@/lib/order-book-core";
import type {
  AssignResult,
  CreateProductResult,
  PlacedLine,
  PurchaseHit,
  SupplierOption,
} from "@/lib/purchase-order-types";
import Dialog, { buttonClass } from "./Dialog";

export const inputClass =
  "h-11 rounded-xl border border-neutral-300 bg-white px-3 text-base";

type Modal =
  | { kind: "choose"; typed: string; products: PurchaseHit[] }
  | { kind: "similar"; typed: string; products: PurchaseHit[] }
  | { kind: "none"; typed: string }
  | { kind: "assign"; product: PurchaseHit }
  | { kind: "create"; typed: string }
  | null;

export function unitLabel(unit: PurchaseUnit): string {
  return unit;
}

function placedMessage(line: PlacedLine): string {
  const what = `${line.name}${line.pack ? ` (${line.pack})` : ""}`;
  return line.merged
    ? `Added to the existing line on ${line.supplierName}'s order — now ${formatQty(line.qty)} ${line.unit}. ${what}`
    : `Added to ${line.supplierName}'s order: ${formatQty(line.qty)} ${line.unit} ${what}.`;
}

/** Product, pack and supplier — what the buyer checks before committing. */
export function HitLabel({ hit }: { hit: PurchaseHit }) {
  return (
    <span className="block min-w-0">
      <span className="block text-sm font-medium text-neutral-900">{hit.name}</span>
      <span className="block text-xs text-neutral-500">
        {hit.code}
        {hit.supplierName ? (
          <>
            {" · "}
            {hit.pack} · {hit.unit} · <b className="text-neutral-700">{hit.supplierName}</b>
          </>
        ) : (
          <>
            {" · "}
            <span className="font-semibold text-amber-700">No supplier yet</span>
          </>
        )}
      </span>
    </span>
  );
}

export default function AddLineCard() {
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState<PurchaseUnit>("each");
  const [unitTouched, setUnitTouched] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<PurchaseHit | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);

  const qtyRef = useRef<HTMLInputElement>(null);
  const unitRef = useRef<HTMLSelectElement>(null);
  const productRef = useRef<HTMLInputElement>(null);

  // Debounced typeahead; results carry the query they answer (as in the
  // Product List builder) so a slow reply never overwrites a newer one.
  const trimmed = query.trim();
  const [found, setFound] = useState<{ query: string; hits: PurchaseHit[] }>({
    query: "",
    hits: [],
  });
  const showSuggestions = trimmed.length >= 2 && !(picked && picked.name === query);
  const results = found.query === trimmed ? found.hits : [];
  const searching = showSuggestions && found.query !== trimmed;

  const runId = useRef(0);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || (picked && picked.name === query)) return;
    const id = ++runId.current;
    const timer = setTimeout(async () => {
      try {
        const hits = await searchPurchaseCatalog(q);
        if (runId.current === id) setFound({ query: q, hits });
      } catch {
        if (runId.current === id) setError("Search failed. Try again.");
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, picked]);

  /** Returns the unit now showing, so a submit right after uses it. */
  function pick(hit: PurchaseHit): PurchaseUnit {
    setPicked(hit);
    setQuery(hit.name);
    setError(null);
    // The purchase unit on file shows in the unit box, where the buyer can see
    // and change it — unless they already chose one themselves.
    if (hit.unit && !unitTouched) {
      setUnit(hit.unit);
      return hit.unit;
    }
    return unit;
  }

  function pickAndSubmit(hit: PurchaseHit) {
    submit(hit.code, pick(hit));
  }

  function added(line: PlacedLine, extra = "") {
    setNotice(`${extra}${placedMessage(line)}`);
    setError(null);
    setModal(null);
    setPicked(null);
    setQuery("");
    setUnitTouched(false);
    productRef.current?.focus();
  }

  async function submit(itemCode?: string, unitShown: PurchaseUnit = unit) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const result = await addPurchaseLine({
        qty,
        unit: unitShown,
        itemCode: itemCode ?? picked?.code ?? null,
        typed: query,
        unitChosen: unitTouched,
      });
      switch (result.status) {
        case "added":
          added(result.line);
          break;
        case "ask":
          setModal(null);
          setError(result.message);
          (result.field === "qty"
            ? qtyRef
            : result.field === "unit"
              ? unitRef
              : productRef
          ).current?.focus();
          break;
        case "needs-sourcing":
          setModal({ kind: "assign", product: result.product });
          break;
        case "check-unit":
          setModal(null);
          pick(result.product);
          setNotice(
            `Found it at ${result.product.supplierName}, bought in ${result.product.unit}. Check the quantity and unit, then press Add.`,
          );
          unitRef.current?.focus();
          break;
        case "choose":
        case "similar":
          setModal({ kind: result.status, typed: result.typed, products: result.products });
          break;
        case "none":
          setModal({ kind: "none", typed: result.typed });
          break;
        case "error":
          setModal(null);
          setError(result.message);
          break;
      }
    } catch {
      setError("That didn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold">Add by product</h2>
      <p className="mt-0.5 text-sm text-neutral-500">
        Type a product from our catalogue — the supplier is found for you.
      </p>

      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) submit();
        }}
      >
        <div className="flex gap-2">
          <input
            ref={qtyRef}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            inputMode="decimal"
            aria-label="Quantity"
            className={`${inputClass} w-20 text-right`}
          />
          <select
            ref={unitRef}
            value={unit}
            onChange={(e) => {
              setUnit(e.target.value as PurchaseUnit);
              setUnitTouched(true);
            }}
            aria-label="Unit"
            className={`${inputClass} w-28`}
          >
            {PURCHASE_UNITS.map((u) => (
              <option key={u} value={u}>
                {unitLabel(u)}
              </option>
            ))}
          </select>
        </div>
        <div className="relative min-w-0 flex-1">
          <input
            ref={productRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (picked) setPicked(null);
            }}
            type="search"
            enterKeyHint="go"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Product"
            placeholder="Product name, pack, code or supplier…"
            className={`${inputClass} w-full`}
          />
          {picked && (
            <p className="mt-1 text-xs text-neutral-600">
              {picked.supplierName ? (
                <>
                  Goes to <b>{picked.supplierName}</b> · {picked.pack} · buys in {picked.unit}
                </>
              ) : (
                <span className="font-semibold text-amber-700">
                  No supplier yet — you&apos;ll be asked who we buy it from.
                </span>
              )}
            </p>
          )}
          {showSuggestions && (
            <div className="mt-1 max-h-80 overflow-y-auto rounded-xl border border-neutral-200">
              {searching && <p className="px-3 py-3 text-sm text-neutral-500">Searching…</p>}
              {!searching && results.length === 0 && (
                <p className="px-3 py-3 text-sm text-neutral-500">
                  Nothing in the catalogue matches “{trimmed}”. Press Add to create it.
                </p>
              )}
              {!searching &&
                results.map((hit) => (
                  <button
                    type="button"
                    key={hit.code}
                    onClick={() => pick(hit)}
                    className="block w-full border-b border-neutral-100 px-3 py-2 text-left last:border-b-0 active:bg-accent-50"
                  >
                    <HitLabel hit={hit} />
                  </button>
                ))}
            </div>
          )}
        </div>
        <button type="submit" disabled={busy} className={`${buttonClass.primary} sm:w-28`}>
          {busy ? "Adding…" : "Add"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">
          {notice}
        </p>
      )}

      {(modal?.kind === "choose" || modal?.kind === "similar") && (
        <Dialog
          title={modal.kind === "choose" ? "Which one?" : "Did you mean one of these?"}
          onCancel={() => setModal(null)}
          actions={
            <button type="button" className={buttonClass.ghost} onClick={() => setModal(null)}>
              {modal.kind === "choose" ? "Cancel" : "None of these"}
            </button>
          }
        >
          <p>
            {modal.kind === "choose"
              ? `“${modal.typed}” matches more than one product in the catalogue. Which one is this order for?`
              : `Nothing matches “${modal.typed}” exactly. The closest in the catalogue:`}
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {modal.products.map((p) => (
              <button
                key={p.code}
                type="button"
                className={buttonClass.choice}
                disabled={busy}
                onClick={() => pickAndSubmit(p)}
              >
                <HitLabel hit={p} />
              </button>
            ))}
          </div>
        </Dialog>
      )}

      {modal?.kind === "none" && (
        <Dialog
          title="Not in the catalogue"
          onCancel={() => setModal(null)}
          actions={
            <>
              <button type="button" className={buttonClass.ghost} onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={buttonClass.primary}
                onClick={() => setModal({ kind: "create", typed: modal.typed })}
              >
                Create this product
              </button>
            </>
          }
        >
          <p>
            “{modal.typed}” is not in our catalogue, so there is nothing to match it to.
            You can add it as a new catalogue product — you&apos;ll type its code and section,
            then say who we buy it from.
          </p>
        </Dialog>
      )}

      {modal?.kind === "create" && (
        <CreateProductDialog
          typed={modal.typed}
          onCancel={() => setModal(null)}
          onUse={pickAndSubmit}
        />
      )}

      {modal?.kind === "assign" && (
        <AssignSupplierDialog
          product={modal.product}
          qty={qty}
          unit={unitTouched ? unit : null}
          onCancel={() => setModal(null)}
          onAssigned={(result) => {
            const facts = [
              `${result.line.name} is now bought from ${result.line.supplierName} in ${result.line.pack} (${result.line.unit}).`,
              result.matchedExisting
                ? ` The supplier you typed is already on file as ${result.matchedExisting} — used that.`
                : result.createdSupplier
                  ? ` ${result.line.supplierName} was added as a new supplier.`
                  : "",
            ].join("");
            added(result.line, `${facts} `);
          }}
          onUseExisting={pickAndSubmit}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Supplier assignment (spec §6)
// ---------------------------------------------------------------------------

function AssignSupplierDialog({
  product,
  qty: initialQty,
  unit: initialUnit,
  onCancel,
  onAssigned,
  onUseExisting,
}: {
  product: PurchaseHit;
  qty: string;
  /** The card's unit when the buyer chose it; null lets the purchase unit lead. */
  unit: PurchaseUnit | null;
  onCancel: () => void;
  onAssigned: (result: Extract<AssignResult, { status: "assigned" }>) => void;
  onUseExisting: (product: PurchaseHit) => void;
}) {
  const [supplierList, setSupplierList] = useState<SupplierOption[] | null>(null);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  // "On file": type to search the suppliers, tap one to pick it. A name typed
  // without tapping is still matched against the list on save.
  const [supplierText, setSupplierText] = useState("");
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  // The new-supplier name the buyer already confirmed is not an existing one.
  const [confirmedNew, setConfirmedNew] = useState<string | null>(null);
  const [newContact, setNewContact] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [pack, setPack] = useState("");
  const [purchaseUnit, setPurchaseUnit] = useState("");
  const [sku, setSku] = useState("");
  const [qty, setQty] = useState(initialQty);
  const [lineUnit, setLineUnit] = useState<string>(initialUnit ?? "");
  const [lineUnitTouched, setLineUnitTouched] = useState(initialUnit !== null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [similar, setSimilar] = useState<{ typed: string; suppliers: SupplierOption[] } | null>(null);
  const [taken, setTaken] = useState<PurchaseHit | null>(null);

  useEffect(() => {
    let live = true;
    listPurchaseSuppliers()
      .then((list) => {
        if (!live) return;
        setSupplierList(list);
        if (list.length === 0) setMode("new");
      })
      .catch(() => live && setError("Couldn't load the suppliers. Close and try again."));
    return () => {
      live = false;
    };
  }, []);

  function startNewSupplier(name: string, confirmed: boolean) {
    setMode("new");
    setNewName(name);
    setConfirmedNew(confirmed ? name : null);
    setSimilar(null);
  }

  async function save(opts: { supplierId?: number; confirmNew?: boolean } = {}) {
    setError(null);

    let pickedId = opts.supplierId ?? null;
    if (pickedId === null && mode === "existing") {
      pickedId = supplierId;
      if (pickedId === null) {
        // Typed but not tapped: resolve the name against the list here, and
        // never turn an unknown name into a new supplier without saying so.
        const match = matchSupplierName(supplierText, supplierList ?? []);
        if (match.kind === "empty") {
          setError("Type the supplier's name, or tap one from the list.");
          return;
        }
        if (match.kind === "similar") {
          setSimilar({ typed: supplierText.trim(), suppliers: match.suppliers });
          return;
        }
        if (match.kind === "new") {
          startNewSupplier(match.name, false);
          setError(
            `“${match.name}” isn't on file. Add a contact if you have one, then save to create it as a new supplier.`,
          );
          return;
        }
        pickedId = match.supplier.id;
      }
    }

    setBusy(true);
    try {
      const useExisting = pickedId !== null;
      const result = await assignSupplierAndAdd({
        itemCode: product.code,
        supplierId: pickedId,
        newSupplier: useExisting
          ? null
          : { name: newName, contact: newContact, email: newEmail },
        confirmNewSupplier:
          opts.confirmNew ?? (confirmedNew !== null && confirmedNew === newName.trim()),
        purchasePack: pack,
        purchaseUnit,
        supplierSku: sku,
        qty,
        unit: lineUnit,
      });
      switch (result.status) {
        case "assigned":
          onAssigned(result);
          return;
        case "ask":
          setError(result.message);
          return;
        case "supplier-similar":
          setSimilar({ typed: result.typed, suppliers: result.suppliers });
          return;
        case "already-assigned":
          setTaken(result.product);
          return;
        case "error":
          setError(result.message);
          return;
      }
    } catch {
      setError("That didn't save. Nothing was assigned — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (taken) {
    return (
      <Dialog
        title="Someone just assigned it"
        onCancel={onCancel}
        actions={
          <>
            <button type="button" className={buttonClass.ghost} onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className={buttonClass.primary} onClick={() => onUseExisting(taken)}>
              Add to {taken.supplierName}&apos;s order
            </button>
          </>
        }
      >
        <p>
          While you were typing, {taken.name} was assigned to <b>{taken.supplierName}</b> (
          {taken.pack}, {taken.unit}). Nothing you entered was saved.
        </p>
      </Dialog>
    );
  }

  if (similar) {
    return (
      <Dialog
        title="Is this a supplier we already have?"
        onCancel={() => setSimilar(null)}
        actions={
          <>
            <button type="button" className={buttonClass.ghost} onClick={() => setSimilar(null)}>
              Back
            </button>
            <button
              type="button"
              className={buttonClass.primary}
              disabled={busy}
              onClick={() =>
                mode === "new"
                  ? save({ confirmNew: true })
                  : startNewSupplier(similar.typed, true)
              }
            >
              No — add “{similar.typed}” as new
            </button>
          </>
        }
      >
        <p>“{similar.typed}” looks like a supplier already on file:</p>
        <div className="mt-3 flex flex-col gap-2">
          {similar.suppliers.map((s) => (
            <button
              key={s.id}
              type="button"
              className={buttonClass.choice}
              disabled={busy}
              onClick={() => save({ supplierId: s.id })}
            >
              Use <b>{s.name}</b>
              {s.contact ? ` · ${s.contact}` : ""}
            </button>
          ))}
        </div>
        {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-red-700">{error}</p>}
      </Dialog>
    );
  }

  const label = "block text-xs font-medium text-neutral-600";
  return (
    <Dialog
      title="Who do we buy this from?"
      onCancel={onCancel}
      actions={
        <>
          <button type="button" className={buttonClass.ghost} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={buttonClass.primary}
            disabled={busy || supplierList === null}
            onClick={() => save()}
          >
            {busy ? "Saving…" : "Save and add to order"}
          </button>
        </>
      }
    >
      <p>
        <b>{product.name}</b> ({product.code}) has no supplier yet. Tell us once and it&apos;s
        remembered on the product for everyone.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <fieldset>
          <legend className={label}>Supplier</legend>
          <div className="mt-1 inline-flex rounded-xl border border-neutral-300 p-0.5">
            {(["existing", "new"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`h-9 rounded-lg px-3 text-sm ${mode === m ? "bg-accent-600 font-semibold text-white" : "text-neutral-700"}`}
              >
                {m === "existing" ? "On file" : "+ New supplier"}
              </button>
            ))}
          </div>
          {mode === "existing" ? (
            <SupplierSearch
              suppliers={supplierList}
              text={supplierText}
              pickedId={supplierId}
              onType={(text) => {
                setSupplierText(text);
                setSupplierId(null);
              }}
              onPick={(s) => {
                setSupplierText(s.name);
                setSupplierId(s.id);
                setError(null);
              }}
              onNew={(name) => startNewSupplier(name, false)}
            />
          ) : (
            <div className="mt-2 flex flex-col gap-2">
              <input
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setError(null);
                }}
                placeholder="Supplier name"
                aria-label="New supplier name"
                className={inputClass}
              />
              <div className="flex gap-2">
                <input
                  value={newContact}
                  onChange={(e) => setNewContact(e.target.value)}
                  placeholder="Contact name (optional)"
                  aria-label="Contact name"
                  className={`${inputClass} min-w-0 flex-1`}
                />
                <input
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  type="email"
                  placeholder="Email (optional)"
                  aria-label="Email"
                  className={`${inputClass} min-w-0 flex-1`}
                />
              </div>
              <p className="text-xs text-neutral-500">
                Checked against the suppliers on file first — “Fra Di” finds “Fra-Di”.
              </p>
            </div>
          )}
        </fieldset>

        <label className={label}>
          Purchase pack, as printed on the invoice
          <input
            value={pack}
            onChange={(e) => setPack(e.target.value)}
            placeholder="e.g. 6 X 2.84L"
            className={`${inputClass} mt-1 w-full`}
          />
        </label>

        <div className="flex gap-2">
          <label className={`${label} flex-1`}>
            Bought in
            <select
              value={purchaseUnit}
              onChange={(e) => {
                setPurchaseUnit(e.target.value);
                if (!lineUnitTouched) setLineUnit(e.target.value);
              }}
              className={`${inputClass} mt-1 w-full`}
            >
              <option value="">Choose…</option>
              {PURCHASE_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
          <label className={`${label} flex-1`}>
            Supplier code (optional)
            <input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className={`${inputClass} mt-1 w-full`}
            />
          </label>
        </div>

        <div className="rounded-xl bg-neutral-50 p-3">
          <span className={label}>Then add to the order</span>
          <div className="mt-1 flex gap-2">
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              inputMode="decimal"
              aria-label="Quantity to order"
              className={`${inputClass} w-20 text-right`}
            />
            <select
              value={lineUnit}
              onChange={(e) => {
                setLineUnit(e.target.value);
                setLineUnitTouched(true);
              }}
              aria-label="Unit to order"
              className={`${inputClass} w-28`}
            >
              <option value="">Unit…</option>
              {PURCHASE_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-red-700">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}

/** Type-to-search over the suppliers on file; nothing is created from here. */
function SupplierSearch({
  suppliers,
  text,
  pickedId,
  onType,
  onPick,
  onNew,
}: {
  suppliers: SupplierOption[] | null;
  text: string;
  pickedId: number | null;
  onType: (text: string) => void;
  onPick: (supplier: SupplierOption) => void;
  onNew: (name: string) => void;
}) {
  const typed = text.trim();
  const matches =
    suppliers && typed && pickedId === null
      ? suppliers.filter((s) => matchesQuery(typed, [s.name])).slice(0, 8)
      : [];

  return (
    <div className="mt-2">
      <input
        value={text}
        onChange={(e) => onType(e.target.value)}
        type="search"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Supplier on file"
        placeholder={suppliers === null ? "Loading suppliers…" : "Type the supplier's name…"}
        className={`${inputClass} w-full`}
      />
      {pickedId !== null && (
        <p className="mt-1 text-xs font-medium text-green-700">✓ On file</p>
      )}
      {typed && pickedId === null && suppliers !== null && (
        <div className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-neutral-200">
          {matches.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onPick(s)}
              className="block w-full border-b border-neutral-100 px-3 py-2 text-left text-sm last:border-b-0 active:bg-accent-50"
            >
              <b>{s.name}</b>
              {s.contact && <span className="text-neutral-500"> · {s.contact}</span>}
            </button>
          ))}
          {matches.length === 0 && (
            <p className="px-3 py-2 text-sm text-neutral-500">
              No supplier on file matches “{typed}”.
            </p>
          )}
          <button
            type="button"
            onClick={() => onNew(typed)}
            className="block w-full border-t border-neutral-100 px-3 py-2 text-left text-sm font-medium text-accent-700 active:bg-accent-50"
          >
            + Add “{typed}” as a new supplier
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create a catalogue product (spec §5 e)
// ---------------------------------------------------------------------------

export function CreateProductDialog({
  typed,
  onCancel,
  onUse,
}: {
  typed: string;
  onCancel: () => void;
  onUse: (product: PurchaseHit) => void;
}) {
  const [code, setCode] = useState("");
  const [description, setDescription] = useState(typed);
  const [section, setSection] = useState("");
  const [sections, setSections] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Exclude<
    CreateProductResult,
    { status: "created" | "ask" | "error" }
  > | null>(null);

  useEffect(() => {
    let live = true;
    listPurchaseSections()
      .then((list) => live && setSections(list))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  async function save(confirmSimilar = false) {
    setError(null);
    setBusy(true);
    try {
      const result = await createCatalogProduct({ code, description, section, confirmSimilar });
      if (result.status === "created") onUse(result.product);
      else if (result.status === "ask" || result.status === "error") setError(result.message);
      else setConflict(result);
    } catch {
      setError("That didn't save. Nothing was created — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (conflict) {
    const products = conflict.status === "code-taken" ? [conflict.product] : conflict.products;
    const title =
      conflict.status === "code-taken"
        ? "That code is already in use"
        : conflict.status === "duplicate"
          ? "Already in the catalogue"
          : "Is it one of these?";
    return (
      <Dialog
        title={title}
        onCancel={() => setConflict(null)}
        actions={
          <>
            <button type="button" className={buttonClass.ghost} onClick={() => setConflict(null)}>
              Back
            </button>
            {conflict.status === "similar" && (
              <button
                type="button"
                className={buttonClass.primary}
                disabled={busy}
                onClick={() => {
                  setConflict(null);
                  save(true);
                }}
              >
                It&apos;s a different product — create it
              </button>
            )}
          </>
        }
      >
        <p>
          {conflict.status === "code-taken"
            ? `The code ${code.trim()} belongs to this product:`
            : conflict.status === "duplicate"
              ? "This product is already in the catalogue under the same name. Use it instead of creating a second entry:"
              : "The catalogue has products with a very similar name. A different pack or size is a different product; the same item written differently is not."}
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {products.map((p) => (
            <button key={p.code} type="button" className={buttonClass.choice} onClick={() => onUse(p)}>
              <HitLabel hit={p} />
            </button>
          ))}
        </div>
      </Dialog>
    );
  }

  const label = "block text-xs font-medium text-neutral-600";
  return (
    <Dialog
      title="New catalogue product"
      onCancel={onCancel}
      actions={
        <>
          <button type="button" className={buttonClass.ghost} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={buttonClass.primary} disabled={busy} onClick={() => save()}>
            {busy ? "Creating…" : "Create product"}
          </button>
        </>
      }
    >
      <p>Everything here is typed by you — nothing is looked up or filled in.</p>
      <div className="mt-3 flex flex-col gap-3">
        <label className={label}>
          Description
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${inputClass} mt-1 w-full`}
          />
        </label>
        <div className="flex gap-2">
          <label className={`${label} flex-1`}>
            Product code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className={`${inputClass} mt-1 w-full`}
            />
          </label>
          <label className={`${label} flex-1`}>
            Section
            <input
              value={section}
              onChange={(e) => setSection(e.target.value)}
              list="purchase-sections"
              className={`${inputClass} mt-1 w-full`}
            />
            <datalist id="purchase-sections">
              {sections.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
        </div>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-red-700">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
