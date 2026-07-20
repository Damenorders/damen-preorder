import { requireRole } from "@/lib/auth";
import { listPickups } from "@/app/actions/pickups";
import { formatDate } from "@/lib/dates";
import PrintButton from "@/components/PrintButton";

// Landscape print view — one pickup sheet per page, matching the Damen Pickup
// Sheet template. Prints all pickups, or one day via ?date=YYYY-MM-DD.
// Standalone (no app chrome) so it prints clean.

const COMPANY_ADDRESS = "387 Rue Deslauriers, Saint-Laurent QC, H4N 1W2";
const COMPANY_EMAIL = "info@damenalimentaire.com";

function Field({
  label,
  value,
  lines = 2,
  red = false,
}: {
  label: string;
  value: string;
  lines?: number;
  red?: boolean;
}) {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      <div
        className="field-value"
        style={{
          minHeight: `${lines * 34}px`,
          ...(red ? { color: "#dc2626", fontWeight: 700 } : {}),
        }}
      >
        {value || " "}
      </div>
    </div>
  );
}

export default async function PickupPrintPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("buyer", "dispatch", "owner");
  const params = await searchParams;
  const dateParam = typeof params.date === "string" ? params.date : undefined;
  const idParam = typeof params.id === "string" ? Number(params.id) : undefined;

  const all = await listPickups();
  const rows = idParam
    ? all.filter((p) => p.id === idParam)
    : dateParam
      ? all.filter((p) => p.pickupDate === dateParam)
      : all;

  return (
    <div className="print-root">
      <style>{`
        @page { size: landscape; margin: 8mm; }
        .print-root { background: #f3f4f6; }
        @media print {
          .no-print { display: none !important; }
          .print-root { background: #fff; }
          .sheet {
            box-shadow: none !important;
            margin: 0 !important;
          }
        }
        .sheet {
          width: 100%;
          max-width: 1040px;
          margin: 0 auto 24px;
          background: #fff;
          color: #1f2937;
          padding: 14px 30px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.12);
          box-sizing: border-box;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .sheet:not(:last-child) { break-after: page; page-break-after: always; }
        .sheet-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
        }
        .sheet-logo { height: 96px; width: auto; object-fit: contain; }
        .sheet-title { flex: 1; text-align: center; padding-top: 4px; }
        .sheet-title h1 {
          margin: 0;
          font-size: 34px;
          font-weight: 800;
          letter-spacing: 0.02em;
          color: #2b3a8c;
        }
        .sheet-title p { margin: 3px 0 0; font-size: 16px; color: #6b7280; }
        .contact {
          border: 1px solid #d1d5db;
          border-radius: 12px;
          padding: 10px 14px;
          font-size: 15px;
          min-width: 280px;
          background: #f9fafb;
        }
        .contact b { color: #2b3a8c; }
        .rule { border: 0; border-top: 2px solid #2b3a8c; margin: 10px 0 12px; }
        .field {
          border: 1px solid #c7cfe2;
          border-radius: 12px;
          padding: 8px 16px;
          margin-bottom: 0;
        }
        .field-label { font-size: 18px; font-weight: 700; color: #2b3a8c; }
        .field-value {
          margin-top: 6px;
          font-size: 26px;
          white-space: pre-wrap;
          border-bottom: 1px solid #e5e7eb;
        }
        /* Two-column body so the data spreads across the landscape page
           instead of stacking into a tall column that overflows. */
        .body-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px 20px;
        }
        .body-grid .span2 { grid-column: 1 / -1; }
      `}</style>

      <PrintButton auto={rows.length > 0} />

      {rows.length === 0 ? (
        <p className="no-print mx-auto max-w-4xl px-4 text-sm text-neutral-500">
          No pickups {dateParam ? `for ${formatDate(dateParam)}` : "to print"}.
        </p>
      ) : (
        rows.map((p) => (
          <article key={p.id} className="sheet">
            <div className="sheet-head">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/damen-combined-logo.png"
                alt="Damen Service Alimentaire"
                className="sheet-logo"
              />
              <div className="sheet-title">
                <h1>PICKUP SHEET</h1>
                <p>Damen Service Alimentaire</p>
              </div>
              <div className="contact">
                <div>
                  <b>Our Address:</b> {COMPANY_ADDRESS}
                </div>
                <div style={{ marginTop: "4px" }}>
                  <b>Our Email:</b> {COMPANY_EMAIL}
                </div>
              </div>
            </div>

            <hr className="rule" />

            <div className="body-grid">
              <div className="span2">
                <Field label="Pickup Location:" value={p.supplierName} lines={1} />
              </div>
              <Field label="PO #:" value={p.poNumber} lines={1} red />
              <Field label="Date:" value={formatDate(p.pickupDate)} lines={1} />
              <div className="span2">
                <Field label="Address:" value={p.address} lines={2} />
              </div>
              <Field label="Amount of stock:" value={p.amountOfStock} lines={1} />
              <Field label="Note:" value={p.note ?? ""} lines={1} />
              <div className="span2">
                <Field label="Driver:" value={p.driver ?? ""} lines={2} red />
              </div>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
