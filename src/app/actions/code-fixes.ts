"use server";

// Codes to Fix — reps, buyers and admin save and edit entries (anyone may edit
// any entry); only buyers and admin toggle a line between pending and fixed.

import { revalidatePath } from "next/cache";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { codeFixes, codeFixLines } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { buildLookup, checkLine, type CleanLine, type CodeFixLineInput } from "@/lib/code-fix";
import { getCodeFixCatalog } from "@/lib/code-fix-data";

export interface CodeFixInput {
  id?: number; // set when editing
  clientName: string;
  note: string;
  lines: CodeFixLineInput[];
}

export type CodeFixActionResult =
  | { ok: true; id: number }
  | { ok: false; error: string };

export async function saveCodeFix(input: CodeFixInput): Promise<CodeFixActionResult> {
  const user = await requireRole("rep", "buyer");

  const name = input.clientName?.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "Enter the client name." };

  // A completely blank product row is ignored; anything half-filled is checked.
  const filled = (input.lines ?? []).filter((l) =>
    [l.clientSku, l.clientDescription, l.price, l.generalSku, l.generalDescription].some(
      (v) => String(v ?? "").trim() !== "",
    ),
  );
  if (filled.length === 0) return { ok: false, error: "Add at least one product." };

  const lookup = buildLookup(await getCodeFixCatalog());
  const lines: CleanLine[] = [];
  for (const [i, l] of filled.entries()) {
    const r = checkLine(lookup, l, i + 1);
    if (!r.ok) return { ok: false, error: r.error };
    lines.push(r.line);
  }

  // The card keeps its own client names (not the shared client list): a name
  // already used here, in any case, keeps its first spelling.
  const [known] = await db
    .select({ clientName: codeFixes.clientName })
    .from(codeFixes)
    .where(sql`lower(${codeFixes.clientName}) = ${name.toLowerCase()}`)
    .limit(1);
  const client = { clientName: known?.clientName ?? name };
  const note = input.note?.trim() || null;
  const lineValues = (l: CleanLine, position: number) => ({
    position,
    clientSku: l.clientSku,
    clientDescription: l.clientDescription,
    price: l.price,
    generalSku: l.generalSku,
    generalDescription: l.generalDescription,
  });

  if (input.id) {
    const entryId = input.id;
    const found = await db.transaction(async (tx) => {
      const [before] = await tx.select().from(codeFixes).where(eq(codeFixes.id, entryId));
      if (!before) return false;
      const oldLines = await tx.select().from(codeFixLines).where(eq(codeFixLines.codeFixId, entryId));
      const ownIds = new Set(oldLines.map((l) => l.id));
      const kept = lines.filter((l) => l.id && ownIds.has(l.id)).map((l) => l.id!);

      await tx
        .update(codeFixes)
        .set({ clientName: client.clientName, note, updatedByName: user.name, updatedAt: new Date() })
        .where(eq(codeFixes.id, entryId));
      // Lines removed in the form are deleted; kept lines keep their status.
      await tx
        .delete(codeFixLines)
        .where(
          kept.length
            ? and(eq(codeFixLines.codeFixId, entryId), notInArray(codeFixLines.id, kept))
            : eq(codeFixLines.codeFixId, entryId),
        );
      for (const [i, l] of lines.entries()) {
        if (l.id && ownIds.has(l.id)) {
          await tx.update(codeFixLines).set(lineValues(l, i)).where(eq(codeFixLines.id, l.id));
        } else {
          await tx.insert(codeFixLines).values({ codeFixId: entryId, ...lineValues(l, i) });
        }
      }

      await logAudit(tx, user, [
        {
          action: "update",
          recordType: "code_fix",
          recordId: entryId,
          oldValue: { client: before.clientName, note: before.note, lines: oldLines },
          newValue: { client: client.clientName, note, lines },
        },
      ]);
      return true;
    });
    if (!found) return { ok: false, error: "That entry no longer exists." };
    revalidatePath("/code-fixes");
    return { ok: true, id: entryId };
  }

  const id = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(codeFixes)
      .values({
        clientName: client.clientName,
        note,
        createdBy: user.id,
        createdByName: user.name,
        updatedByName: user.name,
      })
      .returning({ id: codeFixes.id });
    await tx.insert(codeFixLines).values(lines.map((l, i) => ({ codeFixId: created.id, ...lineValues(l, i) })));
    await logAudit(tx, user, [
      {
        action: "create",
        recordType: "code_fix",
        recordId: created.id,
        newValue: { client: client.clientName, note, lines },
      },
    ]);
    return created.id;
  });

  revalidatePath("/code-fixes");
  return { ok: true, id };
}

export async function setCodeFixLineStatus(
  lineId: number,
  status: "pending" | "fixed",
): Promise<CodeFixActionResult> {
  const user = await requireRole("buyer");
  if (status !== "pending" && status !== "fixed") return { ok: false, error: "Unknown status." };

  const [line] = await db.select().from(codeFixLines).where(eq(codeFixLines.id, lineId));
  if (!line) return { ok: false, error: "That product line no longer exists." };

  await db.transaction(async (tx) => {
    await tx
      .update(codeFixLines)
      .set(
        status === "fixed"
          ? { status, fixedByName: user.name, fixedAt: new Date() }
          : { status, fixedByName: null, fixedAt: null },
      )
      .where(eq(codeFixLines.id, lineId));
    await logAudit(tx, user, [
      {
        action: "update:status",
        recordType: "code_fix",
        recordId: line.codeFixId,
        oldValue: { line: lineId, status: line.status },
        newValue: { line: lineId, status },
      },
    ]);
  });

  revalidatePath("/code-fixes");
  return { ok: true, id: line.codeFixId };
}

/** Deletes a whole entry and its lines. Anyone with the card may delete. */
export async function deleteCodeFix(id: number): Promise<CodeFixActionResult> {
  const user = await requireRole("rep", "buyer");

  const deleted = await db.transaction(async (tx) => {
    const [before] = await tx.select().from(codeFixes).where(eq(codeFixes.id, id));
    if (!before) return false;
    const lines = await tx.select().from(codeFixLines).where(eq(codeFixLines.codeFixId, id));
    await tx.delete(codeFixes).where(eq(codeFixes.id, id)); // lines cascade
    await logAudit(tx, user, [
      {
        action: "delete",
        recordType: "code_fix",
        recordId: id,
        oldValue: { client: before.clientName, note: before.note, lines },
      },
    ]);
    return true;
  });
  if (!deleted) return { ok: false, error: "That entry no longer exists." };

  revalidatePath("/code-fixes");
  return { ok: true, id };
}
