"use client";

// The Suppliers tab (SUPPLIERS-TAB-SPEC.md): every supplier, every product we
// buy from it, cost, sell and the margin between. It maintains the sourcing
// data the Buyer card uses; nothing here adds to an order. Every edit is one
// server action on one row, and teammates' edits arrive over the live channel.

import { useEffect, useRef, useState } from "react";
import {
  addSupplierByName,
  addSupplierProduct,
  editSupplierProduct,
  removeSupplierProduct,
  searchPurchaseCatalog,
  setSourcingPrice,
  setSupplierContact,
} from "@/app/actions/purchase-orders";
import {
  PURCHASE_UNITS,
  computeMargin,
  showAddForms,
  viewSuppliers,
  type SupplierBlock,
  type SupplierProduct,
  type SupplierView,
} from "@/lib/order-book-core";
import type {
  AddSupplierProductResult,
  OtherSupplierLink,
  PurchaseHit,
  SupplierOption,
} from "@/lib/purchase-order-types";
import { formatMoney } from "@/lib/money";
import Dialog, { buttonClass } from "./Dialog";
import { CreateProductDialog, HitLabel, inputClass } from "./AddLineCard";
import { useFoldState } from "./foldState";

type Notify = (message: string, kind?: "ok" | "error") => void;

const cell = "h-10 rounded-lg border border-neutral-300 px-2 text-base";

export default function SuppliersView({
  suppliers,
  canEdit,
}: {
  suppliers: SupplierBlock[];
  canEdit: boolean;
}) {
  // Search lives in component state, so leaving the tab clears it.
  const [query, setQuery] = useState("");
  const folds = useFoldState("po.suppliers.opened");
  const [message, setMessage] = useState<{ text: string; kind: "ok" | "error" } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const view = viewSuppliers(suppliers, query, folds.opened);
  const adding = showAddForms(canEdit, view.searching);

  const notify: Notify = (text, kind = "ok") => setMessage({ text, kind });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="search"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Search products across all suppliers"
          aria-label="Search products"
          className={`${inputClass} min-w-0 flex-1`}
        />
        {view.searching && (
          <button
            type="button"
            className={buttonClass.ghost}
            onClick={() => {
              setQuery("");
              searchRef.current?.focus();
            }}
          >
            Clear
          </button>
        )}
      </div>

      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={`sticky top-2 z-10 rounded-xl px-3 py-2 text-sm shadow-sm ${
            message.kind === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"
          }`}
        >
          {message.text}
        </p>
      )}

      {suppliers.length === 0 && (
        <p className="rounded-xl border border-dashed border-neutral-300 px-3 py-6 text-center text-sm text-neutral-500">
          No suppliers yet. Add one below.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {view.rows.map((row) => (
          <SupplierSection
            key={row.supplier.id}
            row={row}
            canEdit={canEdit}
            adding={adding}
            onToggle={() => folds.toggle(`sup:${row.supplier.id}`)}
            notify={notify}
          />
        ))}
      </div>

      {view.searching &&
        (view.rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-300 px-3 py-6 text-center text-sm text-neutral-500">
            Nothing matches “{query.trim()}”.
          </p>
        ) : (
          <p className="text-sm text-neutral-500">{view.total}.</p>
        ))}

      {adding && (
        <AddSupplierForm
          notify={notify}
          onOpen={(id) => folds.open(`sup:${id}`)}
        />
      )}

      <p className="text-xs text-neutral-500">
        Everything here is typed in by hand. Nothing is looked up or filled in automatically.
        Cost and sell are per purchase pack.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One supplier
// ---------------------------------------------------------------------------

function SupplierSection({
  row,
  canEdit,
  adding,
  onToggle,
  notify,
}: {
  row: SupplierView;
  canEdit: boolean;
  adding: boolean;
  onToggle: () => void;
  notify: Notify;
}) {
  const { supplier, products, expanded } = row;
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <span className="w-4 text-neutral-400">{expanded ? "▾" : "▸"}</span>
        <span className="flex-1 font-semibold">{supplier.name}</span>
        <span className="text-xs text-neutral-500">{row.countLabel}</span>
      </button>
      {expanded && (
        <div className="border-t border-neutral-100 px-4 pb-4 pt-3">
          <ContactRow supplier={supplier} canEdit={canEdit} notify={notify} />

          {products.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">No products recorded for this supplier.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-neutral-500">
                    <th className="pb-1 font-medium">Product</th>
                    <th className="pb-1 text-right font-medium">Cost</th>
                    <th className="pb-1 text-right font-medium">Sell</th>
                    <th className="pb-1 text-right font-medium">Margin</th>
                    <th className="pb-1 text-right font-medium">Cost set</th>
                    {canEdit && <th />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {products.map((p) => (
                    <ProductRow
                      key={p.sourcingId}
                      product={p}
                      supplierName={supplier.name}
                      canEdit={canEdit}
                      notify={notify}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {adding && <AddProductForm supplier={supplier} notify={notify} />}
        </div>
      )}
    </section>
  );
}

function ContactRow({
  supplier,
  canEdit,
  notify,
}: {
  supplier: SupplierBlock;
  canEdit: boolean;
  notify: Notify;
}) {
  const [contact, setContact] = useState(supplier.contact);
  const [email, setEmail] = useState(supplier.email);
  const [last, setLast] = useState({ contact: supplier.contact, email: supplier.email });
  if (last.contact !== supplier.contact || last.email !== supplier.email) {
    setLast({ contact: supplier.contact, email: supplier.email });
    setContact(supplier.contact);
    setEmail(supplier.email);
  }

  if (!canEdit) {
    if (!supplier.contact && !supplier.email) return null;
    return (
      <p className="text-sm text-neutral-600">
        Order to {supplier.contact || "—"}
        {supplier.email && (
          <>
            {" · "}
            <a href={`mailto:${supplier.email}`} className="text-accent-700 underline">
              {supplier.email}
            </a>
          </>
        )}
      </p>
    );
  }

  async function save(field: "contact" | "email", value: string, current: string) {
    if (value.trim() === current) return;
    try {
      const result = await setSupplierContact(supplier.id, field, value);
      if (!result.ok) notify(result.error, "error");
    } catch {
      notify("That didn't save. Check your connection and try again.", "error");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-neutral-500">Order to</span>
      <input
        value={contact}
        placeholder="Contact name"
        aria-label={`Contact at ${supplier.name}`}
        onChange={(e) => setContact(e.target.value)}
        onBlur={() => save("contact", contact, supplier.contact)}
        className={`${cell} min-w-0 flex-1`}
      />
      <input
        value={email}
        type="email"
        placeholder="Email"
        aria-label={`Email for ${supplier.name}`}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={() => save("email", email, supplier.email)}
        className={`${cell} min-w-0 flex-1`}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// One product row
// ---------------------------------------------------------------------------

function priceText(value: number | null) {
  return value === null ? "" : String(value);
}

function ProductRow({
  product: p,
  supplierName,
  canEdit,
  notify,
}: {
  product: SupplierProduct;
  supplierName: string;
  canEdit: boolean;
  notify: Notify;
}) {
  const [name, setName] = useState(p.name);
  const [pack, setPack] = useState(p.pack);
  const [cost, setCost] = useState(priceText(p.cost));
  const [sell, setSell] = useState(priceText(p.sell));
  const [removing, setRemoving] = useState<null | { others: OtherSupplierLink[] | null; promote: string }>(null);
  const [busy, setBusy] = useState(false);

  // Follow the server when a save lands or a teammate edits this row.
  const [last, setLast] = useState(p);
  if (last !== p) {
    setLast(p);
    if (p.name !== last.name) setName(p.name);
    if (p.pack !== last.pack) setPack(p.pack);
    if (p.cost !== last.cost) setCost(priceText(p.cost));
    if (p.sell !== last.sell) setSell(priceText(p.sell));
  }

  const margin = computeMargin(p.cost, p.sell);
  const marginCell = (
    <td className="py-2 text-right align-top">
      {margin ? (
        <span className={margin.thin ? "font-semibold text-red-700" : "text-neutral-800"}>
          {margin.pct}%
          <span className="block text-xs text-neutral-500">{formatMoney(margin.diff)}</span>
        </span>
      ) : (
        <span className="text-neutral-400">—</span>
      )}
    </td>
  );
  const costSetCell = (
    <td className="py-2 text-right align-top text-xs text-neutral-500">{p.costSetOn ?? "—"}</td>
  );
  const marker = !p.preferred && (
    <span className="block text-xs text-amber-700">
      Another supplier is the Buyer card&apos;s choice for this product
    </span>
  );

  if (!canEdit) {
    return (
      <tr>
        <td className="py-2 align-top">
          {p.name}
          <span className="block text-xs text-neutral-500">
            {p.pack} · {p.unit}
          </span>
          {marker}
        </td>
        <td className="py-2 text-right align-top">{formatMoney(p.cost)}</td>
        <td className="py-2 text-right align-top">{formatMoney(p.sell)}</td>
        {marginCell}
        {costSetCell}
      </tr>
    );
  }

  async function commitEdit() {
    const nextName = name.trim();
    const nextPack = pack.trim();
    if (nextName === p.name && nextPack === p.pack) return;
    try {
      const result = await editSupplierProduct(p.sourcingId, { name: nextName, pack: nextPack });
      if (!result.ok) {
        setName(p.name);
        setPack(p.pack);
        notify(result.error, "error");
        return;
      }
      const moved =
        result.openLinesUpdated > 0
          ? ` Also updated ${result.openLinesUpdated} line${result.openLinesUpdated === 1 ? "" : "s"} on the next order.`
          : "";
      notify(`Saved.${moved}${result.note ? ` ${result.note}` : ""}`);
    } catch {
      setName(p.name);
      setPack(p.pack);
      notify("That didn't save. Check your connection and try again.", "error");
    }
  }

  async function commitPrice(field: "cost" | "sell", text: string) {
    const current = field === "cost" ? p.cost : p.sell;
    if (text.trim() === priceText(current)) return;
    const revert = () => (field === "cost" ? setCost(priceText(p.cost)) : setSell(priceText(p.sell)));
    try {
      const result = await setSourcingPrice(p.sourcingId, field, text);
      if (!result.ok) {
        revert();
        notify(result.error, "error");
      }
    } catch {
      revert();
      notify("That didn't save. Check your connection and try again.", "error");
    }
  }

  async function remove(promote: string | null) {
    setBusy(true);
    try {
      const result = await removeSupplierProduct(p.sourcingId, promote);
      if (result.ok) {
        setRemoving(null);
        notify(`${p.name} removed from ${supplierName}. It stays in the catalogue; past orders are unchanged.`);
      } else if ("choosePreferred" in result) {
        setRemoving({ others: result.choosePreferred, promote: "" });
      } else {
        setRemoving(null);
        notify(result.error, "error");
      }
    } catch {
      notify("That didn't save. Check your connection and try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  const blurOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.currentTarget.blur();
  };

  return (
    <tr>
      <td className="py-2 pr-2 align-top">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={blurOnEnter}
          aria-label={`Name of ${p.name}`}
          className={`${cell} w-full font-medium`}
        />
        <span className="mt-1 flex items-center gap-2">
          <input
            value={pack}
            onChange={(e) => setPack(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={blurOnEnter}
            placeholder="pack size"
            aria-label={`Pack size of ${p.name}`}
            className={`${cell} min-w-0 flex-1 text-sm`}
          />
          <span className="shrink-0 text-xs text-neutral-500">{p.unit}</span>
        </span>
        {marker}
      </td>
      <td className="py-2 pl-1 text-right align-top">
        <input
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          onBlur={() => commitPrice("cost", cost)}
          onKeyDown={blurOnEnter}
          inputMode="decimal"
          placeholder="—"
          aria-label={`Cost for ${p.name}`}
          className={`${cell} w-24 text-right`}
        />
      </td>
      <td className="py-2 pl-1 text-right align-top">
        <input
          value={sell}
          onChange={(e) => setSell(e.target.value)}
          onBlur={() => commitPrice("sell", sell)}
          onKeyDown={blurOnEnter}
          inputMode="decimal"
          placeholder="—"
          aria-label={`Sell for ${p.name}`}
          className={`${cell} w-24 text-right`}
        />
      </td>
      {marginCell}
      {costSetCell}
      <td className="py-2 pl-1 text-right align-top">
        <button
          type="button"
          aria-label={`Remove ${p.name}`}
          onClick={() => setRemoving({ others: null, promote: "" })}
          className="h-10 w-10 rounded-lg text-lg text-neutral-400 active:bg-neutral-100"
        >
          ×
        </button>
        {removing && (
          <Dialog
            title="Remove product"
            onCancel={() => !busy && setRemoving(null)}
            actions={
              <>
                <button type="button" className={buttonClass.ghost} disabled={busy} onClick={() => setRemoving(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={buttonClass.primary}
                  disabled={busy || (removing.others !== null && !removing.promote)}
                  onClick={() => remove(removing.others ? removing.promote : null)}
                >
                  {busy ? "Removing…" : "Remove"}
                </button>
              </>
            }
          >
            <p className="text-left">
              Remove {p.name} ({p.pack}) from {supplierName}? This only affects the supplier list —
              the product stays in the catalogue, and past orders are unaffected.
            </p>
            {removing.others && (
              <fieldset className="mt-3 text-left">
                <legend className="font-medium">
                  {supplierName} is the Buyer card&apos;s supplier for this product. Which one should it
                  use from now on?
                </legend>
                {removing.others.map((o) => (
                  <label key={o.sourcingId} className="mt-2 flex items-center gap-2">
                    <input
                      type="radio"
                      name={`promote-${p.sourcingId}`}
                      checked={removing.promote === o.sourcingId}
                      onChange={() => setRemoving({ ...removing, promote: o.sourcingId })}
                    />
                    {o.supplierName} · {o.pack}
                  </label>
                ))}
              </fieldset>
            )}
          </Dialog>
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Add a product to a supplier
// ---------------------------------------------------------------------------

type AddDialog =
  | { kind: "similar"; existing: SupplierProduct }
  | { kind: "pack-conflict"; existing: SupplierProduct }
  | { kind: "pick"; products: PurchaseHit[]; near: boolean }
  | { kind: "create"; typed: string }
  | null;

function AddProductForm({
  supplier,
  notify,
}: {
  supplier: SupplierBlock;
  notify: Notify;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<PurchaseHit | null>(null);
  const [pack, setPack] = useState("");
  const [unit, setUnit] = useState("");
  const [cost, setCost] = useState("");
  const [sell, setSell] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<AddDialog>(null);

  const trimmed = query.trim();
  const [found, setFound] = useState<{ query: string; hits: PurchaseHit[] }>({ query: "", hits: [] });
  const showSuggestions = trimmed.length >= 2 && !(picked && picked.name === query);
  const results = found.query === trimmed ? found.hits : [];
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

  function reset() {
    setQuery("");
    setPicked(null);
    setPack("");
    setUnit("");
    setCost("");
    setSell("");
    setDialog(null);
  }

  async function submit(opts: {
    itemCode?: string;
    decision?: { kind: "same"; sourcingId: string } | { kind: "separate" };
  } = {}) {
    setError(null);
    setBusy(true);
    let result: AddSupplierProductResult;
    try {
      result = await addSupplierProduct({
        supplierId: supplier.id,
        itemCode: opts.itemCode ?? picked?.code ?? null,
        typed: query,
        pack,
        unit,
        cost,
        sell,
        decision: opts.decision ?? null,
      });
    } catch {
      setError("That didn't save. Check your connection and try again.");
      setBusy(false);
      return;
    }
    setBusy(false);

    switch (result.status) {
      case "added":
        notify(
          `${result.name} (${result.pack}) added to ${supplier.name}.` +
            (result.preferred ? "" : " Another supplier stays the Buyer card's choice for it."),
        );
        reset();
        return;
      case "updated":
        notify(`Updated the existing entry for ${result.name} (${result.pack}).`);
        reset();
        return;
      case "ask":
      case "error":
        setDialog(null);
        setError(result.message);
        return;
      case "similar":
      case "pack-conflict":
        setDialog({ kind: result.status, existing: result.existing });
        return;
      case "choose":
      case "similar-catalogue":
        setDialog({ kind: "pick", products: result.products, near: result.status === "similar-catalogue" });
        return;
      case "none":
        setDialog({ kind: "create", typed: result.typed });
        return;
    }
  }

  function pickAndAdd(hit: PurchaseHit) {
    setPicked(hit);
    setQuery(hit.name);
    submit({ itemCode: hit.code });
  }

  return (
    <div className="mt-3 rounded-xl bg-neutral-50 p-3">
      <form
        className="flex flex-wrap items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) submit();
        }}
      >
        <div className="relative min-w-[14rem] flex-[3]">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (picked) setPicked(null);
            }}
            type="search"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Product (from the catalogue)"
            aria-label={`Product to add to ${supplier.name}`}
            className={`${cell} w-full`}
          />
          {showSuggestions && results.length > 0 && (
            <div className="mt-1 max-h-64 overflow-y-auto rounded-xl border border-neutral-200 bg-white">
              {results.map((hit) => (
                <button
                  type="button"
                  key={hit.code}
                  onClick={() => {
                    setPicked(hit);
                    setQuery(hit.name);
                  }}
                  className="block w-full border-b border-neutral-100 px-3 py-2 text-left last:border-b-0 active:bg-accent-50"
                >
                  <HitLabel hit={hit} />
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          value={pack}
          onChange={(e) => setPack(e.target.value)}
          placeholder="Pack size"
          aria-label="Pack size"
          className={`${cell} w-32`}
        />
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          aria-label="Bought in"
          className={`${cell} w-28`}
        >
          <option value="">Unit…</option>
          {PURCHASE_UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <input
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          inputMode="decimal"
          placeholder="Cost"
          aria-label="Cost"
          className={`${cell} w-20 text-right`}
        />
        <input
          value={sell}
          onChange={(e) => setSell(e.target.value)}
          inputMode="decimal"
          placeholder="Sell"
          aria-label="Sell"
          className={`${cell} w-20 text-right`}
        />
        <button type="submit" disabled={busy} className={buttonClass.ghost}>
          {busy ? "Adding…" : "Add product"}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {dialog?.kind === "similar" && (
        <Dialog
          title="Is this the same product?"
          onCancel={() => setDialog(null)}
          actions={
            <>
              <button
                type="button"
                className={buttonClass.ghost}
                disabled={busy}
                onClick={() => submit({ decision: { kind: "separate" } })}
              >
                Add separately
              </button>
              <button
                type="button"
                className={buttonClass.primary}
                disabled={busy}
                onClick={() =>
                  submit({ decision: { kind: "same", sourcingId: dialog.existing.sourcingId } })
                }
              >
                Same product
              </button>
            </>
          }
        >
          <p>
            {dialog.existing.name} ({dialog.existing.pack || "no pack size"}) is already on file for{" "}
            {supplier.name} at the same pack size.
          </p>
        </Dialog>
      )}

      {dialog?.kind === "pack-conflict" && (
        <Dialog
          title="Already on file at another pack"
          onCancel={() => setDialog(null)}
          actions={
            <button type="button" className={buttonClass.primary} onClick={() => setDialog(null)}>
              OK
            </button>
          }
        >
          <p>
            {dialog.existing.name} is already on file for {supplier.name} at {dialog.existing.pack}.
            A different pack is a different product: change the pack on that row if it was wrong,
            or pick the catalogue product for this pack instead. Nothing was added.
          </p>
        </Dialog>
      )}

      {dialog?.kind === "pick" && (
        <Dialog
          title={dialog.near ? "Did you mean one of these?" : "Which one?"}
          onCancel={() => setDialog(null)}
          actions={
            <button type="button" className={buttonClass.ghost} onClick={() => setDialog(null)}>
              {dialog.near ? "None of these" : "Cancel"}
            </button>
          }
        >
          <p>
            {dialog.near
              ? `Nothing in the catalogue matches “${trimmed}” exactly. The closest:`
              : `“${trimmed}” matches more than one catalogue product.`}
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {dialog.products.map((hit) => (
              <button
                key={hit.code}
                type="button"
                className={buttonClass.choice}
                disabled={busy}
                onClick={() => pickAndAdd(hit)}
              >
                <HitLabel hit={hit} />
              </button>
            ))}
          </div>
        </Dialog>
      )}

      {dialog?.kind === "create" && (
        <CreateProductDialog
          typed={dialog.typed}
          onCancel={() => setDialog(null)}
          onUse={pickAndAdd}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add a supplier
// ---------------------------------------------------------------------------

function AddSupplierForm({
  notify,
  onOpen,
}: {
  notify: Notify;
  onOpen: (supplierId: number) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [similar, setSimilar] = useState<{ typed: string; suppliers: SupplierOption[] } | null>(null);

  async function submit(confirmNew = false) {
    setBusy(true);
    try {
      const result = await addSupplierByName(name, confirmNew);
      switch (result.status) {
        case "created":
          notify(`${result.supplier.name} added. Fill in the contact on its row.`);
          onOpen(result.supplier.id);
          setName("");
          setSimilar(null);
          return;
        case "existing":
          notify(`${result.supplier.name} is already on file — opened it.`);
          onOpen(result.supplier.id);
          setName("");
          setSimilar(null);
          return;
        case "similar":
          setSimilar({ typed: result.typed, suppliers: result.suppliers });
          return;
        case "ask":
          notify(result.message, "error");
          return;
      }
    } catch {
      notify("That didn't save. Check your connection and try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4">
      <h3 className="text-sm font-semibold">Add a supplier</h3>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) submit();
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Supplier name"
          aria-label="New supplier name"
          className={`${inputClass} min-w-0 flex-1`}
        />
        <button type="submit" disabled={busy} className={buttonClass.primary}>
          Add supplier
        </button>
      </form>

      {similar && (
        <Dialog
          title="Is this a supplier we already have?"
          onCancel={() => setSimilar(null)}
          actions={
            <>
              <button type="button" className={buttonClass.ghost} onClick={() => setSimilar(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={buttonClass.primary}
                disabled={busy}
                onClick={() => submit(true)}
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
                onClick={() => {
                  onOpen(s.id);
                  notify(`Opened ${s.name}.`);
                  setName("");
                  setSimilar(null);
                }}
              >
                Use <b>{s.name}</b>
                {s.contact ? ` · ${s.contact}` : ""}
              </button>
            ))}
          </div>
        </Dialog>
      )}
    </section>
  );
}
