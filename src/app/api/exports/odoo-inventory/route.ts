import { getCurrentUser } from "@/lib/auth";
import { getOdooExportRows } from "@/lib/odoo-inventory-data";
import { ODOO_UNITS } from "@/lib/odoo-locations";
import { formatDate, formatDateTime } from "@/lib/dates";
import { buildXlsx, xlsxResponse } from "@/lib/xlsx";
import type { OdooWarehouseUnit } from "@/db/schema";

// Odoo Inventory → Excel: one row per product per location, for the Odoo team.
// ?unit=freezer limits it to one area (the rack spreadsheet's Export button).
// Same gate as the card: buyer, dispatch, admin.

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !["buyer", "dispatch", "admin"].includes(user.role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const unitParam = new URL(request.url).searchParams.get("unit");
  const unit = ODOO_UNITS.includes(unitParam as OdooWarehouseUnit)
    ? (unitParam as OdooWarehouseUnit)
    : undefined;

  const rows = await getOdooExportRows(unit);

  const workbook = buildXlsx({
    name: "Odoo Inventory",
    // Header on row 1, no title lines above it, so the sheet imports as-is.
    headers: [
      "Location",
      "Area",
      "SKU",
      "Description",
      "Boxes",
      "Units",
      "Qty LBS",
      "Qty KG",
      "Consignment",
      "In Odoo",
      "Counted by",
      "Last updated",
    ],
    rows: rows.map((r) => [
      r.location,
      r.area,
      r.sku,
      r.description,
      r.boxes,
      r.units,
      // Blank, not 0, where no weight was counted.
      r.lbs ?? "",
      r.kg ?? "",
      r.consignment ? "True" : "False",
      r.inOdoo,
      r.countedBy,
      formatDateTime(r.updatedAt),
    ]),
    columnWidths: [12, 14, 16, 52, 8, 8, 10, 10, 13, 17, 18, 22],
  });

  const stamp = formatDate(new Date()).replace(/[^a-zA-Z0-9]+/g, "-");
  return xlsxResponse(`odoo-inventory${unit ? "-" + unit : ""}-${stamp}.xlsx`, workbook);
}
