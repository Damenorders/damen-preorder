import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import PageShell from "@/components/PageShell";
import FilterBar, { type FilterField } from "@/components/FilterBar";
import LiveRefresh from "@/components/LiveRefresh";
import { formatDateTime } from "@/lib/dates";

// Audit History — admin only (SPEC.md §27): who changed what, old → new, when.

const ACTION_LABELS: Record<string, string> = {
  create: "Created",
  delete: "Deleted",
  "update:client": "Client changed",
  "update:delivery_date": "Delivery date changed",
  "update:notes": "Notes changed",
  "update:product": "Product changed",
  "update:specs": "Specs changed",
  "update:quantity": "Quantity changed",
  "update:weight": "Weight changed",
  "update:submission_status": "Submission status changed",
  "update:buyer_table_status": "Buyer status changed",
};

function describeValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("admin");
  const params = await searchParams;
  const get = (key: string) => {
    const v = params[key];
    return typeof v === "string" && v !== "" ? v : undefined;
  };

  const conditions: SQL[] = [];
  const recordType = get("type");
  if (recordType && ["order", "order_line"].includes(recordType)) {
    conditions.push(eq(auditLogs.recordType, recordType));
  }
  const userName = get("user");
  if (userName) conditions.push(eq(auditLogs.userName, userName));
  const onDate = get("date");
  if (onDate && /^\d{4}-\d{2}-\d{2}$/.test(onDate)) {
    conditions.push(
      sql`(${auditLogs.createdAt} at time zone 'America/Montreal')::date = ${onDate}`,
    );
  }

  const [entries, userRows] = await Promise.all([
    db.query.auditLogs.findMany({
      where: conditions.length ? and(...conditions) : undefined,
      orderBy: desc(auditLogs.createdAt),
      limit: 200,
    }),
    db.selectDistinct({ userName: auditLogs.userName }).from(auditLogs),
  ]);

  const fields: FilterField[] = [
    {
      type: "select",
      param: "type",
      label: "Record type",
      emptyLabel: "All types",
      options: [
        { value: "order", label: "Order" },
        { value: "order_line", label: "Order line" },
      ],
    },
    {
      type: "select",
      param: "user",
      label: "User",
      emptyLabel: "All users",
      options: userRows
        .map((u) => u.userName)
        .sort()
        .map((n) => ({ value: n, label: n })),
    },
    { type: "date", param: "date", label: "On date" },
  ];

  const activeCount = [recordType, userName, onDate].filter(Boolean).length;

  return (
    <PageShell
      user={user}
      backHref="/admin"
      backLabel="Dashboard"
      title="Audit History"
      subtitle={`Latest ${entries.length} change${entries.length === 1 ? "" : "s"} (max 200 shown)`}
      wide
    >
      <LiveRefresh />
      <div className="flex flex-col gap-4">
        <FilterBar fields={fields} activeCount={activeCount} />

        {entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-10 text-center text-neutral-500">
            No audit entries match.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-sm">
                    <span className="font-semibold">{entry.userName}</span>{" "}
                    <span className="text-neutral-600">
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </span>{" "}
                    <span className="text-neutral-400">
                      · {entry.recordType.replace("_", " ")} #{entry.recordId}
                    </span>
                  </p>
                  <p className="text-xs text-neutral-400">
                    {formatDateTime(entry.createdAt)}
                  </p>
                </div>
                {(entry.oldValue !== null || entry.newValue !== null) && (
                  <p className="mt-1.5 break-words text-sm text-neutral-700">
                    {entry.oldValue !== null && (
                      <span className="text-neutral-400 line-through">
                        {describeValue(entry.oldValue)}
                      </span>
                    )}
                    {entry.oldValue !== null && entry.newValue !== null && " → "}
                    {entry.newValue !== null && (
                      <span>{describeValue(entry.newValue)}</span>
                    )}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
}
