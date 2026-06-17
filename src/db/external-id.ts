// Stable external IDs for Odoo compatibility — SPEC.md §22.
// Examples: damen_order_000001, damen_order_line_000001, damen_client_000001

export function formatExternalId(
  prefix: "order" | "order_line" | "order_error" | "client" | "user",
  id: number,
): string {
  return `damen_${prefix}_${String(id).padStart(6, "0")}`;
}

// Products use a slug-based form per SPEC.md §22: damen_product_salmon_001
export function formatProductExternalId(name: string, id: number): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `damen_product_${slug}_${String(id).padStart(3, "0")}`;
}
