"use client";

// Compact buying-sheet list. Each row is a product (or product+specs) total;
// clicking a row reveals detail — the per-spec breakdown (Group-by-product
// mode) and the client list.

import { useState } from "react";
import { weightUnit } from "@/lib/labels";
import type { Department } from "@/db/schema";

export interface BuyingSpecChild {
  specs: string;
  totalQuantity: number;
  totalWeight: number;
  clientCount: number;
  clients: string[];
}

export interface BuyingRow {
  key: string;
  label: string;
  department: Department;
  totalQuantity: number;
  totalWeight: number;
  clientCount: number;
  clients: string[];
  /** Per-spec breakdown, present only in Group-by-product mode */
  children?: BuyingSpecChild[];
}

export interface BuyingSection {
  key: string;
  label: string;
  rows: BuyingRow[];
}

function Stats({
  quantity,
  weight,
  unit,
  clientCount,
}: {
  quantity: number;
  weight: number;
  unit: string;
  clientCount: number;
}) {
  return (
    <span className="flex shrink-0 items-center gap-3 text-sm tabular-nums">
      <span>
        <span className="font-semibold">{quantity}</span>{" "}
        <span className="text-neutral-400">qty</span>
      </span>
      <span>
        <span className="font-semibold">{weight.toFixed(1)}</span>{" "}
        <span className="text-neutral-400">{unit}</span>
      </span>
      <span className="text-neutral-500">
        {clientCount} client{clientCount === 1 ? "" : "s"}
      </span>
    </span>
  );
}

function RowItem({ row }: { row: BuyingRow }) {
  const [open, setOpen] = useState(false);
  const unit = weightUnit(row.department).toUpperCase();
  const specChildren = (row.children ?? []).filter((c) => c.specs);

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-neutral-50"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="w-3 shrink-0 text-neutral-400">{open ? "▾" : "▸"}</span>
          <span className="truncate font-medium uppercase tracking-wide text-accent-800">
            {row.label}
          </span>
        </span>
        <Stats
          quantity={row.totalQuantity}
          weight={row.totalWeight}
          unit={unit}
          clientCount={row.clientCount}
        />
      </button>

      {open && (
        <div className="bg-neutral-50 px-4 pb-3 pt-1 text-sm">
          {specChildren.length > 0 && (
            <ul className="flex flex-col divide-y divide-neutral-200 border-y border-neutral-200">
              {specChildren.map((c, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 py-1.5"
                >
                  <span className="truncate text-neutral-700">{c.specs}</span>
                  <Stats
                    quantity={c.totalQuantity}
                    weight={c.totalWeight}
                    unit={unit}
                    clientCount={c.clientCount}
                  />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-neutral-500">
            <span className="font-medium text-neutral-600">Clients: </span>
            {row.clients.join(" · ")}
          </p>
        </div>
      )}
    </li>
  );
}

export default function BuyingSheetGroups({
  sections,
}: {
  sections: BuyingSection[];
}) {
  return (
    <div className="flex flex-col gap-5">
      {sections.map((section) => (
        <section key={section.key}>
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {section.label}
          </h2>
          <ul className="mt-1.5 divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
            {section.rows.map((row) => (
              <RowItem key={row.key} row={row} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
