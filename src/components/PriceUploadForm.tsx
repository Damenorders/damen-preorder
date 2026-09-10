"use client";

// Price-file upload. Takes the PriceList export as .xlsx or .csv (SKU, Product,
// Price), replaces the price for every SKU in it, and adds any SKU the catalog
// doesn't have yet. Per-line prices a buyer typed on a list are left alone.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { importPrices } from "@/app/actions/product-lists";
import type { PriceImportReport } from "@/lib/product-list-types";

export default function PriceUploadForm() {
  const router = useRouter();
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<PriceImportReport | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Choose a price file first.");
      return;
    }

    setError(null);
    setReport(null);
    setUploading(true);
    const result = await importPrices(data);
    setUploading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setReport(result.report);
    form.reset();
    setFileName(null);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <label
          htmlFor="price-file"
          className="block text-sm font-medium text-neutral-700"
        >
          Price file
        </label>
        <input
          id="price-file"
          name="file"
          type="file"
          accept=".xlsx,.xlsm,.csv,.txt"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-3 text-base file:mr-3 file:rounded-lg file:border-0 file:bg-accent-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-accent-800"
        />
        <p className="mt-1 text-xs text-neutral-500">
          Three columns: SKU, Product, Price. A header row is optional — the
          PriceList export works as-is. Old .xls files need a Save As .xlsx
          first.
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={uploading || !fileName}
        className="rounded-xl bg-accent-600 px-4 py-3 text-base font-semibold text-white disabled:bg-neutral-300"
      >
        {uploading ? "Loading prices…" : "Upload prices"}
      </button>

      {report && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-base font-semibold">
            Loaded {report.fileName}
          </h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-neutral-700">
            <li>
              <strong>{report.pricesSet.toLocaleString()}</strong> prices set
            </li>
            <li>
              <strong>{report.itemsCreated.toLocaleString()}</strong> new items
              added to the catalog
            </li>
            <li>
              <strong>{report.skipped.length.toLocaleString()}</strong> rows
              skipped
            </li>
          </ul>

          {report.skipped.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-accent-700">
                Show skipped rows
              </summary>
              <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto text-xs text-neutral-600">
                {report.skipped.slice(0, 200).map((row) => (
                  <li key={`${row.line}-${row.text}`}>
                    Line {row.line}: {row.text || "(blank)"} — {row.reason}
                  </li>
                ))}
                {report.skipped.length > 200 && (
                  <li className="text-neutral-400">
                    …and {report.skipped.length - 200} more
                  </li>
                )}
              </ul>
            </details>
          )}
        </div>
      )}
    </form>
  );
}
