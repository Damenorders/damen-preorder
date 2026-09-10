// One money format across the Product List screens and the printed sheet.

/** 12.5 -> "$12.50"; null -> "—". */
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return `$${value.toFixed(2)}`;
}
