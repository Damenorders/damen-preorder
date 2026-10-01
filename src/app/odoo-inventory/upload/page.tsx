import { requireRole } from "@/lib/auth";
import { getOdooCatalogStatus } from "@/lib/odoo-inventory-data";
import { formatDateTime } from "@/lib/dates";
import PageShell from "@/components/PageShell";
import OdooCatalogUploadForm from "@/components/odoo-inventory/OdooCatalogUploadForm";

// Upload the Odoo product list (SKU + description) that the Odoo Inventory
// searches. It is the only data the Odoo Inventory takes from outside.
export default async function OdooUploadPage() {
  const user = await requireRole("buyer", "dispatch");
  const status = await getOdooCatalogStatus();

  return (
    <PageShell
      user={user}
      backHref="/odoo-inventory?screen=catalog"
      backLabel="Odoo Inventory"
      title="Odoo product list"
      subtitle="Upload the Excel of Odoo SKUs and descriptions."
    >
      <div className="mb-5 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">List loaded now</h2>
        {status.active === 0 && status.retired === 0 ? (
          <p className="mt-1 text-sm text-neutral-500">No products yet. Upload the Odoo Excel below.</p>
        ) : (
          <p className="mt-1 text-sm text-neutral-500">
            <strong>{status.active.toLocaleString()}</strong> products in the Odoo list
            {status.retired > 0 && (
              <>
                {" "}· <strong>{status.retired.toLocaleString()}</strong> no longer in the list
              </>
            )}
            {status.lastUpload &&
              ` · last upload ${formatDateTime(status.lastUpload.createdAt)} by ${status.lastUpload.userName}`}
          </p>
        )}
        <p className="mt-2 text-xs text-neutral-500">
          A new upload replaces the list. Products missing from it are kept on
          their shelves, marked “No longer in Odoo list”. Nothing is imported
          until you have checked the preview and confirmed.
        </p>
      </div>

      <OdooCatalogUploadForm />
    </PageShell>
  );
}
