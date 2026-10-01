"use client";

// Odoo product list upload, in three steps so nothing is imported on a guess:
// 1. choose the file → 2. confirm which column is the SKU and which is the
// description → 3. read the preview (new / renamed / dropped / problems) and
// confirm. The file stays in the picker and is re-sent at each step.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { odooCatalogUpload, type OdooUploadResult } from "@/app/actions/odoo-inventory";

type Columns = Extract<OdooUploadResult, { stage: "columns" }>;
type Preview = Extract<OdooUploadResult, { stage: "preview" | "applied" }>;

const selectClass =
  "mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-3 text-base";

export default function OdooCatalogUploadForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [columns, setColumns] = useState<Columns | null>(null);
  const [skuCol, setSkuCol] = useState(-1);
  const [descCol, setDescCol] = useState(-1);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(mode: "inspect" | "preview" | "apply", header = hasHeader) {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose the Odoo Excel file first.");
      return null;
    }
    const data = new FormData();
    data.set("file", file);
    data.set("mode", mode);
    data.set("hasHeader", header ? "1" : "0");
    data.set("skuCol", String(skuCol));
    data.set("descCol", String(descCol));
    setBusy(true);
    setError(null);
    try {
      const res = await odooCatalogUpload(data);
      if (!res.ok) {
        setError(res.error);
        return null;
      }
      return res;
    } catch {
      setError("The upload did not go through — check your connection and try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function inspect(header = hasHeader) {
    setPreview(null);
    const res = await send("inspect", header);
    if (res && res.stage === "columns") {
      setColumns(res);
      setSkuCol(res.guess.skuCol);
      setDescCol(res.guess.descCol);
    }
  }

  async function runPreview() {
    const res = await send("preview");
    if (res && res.stage === "preview") setPreview(res);
  }

  async function apply() {
    const res = await send("apply");
    if (res && res.stage === "applied") {
      setPreview(res);
      router.refresh();
    }
  }

  function reset() {
    setColumns(null);
    setPreview(null);
    setSkuCol(-1);
    setDescCol(-1);
  }

  const applied = preview?.stage === "applied";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="odoo-file" className="block text-sm font-medium text-neutral-700">
          Odoo Excel file
        </label>
        <input
          id="odoo-file"
          ref={fileRef}
          type="file"
          accept=".xlsx,.xlsm,.csv,.txt"
          disabled={busy}
          onChange={(e) => {
            setFileName(e.target.files?.[0]?.name ?? null);
            reset();
            if (e.target.files?.[0]) void inspect();
          }}
          className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-3 text-base file:mr-3 file:rounded-lg file:border-0 file:bg-accent-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-accent-800"
        />
        <p className="mt-1 text-xs text-neutral-500">
          .xlsx or .csv. Old .xls files need a Save As .xlsx first.
        </p>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {columns && !applied && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold">Which columns?</h2>
          <label className="mt-2 flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={hasHeader}
              disabled={busy}
              onChange={(e) => {
                setHasHeader(e.target.checked);
                setPreview(null);
                void inspect(e.target.checked);
              }}
              className="h-5 w-5"
            />
            The first row is column names
          </label>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-neutral-700">
              SKU column
              <select
                className={selectClass}
                value={skuCol}
                disabled={busy}
                onChange={(e) => {
                  setSkuCol(Number(e.target.value));
                  setPreview(null);
                }}
              >
                <option value={-1}>Choose…</option>
                {columns.headers.map((h, i) => (
                  <option key={i} value={i}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-neutral-700">
              Description column
              <select
                className={selectClass}
                value={descCol}
                disabled={busy}
                onChange={(e) => {
                  setDescCol(Number(e.target.value));
                  setPreview(null);
                }}
              >
                <option value={-1}>Choose…</option>
                {columns.headers.map((h, i) => (
                  <option key={i} value={i}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {columns.sample.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <p className="text-xs font-medium text-neutral-500">First rows of the file</p>
              <table className="mt-1 w-full min-w-max text-left text-xs">
                <thead>
                  <tr className="text-neutral-500">
                    {columns.headers.map((h, i) => (
                      <th
                        key={i}
                        className={`border-b px-2 py-1 font-medium ${i === skuCol || i === descCol ? "bg-accent-50 text-accent-800" : ""}`}
                      >
                        {i === skuCol ? "SKU" : i === descCol ? "Description" : h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {columns.sample.map((row, r) => (
                    <tr key={r}>
                      {columns.headers.map((_, i) => (
                        <td
                          key={i}
                          className={`border-b px-2 py-1 ${i === skuCol || i === descCol ? "bg-accent-50" : "text-neutral-500"}`}
                        >
                          {row[i] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!preview && (
            <button
              type="button"
              onClick={runPreview}
              disabled={busy || skuCol < 0 || descCol < 0 || skuCol === descCol}
              className="mt-4 w-full rounded-xl bg-accent-600 px-4 py-3 text-base font-semibold text-white disabled:bg-neutral-300"
            >
              {busy ? "Reading…" : "Check the file"}
            </button>
          )}
        </div>
      )}

      {preview && <PreviewReport preview={preview} />}

      {preview && !applied && (
        <button
          type="button"
          onClick={apply}
          disabled={busy || preview.conflicts.length > 0}
          className="rounded-xl bg-accent-600 px-4 py-3 text-base font-semibold text-white disabled:bg-neutral-300"
        >
          {busy
            ? "Importing…"
            : preview.conflicts.length > 0
              ? "Fix the SKUs listed above in the file first"
              : `Import ${preview.productCount.toLocaleString()} products`}
        </button>
      )}

      {applied && (
        <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">
          Imported {fileName}. The Odoo Inventory now searches this list.
        </p>
      )}
    </div>
  );
}

function PreviewReport({ preview }: { preview: Preview }) {
  const { totals, diff } = preview;
  const applied = preview.stage === "applied";
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold">
        {applied ? "Imported" : "Preview"} — {preview.fileName}
      </h2>
      <ul className="mt-2 flex flex-col gap-1 text-sm text-neutral-700">
        <li>
          <strong>{preview.productCount.toLocaleString()}</strong> products in the file
        </li>
        <li>
          <strong>{totals.added.toLocaleString()}</strong> new
        </li>
        <li>
          <strong>{totals.renamed.toLocaleString()}</strong> descriptions changed
        </li>
        <li>
          <strong>{totals.retired.toLocaleString()}</strong> no longer in the list (kept, marked)
          {preview.countedRetired > 0 && ` — ${preview.countedRetired} of them already counted on a shelf`}
        </li>
        {totals.restored > 0 && (
          <li>
            <strong>{totals.restored.toLocaleString()}</strong> back in the list
          </li>
        )}
        <li>
          <strong>{diff.unchanged.toLocaleString()}</strong> unchanged
        </li>
      </ul>

      {preview.conflicts.length > 0 && (
        <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          <p className="font-semibold">
            {preview.conflicts.length} SKU{preview.conflicts.length === 1 ? "" : "s"} listed twice with
            different descriptions. Nothing can be imported until the file is fixed:
          </p>
          <ul className="mt-1 list-disc pl-5">
            {preview.conflicts.map((c) => (
              <li key={c.sku}>
                <strong>{c.sku}</strong>: {c.descriptions.join(" / ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Details title={`Rows left out (${totals.skipped})`} items={preview.skipped.map((s) => `${s.reason}: ${s.sku || s.description}`)} total={totals.skipped} />
      <Details title={`Listed more than once, kept once (${preview.repeated.length})`} items={preview.repeated.map((r) => `${r.sku} — ${r.description} (×${r.times})`)} total={preview.repeated.length} />
      <Details
        title={`Different SKUs with the same description (${totals.sharedDescriptions})`}
        items={preview.sharedDescriptions.map((g) => `${g.description}: ${g.skus.join(", ")}`)}
        total={totals.sharedDescriptions}
      />
      <Details title={`New (${totals.added})`} items={diff.added.map((p) => `${p.sku} — ${p.description}`)} total={totals.added} />
      <Details title={`Descriptions changed (${totals.renamed})`} items={diff.renamed.map((r) => `${r.sku}: ${r.from} → ${r.to}`)} total={totals.renamed} />
      <Details title={`No longer in the list (${totals.retired})`} items={diff.retired.map((p) => `${p.sku} — ${p.description}`)} total={totals.retired} />
    </div>
  );
}

function Details({ title, items, total }: { title: string; items: string[]; total: number }) {
  if (!total) return null;
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-sm font-medium text-accent-700">{title}</summary>
      <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto text-xs text-neutral-600">
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
        {total > items.length && <li className="italic">…and {total - items.length} more</li>}
      </ul>
    </details>
  );
}
