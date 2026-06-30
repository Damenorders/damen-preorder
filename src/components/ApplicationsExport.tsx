"use client";

// Export button for the Applications table. Shows a preview of exactly the
// rows currently shown (already filtered server-side); Confirm downloads them
// as a PDF that mirrors the table. Mirrors ErrorsExport.

import { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ApplicationExportRow {
  business: string;
  contact: string;
  phone: string;
  email: string;
  status: string;
  submitted: string;
}

const COLUMNS = [
  "Business",
  "Contact",
  "Phone",
  "Email",
  "Status",
  "Submitted",
] as const;

export default function ApplicationsExport({
  rows,
  filterSummary,
}: {
  rows: ApplicationExportRow[];
  filterSummary: string;
}) {
  const [open, setOpen] = useState(false);

  function cells(r: ApplicationExportRow): string[] {
    return [r.business, r.contact, r.phone, r.email, r.status, r.submitted];
  }

  function download() {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
    doc.setFontSize(16);
    doc.text("Applications", 40, 40);
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text(
      `${filterSummary} · ${rows.length} application${rows.length === 1 ? "" : "s"} · Generated ${new Date().toLocaleString("en-CA")}`,
      40,
      58,
    );
    autoTable(doc, {
      startY: 72,
      head: [[...COLUMNS]],
      body: rows.map(cells),
      styles: { fontSize: 9, cellPadding: 4, overflow: "linebreak", valign: "top" },
      headStyles: { fillColor: [243, 244, 246], textColor: 30, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      margin: { left: 40, right: 40 },
    });
    doc.save(`damen-applications-${new Date().toISOString().slice(0, 10)}.pdf`);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={rows.length === 0}
        className="rounded-xl bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-700 disabled:opacity-50"
      >
        Export
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
              <div>
                <h3 className="text-base font-semibold">Export preview</h3>
                <p className="text-xs text-neutral-500">
                  {filterSummary} · {rows.length} application
                  {rows.length === 1 ? "" : "s"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Preview of exactly what will print */}
            <div className="overflow-auto px-5 py-4">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    {COLUMNS.map((c) => (
                      <th
                        key={c}
                        className="border border-neutral-300 bg-neutral-100 px-2 py-1.5 text-left font-semibold"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={i % 2 ? "bg-neutral-50" : ""}>
                      {cells(r).map((v, j) => (
                        <td
                          key={j}
                          className="border border-neutral-200 px-2 py-1 align-top"
                        >
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={download}
                className="rounded-xl bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-700"
              >
                Confirm &amp; download
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
