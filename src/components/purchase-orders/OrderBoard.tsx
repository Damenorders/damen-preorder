"use client";

// Next orders per supplier and the order History — the Order Book's "Next
// order" and "History" tabs. Supplier sections start collapsed. Every change is
// a small server action on one row, and a teammate's change arrives over the
// purchase-orders live channel.

import { useState } from "react";
import {
  markOrderOrdered,
  removeOrderLine,
  setLineQty,
  setOrderMethod,
  setOrderWantedFor,
  setSupplierContact,
  undoOrderOrdered,
} from "@/app/actions/purchase-orders";
import {
  formatCopyOrder,
  formatLongDate,
  formatQty,
} from "@/lib/order-book-core";
import type { OrderLineView, OrderView } from "@/lib/purchase-order-types";
import Dialog, { buttonClass } from "./Dialog";
import { useFoldState } from "./foldState";

/** Today in Montreal, YYYY-MM-DD — the date Mark as ordered will stamp. */
function todayMontreal(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Montreal" });
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

type Pending =
  | { kind: "mark"; order: OrderView }
  | { kind: "undo"; order: OrderView; openLines: number; note?: string }
  | { kind: "copy-text"; text: string }
  | null;

export default function OrderBoard({
  view,
  open,
  history,
}: {
  /** The Next order tab or the History tab. */
  view: "order" | "history";
  open: OrderView[];
  history: OrderView[];
}) {
  // Its own fold state: folding here never folds the Suppliers tab.
  const folds = useFoldState("po.orders.opened");
  const { opened, toggle } = folds;
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);


  async function run(task: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    try {
      const result = await task();
      if (!result.ok) setError(result.error ?? "That didn't save.");
      return result.ok;
    } catch {
      setError("That didn't save. Check your connection and try again.");
      return false;
    }
  }

  async function copy(text: string, done: () => void) {
    try {
      await navigator.clipboard.writeText(text);
      done();
      return;
    } catch {
      // Fall through to the older route, then to a dialog.
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    if (ok) done();
    else setPending({ kind: "copy-text", text });
  }

  async function confirmMark(order: OrderView) {
    setBusy(true);
    const ok = await run(async () => {
      const result = await markOrderOrdered(order.id, order.lines.length);
      if (result.ok) {
        setNotice(`${result.supplierName} moved to History, dated ${result.date}.`);
      }
      return result;
    });
    setBusy(false);
    setPending(null);
    if (!ok) setNotice(null);
  }

  async function confirmUndo(order: OrderView, openLines: number) {
    setBusy(true);
    setError(null);
    try {
      const result = await undoOrderOrdered(order.id, openLines);
      if (result.ok) {
        setPending(null);
        setNotice(`${result.supplierName} is back on the next order.`);
        folds.open(`ord:${order.supplierId}`);
      } else if (result.openLines !== undefined) {
        // The open order changed under us: warn again with the real count.
        setPending({ kind: "undo", order, openLines: result.openLines, note: result.error });
      } else {
        setPending(null);
        setError(result.error);
      }
    } catch {
      setPending(null);
      setError("That didn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const openLinesBySupplier = new Map(open.map((o) => [o.supplierId, o.lines.length]));

  return (
    <div className="flex flex-col gap-6">
      {(error || notice) && (
        <div className="sticky top-2 z-10">
          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 shadow-sm">
              {error}
            </p>
          )}
          {notice && !error && (
            <p role="status" className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800 shadow-sm">
              {notice}
            </p>
          )}
        </div>
      )}

      {view === "order" && (
      <section>
        <h2 className="text-base font-semibold">Next orders</h2>
        {open.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-neutral-300 px-3 py-6 text-center text-sm text-neutral-500">
            Nothing on the next order yet. Add the first line above.
          </p>
        ) : (
          <div className="mt-2 flex flex-col gap-3">
            {open.map((order) => {
              const key = `ord:${order.supplierId}`;
              const isOpen = !!opened[key];
              return (
                <section key={order.id} className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left"
                  >
                    <span className="w-4 text-neutral-400">{isOpen ? "▾" : "▸"}</span>
                    <span className="flex-1 font-semibold">{order.supplierName}</span>
                    <span className="text-xs text-neutral-500">
                      {plural(order.lines.length, "line")}
                      {" · "}
                      {order.method}
                      {order.wantedFor ? ` ${formatLongDate(order.wantedFor)}` : ""}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-neutral-100 px-4 pb-4 pt-3">
                      <ContactRow order={order} run={run} />
                      <MetaRow order={order} run={run} />
                      <ul className="mt-3 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
                        {order.lines.map((line) => (
                          <OpenLine key={line.id} line={line} run={run} />
                        ))}
                      </ul>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <CopyButton
                          onCopy={(done) => copy(formatCopyOrder({ ...order }), done)}
                        />
                        <button
                          type="button"
                          className={buttonClass.primary}
                          onClick={() => setPending({ kind: "mark", order })}
                        >
                          Mark {order.supplierName} as ordered
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </section>
      )}

      {view === "history" && (
      <section>
        <h2 className="text-base font-semibold">History</h2>
        {history.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-neutral-300 px-3 py-6 text-center text-sm text-neutral-500">
            No orders in the history yet. When you mark an order as ordered, it lands here with the date.
          </p>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            {history.map((order) => {
              const key = `hist:${order.id}`;
              const isOpen = !!opened[key];
              return (
                <div key={order.id} className="rounded-xl border border-neutral-200 bg-white">
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    aria-expanded={isOpen}
                    className="flex w-full flex-wrap items-baseline gap-x-2 px-3 py-2 text-left"
                  >
                    <span className="font-medium">{order.supplierName}</span>
                    <span className="text-xs text-neutral-500">
                      {order.orderedOn}
                      {order.wantedFor ? ` · ${order.method} ${order.wantedFor}` : ""}
                      {order.orderedByName ? ` · ${order.orderedByName}` : ""}
                    </span>
                    <span className="ml-auto text-xs text-neutral-500">
                      {plural(order.lines.length, "line")} {isOpen ? "▾" : "▸"}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-neutral-100 px-3 pb-3 pt-2">
                      <ul className="text-sm">
                        {order.lines.map((l) => (
                          <li key={l.id} className="flex gap-2 py-0.5">
                            <b className="w-12 shrink-0 text-right">{formatQty(l.qty)}</b>
                            <span className="w-14 shrink-0 text-neutral-500">{l.unit}</span>
                            <span className="min-w-0">
                              {l.nameAtTime}
                              {l.packAtTime && (
                                <span className="text-neutral-500"> {l.packAtTime}</span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <CopyButton onCopy={(done) => copy(formatCopyOrder(order), done)} />
                        <button
                          type="button"
                          className={buttonClass.ghost}
                          onClick={() =>
                            setPending({
                              kind: "undo",
                              order,
                              openLines: openLinesBySupplier.get(order.supplierId) ?? 0,
                            })
                          }
                        >
                          Undo — put back on next order
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
      )}

      <p className="text-xs text-neutral-500">
        Everything here is typed in by hand. Nothing is looked up or filled in automatically.
      </p>

      {pending?.kind === "mark" && (
        <Dialog
          title="Mark as ordered"
          onCancel={() => !busy && setPending(null)}
          actions={
            <>
              <button type="button" className={buttonClass.ghost} disabled={busy} onClick={() => setPending(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={buttonClass.primary}
                disabled={busy}
                data-autofocus
                onClick={() => confirmMark(pending.order)}
              >
                {busy ? "Saving…" : "Yes, it's ordered"}
              </button>
            </>
          }
        >
          <p>
            Move {plural(pending.order.lines.length, "line")} for {pending.order.supplierName} into
            History, dated {todayMontreal()}? {pending.order.supplierName}&apos;s next order will be
            emptied.
          </p>
        </Dialog>
      )}

      {pending?.kind === "undo" && (
        <Dialog
          title="Undo this order"
          onCancel={() => !busy && setPending(null)}
          actions={
            <>
              <button type="button" className={buttonClass.ghost} disabled={busy} onClick={() => setPending(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={buttonClass.primary}
                disabled={busy}
                data-autofocus
                onClick={() => confirmUndo(pending.order, pending.openLines)}
              >
                {busy ? "Saving…" : "Put back on order"}
              </button>
            </>
          }
        >
          {pending.note && (
            <p className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-amber-800">{pending.note}</p>
          )}
          <p>
            Put {plural(pending.order.lines.length, "line")} from {pending.order.supplierName} (
            {pending.order.orderedOn}) back on the next order
            {pending.openLines > 0 ? (
              <>
                , <b>merging with the {plural(pending.openLines, "line")} already open for{" "}
                {pending.order.supplierName}</b>.
              </>
            ) : (
              "."
            )}{" "}
            It will be removed from History.
          </p>
        </Dialog>
      )}

      {pending?.kind === "copy-text" && (
        <Dialog
          title="Copy the order"
          onCancel={() => setPending(null)}
          actions={
            <button type="button" className={buttonClass.primary} onClick={() => setPending(null)}>
              Done
            </button>
          }
        >
          <p>Select the text below and copy it.</p>
          <textarea
            readOnly
            rows={9}
            value={pending.text}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-2 w-full rounded-xl border border-neutral-300 p-2 font-mono text-xs"
          />
        </Dialog>
      )}
    </div>
  );
}

type Run = (task: () => Promise<{ ok: boolean; error?: string }>) => Promise<boolean>;

function CopyButton({ onCopy }: { onCopy: (done: () => void) => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass.ghost}
      onClick={() =>
        onCopy(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        })
      }
    >
      {copied ? "Copied" : "Copy order"}
    </button>
  );
}

function ContactRow({ order, run }: { order: OrderView; run: Run }) {
  const [contact, setContact] = useState(order.contact);
  const [email, setEmail] = useState(order.email);

  // Follow the server when someone else edits the supplier.
  const [last, setLast] = useState({ contact: order.contact, email: order.email });
  if (last.contact !== order.contact || last.email !== order.email) {
    setLast({ contact: order.contact, email: order.email });
    setContact(order.contact);
    setEmail(order.email);
  }

  const box = "h-10 min-w-0 flex-1 rounded-lg border border-neutral-300 px-2 text-base";
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-neutral-500">Order to</span>
      <input
        value={contact}
        placeholder="Contact name"
        aria-label={`Contact at ${order.supplierName}`}
        onChange={(e) => setContact(e.target.value)}
        onBlur={() => {
          if (contact.trim() !== order.contact) {
            run(() => setSupplierContact(order.supplierId, "contact", contact));
          }
        }}
        className={box}
      />
      <input
        value={email}
        type="email"
        placeholder="Email"
        aria-label={`Email for ${order.supplierName}`}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={() => {
          if (email.trim() !== order.email) {
            run(() => setSupplierContact(order.supplierId, "email", email));
          }
        }}
        className={box}
      />
    </div>
  );
}

function MetaRow({ order, run }: { order: OrderView; run: Run }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <span className="inline-flex rounded-lg border border-neutral-300 p-0.5">
        {(["delivery", "pickup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={order.method === m}
            onClick={() => order.method !== m && run(() => setOrderMethod(order.id, m))}
            className={`h-9 rounded-md px-3 capitalize ${order.method === m ? "bg-accent-600 font-semibold text-white" : "text-neutral-700"}`}
          >
            {m}
          </button>
        ))}
      </span>
      <label className="flex items-center gap-1">
        on
        <input
          type="date"
          value={order.wantedFor}
          aria-label={`Date wanted for ${order.supplierName}`}
          onChange={(e) => run(() => setOrderWantedFor(order.id, e.target.value))}
          className="h-9 rounded-lg border border-neutral-300 px-2 text-base"
        />
      </label>
      {!order.wantedFor && <span className="text-xs text-amber-700">no date set</span>}
    </div>
  );
}

function OpenLine({ line, run }: { line: OrderLineView; run: Run }) {
  const [text, setText] = useState(formatQty(line.qty));
  const [lastQty, setLastQty] = useState(line.qty);
  if (line.qty !== lastQty) {
    setLastQty(line.qty);
    setText(formatQty(line.qty));
  }

  return (
    <li className="flex items-center gap-2 px-2 py-2">
      <input
        value={text}
        inputMode="decimal"
        aria-label={`Quantity of ${line.nameAtTime}`}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        onBlur={async () => {
          if (text.trim() === formatQty(line.qty)) return;
          const ok = await run(() => setLineQty(line.id, text));
          if (!ok) setText(formatQty(line.qty));
        }}
        className="h-10 w-16 shrink-0 rounded-lg border border-neutral-300 px-2 text-right text-base"
      />
      <span className="w-12 shrink-0 text-sm text-neutral-500">{line.unit}</span>
      <span className="min-w-0 flex-1 text-sm">
        {line.nameAtTime}
        {line.packAtTime && <span className="block text-xs text-neutral-500">{line.packAtTime}</span>}
      </span>
      <button
        type="button"
        aria-label={`Remove ${line.nameAtTime}`}
        onClick={() => run(() => removeOrderLine(line.id))}
        className="h-10 w-10 shrink-0 rounded-lg text-lg text-neutral-400 active:bg-neutral-100"
      >
        ×
      </button>
    </li>
  );
}
