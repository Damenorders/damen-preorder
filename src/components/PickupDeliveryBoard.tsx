"use client";

// Pickups & Deliveries — active work up top, one card per date (closest date
// first) with that day's pending pickups then pending deliveries. Once a pickup
// is picked up (or a delivery delivered) it moves to the "Picked up /
// Delivered" box at the very bottom, so new days always stay at the top.
// Printing is pickups-only.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/dates";
import {
  deletePickup,
  setPickupStatus,
  setPickupDriver,
  markDayPickupsPickedUp,
} from "@/app/actions/pickups";
import {
  deleteDelivery,
  setDeliveryStatus,
  markDayDeliveriesDelivered,
} from "@/app/actions/deliveries";
import type { PickupStatus, DeliveryStatus } from "@/db/schema";

export interface PickupRow {
  id: number;
  supplierName: string;
  address: string;
  poNumber: string;
  pickupDate: string;
  amountOfStock: string;
  note: string | null;
  driver: string | null;
  status: PickupStatus;
  createdByName: string;
}

export interface DeliveryRow {
  id: number;
  supplierName: string;
  deliveryDate: string;
  status: DeliveryStatus;
  createdByName: string;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
        {label}
      </dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-neutral-800">
        {value || "—"}
      </dd>
    </div>
  );
}

// Inline driver edit for the expanded pickup card — saves on blur/Enter so a
// dispatcher can update the driver across many pickups without opening each one.
function DriverQuickEdit({
  pickupId,
  initial,
}: {
  pickupId: number;
  initial: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    if (saving || value.trim() === initial.trim()) return;
    setSaving(true);
    const res = await setPickupDriver(pickupId, value);
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
      window.setTimeout(() => setSaved(false), 1500);
    }
  }

  return (
    <span className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        placeholder="Edit driver"
        className="w-full max-w-xs rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm text-neutral-700 outline-none focus:border-accent-500"
      />
      {saving && <span className="text-[11px] text-neutral-400">Saving…</span>}
      {saved && !saving && (
        <span className="text-[11px] text-green-600">Saved</span>
      )}
    </span>
  );
}

function Badge({ tone, label }: { tone: "amber" | "sky" | "green"; label: string }) {
  const cls = {
    amber: "bg-amber-100 text-amber-700",
    sky: "bg-sky-100 text-sky-700",
    green: "bg-green-100 text-green-700",
  }[tone];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

const actionBtn =
  "rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:border-accent-600";

function uniqueSortedDates(...lists: string[][]): string[] {
  const set = new Set<string>();
  lists.forEach((l) => l.forEach((d) => set.add(d)));
  return Array.from(set).sort(); // YYYY-MM-DD sorts chronologically
}

export default function PickupDeliveryBoard({
  pickups,
  deliveries,
  canEditDriver = false,
}: {
  pickups: PickupRow[];
  deliveries: DeliveryRow[];
  /** Show the inline driver quick-edit in expanded pickup cards (dispatch). */
  canEditDriver?: boolean;
}) {
  const router = useRouter();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [menuDate, setMenuDate] = useState<string | null>(null);

  const activePickups = useMemo(
    () => pickups.filter((p) => p.status === "pending"),
    [pickups],
  );
  const activeDeliveries = useMemo(
    () => deliveries.filter((d) => d.status === "pending"),
    [deliveries],
  );
  const donePickups = useMemo(
    () => pickups.filter((p) => p.status === "picked_up"),
    [pickups],
  );
  const doneDeliveries = useMemo(
    () => deliveries.filter((d) => d.status === "delivered"),
    [deliveries],
  );

  const activeDates = useMemo(
    () =>
      uniqueSortedDates(
        activePickups.map((p) => p.pickupDate),
        activeDeliveries.map((d) => d.deliveryDate),
      ),
    [activePickups, activeDeliveries],
  );
  const doneDates = useMemo(
    () =>
      uniqueSortedDates(
        donePickups.map((p) => p.pickupDate),
        doneDeliveries.map((d) => d.deliveryDate),
      ),
    [donePickups, doneDeliveries],
  );

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusyKey(key);
    setOpenKey(null);
    setMenuDate(null);
    await fn();
    router.refresh();
    setBusyKey(null);
  }

  function renderPickupRow(p: PickupRow) {
    const key = `p-${p.id}`;
    const open = openKey === key;
    const done = p.status === "picked_up";
    const busy = busyKey === key;
    return (
      <li key={key} className={done ? "bg-neutral-50/40" : ""}>
        <button
          type="button"
          onClick={() => setOpenKey(open ? null : key)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-neutral-50"
        >
          <span className="flex items-center gap-2">
            <span
              className={`font-medium ${done ? "text-neutral-400 line-through" : "text-neutral-900"}`}
            >
              {p.supplierName}
            </span>
            <Badge
              tone={done ? "green" : "amber"}
              label={done ? "Picked up" : "Pending Pickup"}
            />
          </span>
          <span aria-hidden className="text-sm text-neutral-400">
            {open ? "▲" : "▼"}
          </span>
        </button>

        {open && (
          <div className="border-t border-neutral-100 bg-neutral-50/60 px-4 py-4">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Detail label="PO #" value={p.poNumber} />
              <Detail label="Date" value={formatDate(p.pickupDate)} />
              <Detail label="Address" value={p.address} />
              <Detail label="Amount of stock" value={p.amountOfStock} />
              <Detail label="Note" value={p.note ?? ""} />
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Driver
                </dt>
                <dd className="mt-0.5 flex items-center gap-2 text-sm text-neutral-800">
                  <span className="whitespace-pre-wrap">{p.driver || "—"}</span>
                  {canEditDriver && (
                    <DriverQuickEdit pickupId={p.id} initial={p.driver ?? ""} />
                  )}
                </dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-neutral-400">
                Entered by {p.createdByName}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    run(key, () =>
                      setPickupStatus(p.id, done ? "pending" : "picked_up"),
                    )
                  }
                  disabled={busy}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                    done ? actionBtn : "bg-accent-600 text-white hover:bg-accent-700"
                  }`}
                >
                  {busy ? "Saving…" : done ? "↩ Mark as Pending" : "✓ Mark as Picked up"}
                </button>
                <a
                  href={`/buyer/pickups/print?id=${p.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={actionBtn}
                >
                  🖨 Print
                </a>
                <a href={`/buyer/pickups/${p.id}/edit`} className={actionBtn}>
                  Edit
                </a>
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm("Delete this pickup? This can't be undone.")) return;
                    run(key, () => deletePickup(p.id));
                  }}
                  disabled={busy}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </li>
    );
  }

  function renderDeliveryRow(d: DeliveryRow) {
    const key = `d-${d.id}`;
    const open = openKey === key;
    const done = d.status === "delivered";
    const busy = busyKey === key;
    return (
      <li key={key} className={done ? "bg-neutral-50/40" : ""}>
        <button
          type="button"
          onClick={() => setOpenKey(open ? null : key)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-neutral-50"
        >
          <span className="flex items-center gap-2">
            <span
              className={`font-medium ${done ? "text-neutral-400 line-through" : "text-neutral-900"}`}
            >
              {d.supplierName}
            </span>
            <Badge
              tone={done ? "green" : "sky"}
              label={done ? "Delivered" : "Pending Delivery"}
            />
          </span>
          <span aria-hidden className="text-sm text-neutral-400">
            {open ? "▲" : "▼"}
          </span>
        </button>

        {open && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 bg-neutral-50/60 px-4 py-4">
            <span className="text-xs text-neutral-400">
              Entered by {d.createdByName}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  run(key, () =>
                    setDeliveryStatus(d.id, done ? "pending" : "delivered"),
                  )
                }
                disabled={busy}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                  done ? actionBtn : "bg-accent-600 text-white hover:bg-accent-700"
                }`}
              >
                {busy ? "Saving…" : done ? "↩ Mark as Pending" : "✓ Mark as Delivered"}
              </button>
              <a href={`/buyer/deliveries/${d.id}/edit`} className={actionBtn}>
                Edit
              </a>
              <button
                type="button"
                onClick={() => {
                  if (!confirm("Delete this delivery? This can't be undone.")) return;
                  run(key, () => deleteDelivery(d.id));
                }}
                disabled={busy}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </li>
    );
  }

  function renderDayCard(
    date: string,
    dayPickups: PickupRow[],
    dayDeliveries: DeliveryRow[],
    completed: boolean,
  ) {
    const hasPendingPickups = dayPickups.some((p) => p.status === "pending");
    const hasPendingDeliveries = dayDeliveries.some((d) => d.status === "pending");
    const dayKey = `day-${date}`;
    const menuOpen = menuDate === date;
    return (
      <section
        key={`${completed ? "done-" : ""}${date}`}
        className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
      >
        <div className="flex items-center justify-between gap-3 border-b border-neutral-100 bg-neutral-50 px-4 py-3">
          <h3 className="text-sm font-semibold text-neutral-800">
            {formatDate(date)}
            <span className="ml-2 font-normal text-neutral-400">
              {dayPickups.length > 0 &&
                `${dayPickups.length} pickup${dayPickups.length === 1 ? "" : "s"}`}
              {dayPickups.length > 0 && dayDeliveries.length > 0 && " · "}
              {dayDeliveries.length > 0 &&
                `${dayDeliveries.length} deliver${dayDeliveries.length === 1 ? "y" : "ies"}`}
            </span>
          </h3>
          <div className="flex shrink-0 items-center gap-2">
            {dayPickups.length > 0 && (
              <a
                href={`/buyer/pickups/print?date=${date}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:border-accent-600"
              >
                🖨 Print this day
              </a>
            )}
            {!completed && (hasPendingPickups || hasPendingDeliveries) && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuDate(menuOpen ? null : date)}
                  disabled={busyKey === dayKey}
                  aria-label="More actions"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-300 bg-white text-lg leading-none text-neutral-600 transition hover:border-accent-600 disabled:opacity-50"
                >
                  ⋮
                </button>
                {menuOpen && (
                  <>
                    <button
                      type="button"
                      aria-hidden
                      tabIndex={-1}
                      onClick={() => setMenuDate(null)}
                      className="fixed inset-0 z-10 cursor-default"
                    />
                    <div className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
                      <button
                        type="button"
                        disabled={!hasPendingPickups}
                        onClick={() =>
                          run(dayKey, () => markDayPickupsPickedUp(date))
                        }
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-neutral-800 transition hover:bg-accent-50 disabled:cursor-not-allowed disabled:text-neutral-300 disabled:hover:bg-white"
                      >
                        ✓ All picked up
                      </button>
                      <button
                        type="button"
                        disabled={!hasPendingDeliveries}
                        onClick={() =>
                          run(dayKey, () => markDayDeliveriesDelivered(date))
                        }
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-neutral-800 transition hover:bg-accent-50 disabled:cursor-not-allowed disabled:text-neutral-300 disabled:hover:bg-white"
                      >
                        ✓ All delivered
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {dayPickups.length > 0 && (
          <ul className="divide-y divide-neutral-100">
            {dayPickups.map(renderPickupRow)}
          </ul>
        )}

        {dayDeliveries.length > 0 && (
          <>
            <div className="flex items-center gap-2 border-t border-neutral-100 bg-neutral-50/70 px-4 py-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                Deliveries
              </span>
            </div>
            <ul className="divide-y divide-neutral-100">
              {dayDeliveries.map(renderDeliveryRow)}
            </ul>
          </>
        )}
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        <a
          href="/buyer/pickups/new"
          className="rounded-xl bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-700"
        >
          + New Pickup
        </a>
        <a
          href="/buyer/deliveries/new"
          className="rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:border-accent-600"
        >
          + New Delivery
        </a>
        <a
          href="/buyer/pickups/print"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:border-accent-600"
        >
          🖨 Print all pickups
        </a>
      </div>

      {activeDates.length === 0 && doneDates.length === 0 && (
        <p className="rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
          No pickups or deliveries yet.
        </p>
      )}

      {activeDates.length === 0 && doneDates.length > 0 && (
        <p className="rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
          Nothing outstanding — everything is picked up / delivered.
        </p>
      )}

      {activeDates.map((date) =>
        renderDayCard(
          date,
          activePickups.filter((p) => p.pickupDate === date),
          activeDeliveries.filter((d) => d.deliveryDate === date),
          false,
        ),
      )}

      {doneDates.length > 0 && (
        <div className="mt-4 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-green-700">
              Picked up / Delivered
            </span>
            <span className="h-px flex-1 bg-neutral-200" />
          </div>
          {doneDates.map((date) =>
            renderDayCard(
              date,
              donePickups.filter((p) => p.pickupDate === date),
              doneDeliveries.filter((d) => d.deliveryDate === date),
              true,
            ),
          )}
        </div>
      )}
    </div>
  );
}
