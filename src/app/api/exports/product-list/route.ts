import { getCurrentUser } from "@/lib/auth";
import { getProductList, getProductListItems } from "@/lib/product-lists";
import { formatDate } from "@/lib/dates";
import { buildXlsx, xlsxResponse } from "@/lib/xlsx";

// Product List → Excel, print-ready: bold title, the header row repeated on
// every page, fit-to-width. Buyer/admin only, same gate as the tab itself.

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "buyer" && user.role !== "admin")) {
    return new Response("Forbidden", { status: 403 });
  }

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id)) {
    return new Response("Bad request", { status: 400 });
  }

  const [list, items] = await Promise.all([
    getProductList(id),
    getProductListItems(id),
  ]);
  if (!list) return new Response("Not found", { status: 404 });

  const total = items.reduce((sum, item) => sum + (item.price ?? 0), 0);
  const unpriced = items.filter((item) => item.price === null).length;

  const workbook = buildXlsx({
    name: "Product List",
    title: list.name,
    subtitles: [
      `${items.length} ${items.length === 1 ? "item" : "items"}` +
        (unpriced > 0 ? ` · ${unpriced} with no price` : ""),
      `Prepared by ${list.createdByName || user.name} · ${formatDate(new Date())}`,
    ],
    headers: ["#", "SKU", "Description", "Price"],
    rows: items.map((item, index) => [
      index + 1,
      item.itemCode,
      item.description,
      // An unpriced line prints blank rather than a misleading $0.00.
      item.price === null ? "" : item.price,
    ]),
    columnWidths: [6, 18, 62, 14],
    moneyColumns: [3],
    totalRow: ["", "", "Total", total],
  });

  // Keep the client's own filename recognisable, minus anything a filesystem
  // (or the Content-Disposition header) would choke on.
  const slug =
    list.name
      .replace(/[^a-zA-Z0-9 _-]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 60) || "product_list";

  return xlsxResponse(`${slug}.xlsx`, workbook);
}
