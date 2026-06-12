// One date format across the platform: "Jun 12, 2026"
// (with time where relevant: "Jun 12, 2026, 10:30 AM"), Montreal time.

const TZ = "America/Montreal";

/** "Jun 12, 2026" — accepts a Date or a YYYY-MM-DD string */
export function formatDate(value: Date | string): string {
  const date =
    typeof value === "string" ? new Date(`${value}T12:00:00`) : value;
  return date.toLocaleDateString("en-US", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "Jun 12, 2026, 10:30 AM" */
export function formatDateTime(value: Date | string): string {
  return new Date(value).toLocaleString("en-US", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
