import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  codeFixCatalog,
  codeFixes,
  codeFixLines,
  type CodeFix,
  type CodeFixLine,
} from "@/db/schema";
import type { CatalogItem } from "@/lib/code-fix";

export type CodeFixWithLines = CodeFix & { lines: CodeFixLine[] };

/** The whole template — small enough (~1,700 rows) to hand to the form. */
export async function getCodeFixCatalog(): Promise<CatalogItem[]> {
  return db
    .select({ sku: codeFixCatalog.sku, description: codeFixCatalog.description })
    .from(codeFixCatalog)
    .orderBy(asc(codeFixCatalog.description));
}

/** Client names used on this card — its own list, starting empty. */
export async function getCodeFixClientNames(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ clientName: codeFixes.clientName })
    .from(codeFixes)
    .orderBy(asc(codeFixes.clientName));
  return rows.map((r) => r.clientName);
}

async function withLines(entries: CodeFix[]): Promise<CodeFixWithLines[]> {
  if (entries.length === 0) return [];
  const lines = await db
    .select()
    .from(codeFixLines)
    .orderBy(asc(codeFixLines.position), asc(codeFixLines.id));
  const byEntry = new Map<number, CodeFixLine[]>();
  for (const l of lines) byEntry.set(l.codeFixId, [...(byEntry.get(l.codeFixId) ?? []), l]);
  return entries.map((e) => ({ ...e, lines: byEntry.get(e.id) ?? [] }));
}

/** Every entry, newest first, with its lines in the order they were entered. */
export async function getCodeFixes(): Promise<CodeFixWithLines[]> {
  const entries = await db.select().from(codeFixes).orderBy(desc(codeFixes.createdAt));
  return withLines(entries);
}

export async function getCodeFix(id: number): Promise<CodeFixWithLines | null> {
  const [entry] = await db.select().from(codeFixes).where(eq(codeFixes.id, id));
  if (!entry) return null;
  const lines = await db
    .select()
    .from(codeFixLines)
    .where(eq(codeFixLines.codeFixId, id))
    .orderBy(asc(codeFixLines.position), asc(codeFixLines.id));
  return { ...entry, lines };
}
