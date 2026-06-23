import "server-only";
import { db } from "@/db";
import { auditLogs, type User } from "@/db/schema";

// SPEC.md §27 — who changed it, what changed, old value, new value, when.
// Call inside the same transaction as the change itself.

type AuditExecutor = Pick<typeof db, "insert">;

export interface AuditEntry {
  action: string; // e.g. "create", "update:quantity", "update:status"
  recordType:
    | "order"
    | "order_line"
    | "order_error"
    | "client"
    | "product"
    | "user"
    | "application";
  recordId: string | number;
  oldValue?: unknown;
  newValue?: unknown;
}

export async function logAudit(
  executor: AuditExecutor,
  user: User,
  entries: AuditEntry[],
) {
  if (entries.length === 0) return;
  await executor.insert(auditLogs).values(
    entries.map((e) => ({
      userId: user.id,
      userName: user.name,
      action: e.action,
      recordType: e.recordType,
      recordId: String(e.recordId),
      oldValue: e.oldValue ?? null,
      newValue: e.newValue ?? null,
    })),
  );
}
