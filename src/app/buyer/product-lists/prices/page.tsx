import { requireRole } from "@/lib/auth";
import { getPriceFileStatus } from "@/lib/product-lists";
import { formatDateTime } from "@/lib/dates";
import PageShell from "@/components/PageShell";
import PriceUploadForm from "@/components/PriceUploadForm";

// Upload the price file that fills in prices across every Product List.
export default async function PricesPage() {
  const user = await requireRole("buyer");
  const status = await getPriceFileStatus();

  return (
    <PageShell
      user={user}
      backHref="/buyer/product-lists"
      backLabel="Current Product Lists"
      title="Product Prices"
      subtitle="Upload a price file and every list shows the new prices."
    >
      <div className="mb-5 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">Prices loaded now</h2>
        {status.pricedItems === 0 ? (
          <p className="mt-1 text-sm text-neutral-500">
            No prices yet. Upload a file below and lists will start showing
            prices right away.
          </p>
        ) : (
          <p className="mt-1 text-sm text-neutral-500">
            <strong>{status.pricedItems.toLocaleString()}</strong> items priced
            {status.lastUpdatedAt && ` · last updated ${formatDateTime(status.lastUpdatedAt)}`}
            {status.lastFile && ` from ${status.lastFile}`}
            {status.lastBy && ` by ${status.lastBy}`}
          </p>
        )}
        <p className="mt-2 text-xs text-neutral-500">
          A new upload replaces the price for every SKU it contains. Prices you
          typed by hand on a list stay as they are.
        </p>
      </div>

      <PriceUploadForm />
    </PageShell>
  );
}
