import { getCurrentUser } from "@/lib/auth";
import { getBuyingSheet } from "@/lib/buying-sheet";
import { businessToday } from "@/lib/buyer-data";
import { toCsv, csvResponse } from "@/lib/csv";

// Grouped buying sheet as CSV — SPEC.md §20–21. Buyer/admin only.

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role === "rep") {
    return new Response("Forbidden", { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const groups = await getBuyingSheet({
    delivery: params.get("delivery") ?? "all",
    status: params.get("status") ?? "pending",
    department: params.get("module") ?? undefined,
  });

  const csv = toCsv(
    [
      "delivery_date",
      "department",
      "product",
      "specs",
      "total_quantity",
      "total_weight_kg",
      "client_count",
      "clients",
    ],
    groups.map((g) => [
      g.deliveryDate,
      g.department,
      g.product,
      g.specs,
      g.totalQuantity,
      g.totalWeight.toFixed(2),
      g.clientCount,
      g.clients.join("; "),
    ]),
  );

  return csvResponse(`damen_buying_sheet_${businessToday()}.csv`, csv);
}
