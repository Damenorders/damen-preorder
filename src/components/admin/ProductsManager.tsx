"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminCreateProduct, adminUpdateProduct } from "@/app/actions/admin";
import { DEPARTMENTS, departmentLabels } from "@/lib/labels";
import type { Department } from "@/db/schema";

interface ProductRow {
  id: number;
  productName: string;
  department: Department;
  active: boolean;
  configJson: string; // pretty-printed form_config
}

const CONFIG_TEMPLATE = JSON.stringify(
  {
    fields: [
      {
        key: "size",
        label: "Size",
        type: "select",
        options: ["Small", "Large"],
        required: true,
        display: "{value}",
      },
    ],
    quantity: { min: 1, max: 20 },
  },
  null,
  2,
);

const inputClass =
  "rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-base outline-none focus:border-accent-600 focus:ring-2 focus:ring-accent-100";

export default function ProductsManager({ products }: { products: ProductRow[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: "",
    department: "meat" as string,
    configJson: CONFIG_TEMPLATE,
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editJson, setEditJson] = useState("");

  function run(action: () => Promise<{ ok: boolean; error?: string }>, onDone?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      onDone?.();
      router.refresh();
    });
  }

  const byDepartment = DEPARTMENTS.map((dep) => ({
    dep,
    items: products.filter((p) => p.department === dep),
  }));

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Add a product</h2>
          <button
            type="button"
            onClick={() => setShowAdd((s) => !s)}
            className="rounded-lg px-3 py-2 text-sm font-medium text-accent-700 hover:bg-accent-50"
          >
            {showAdd ? "Close" : "New product"}
          </button>
        </div>
        {showAdd && (
          <div className="mt-2 flex flex-col gap-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Product name"
                className={inputClass}
              />
              <select
                value={form.department}
                onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                className={inputClass}
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {departmentLabels[d]}
                  </option>
                ))}
              </select>
            </div>
            <label className="text-xs font-medium text-neutral-600">
              Form questions (JSON — fields, quantity, weight settings)
              <textarea
                value={form.configJson}
                onChange={(e) => setForm((f) => ({ ...f, configJson: e.target.value }))}
                rows={10}
                spellCheck={false}
                className={`${inputClass} mt-1 w-full font-mono text-xs`}
              />
            </label>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(
                  () => adminCreateProduct(form),
                  () => {
                    setShowAdd(false);
                    setForm({ name: "", department: "meat", configJson: CONFIG_TEMPLATE });
                  },
                )
              }
              className="self-start rounded-xl bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50"
            >
              Create product
            </button>
          </div>
        )}
      </section>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {byDepartment.map(({ dep, items }) => (
        <section key={dep}>
          <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            {departmentLabels[dep]} · {items.length}
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {items.map((p) => (
              <li
                key={p.id}
                className={`rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm ${
                  p.active ? "" : "opacity-60"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {p.productName}
                    {p.active ? "" : (
                      <span className="ml-1.5 text-xs font-normal text-neutral-400">inactive</span>
                    )}
                  </span>
                  <span className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (editingId === p.id) {
                          setEditingId(null);
                        } else {
                          setEditingId(p.id);
                          setEditJson(p.configJson);
                        }
                      }}
                      className="rounded-lg px-3 py-2 text-sm font-medium text-accent-700 hover:bg-accent-50"
                    >
                      {editingId === p.id ? "Close" : "Edit options"}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => adminUpdateProduct(p.id, { active: !p.active }))}
                      className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-500 hover:bg-neutral-100"
                    >
                      {p.active ? "Deactivate" : "Reactivate"}
                    </button>
                  </span>
                </div>
                {editingId === p.id && (
                  <div className="mt-2">
                    <textarea
                      value={editJson}
                      onChange={(e) => setEditJson(e.target.value)}
                      rows={12}
                      spellCheck={false}
                      className={`${inputClass} w-full font-mono text-xs`}
                    />
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () => adminUpdateProduct(p.id, { configJson: editJson }),
                          () => setEditingId(null),
                        )
                      }
                      className="mt-2 rounded-xl bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50"
                    >
                      Save options
                    </button>
                  </div>
                )}
              </li>
            ))}
            {items.length === 0 && (
              <li className="rounded-2xl border border-dashed border-neutral-300 px-4 py-4 text-center text-sm text-neutral-400">
                No products yet.
              </li>
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}
