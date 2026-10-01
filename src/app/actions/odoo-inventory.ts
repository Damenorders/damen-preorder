"use server";

// Odoo Inventory — the odoo-locator client persists through the same kind of
// key/value bridge as the Warehouse Inventory (window.ODOO_STORAGE), backed by
// these actions. Everything here reads and writes the odoo_* tables only.
//
// Keys the client uses:
//   "rack-data"            → Dry Products rack placements
//   "<unit>-rack-data"     → rack placements for freezer / fridge40 / 50 / 60
//   "<unit>-floor-data"    → floor-storage placements
//   "<unit>-rack-rows"     → rack list (layout metadata, never stored)
//   "wh-audit-log"         → read-only; served from odoo_audit
//
// Saves go through writeOdooLocation only — one location per write, so two
// people counting at the same time can never wipe each other's work. The
// whole-warehouse blob write the Warehouse Inventory kept as a fallback is
// refused here.

import { revalidatePath } from "next/cache";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  odooAudit,
  odooItems,
  odooPlacements,
  type OdooWarehouseUnit,
  type User,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { getOdooAudit, getOdooFloorData, getOdooRackData } from "@/lib/odoo-inventory-data";
import { ODOO_UNITS, ODOO_UNIT_LABELS, displayLocation } from "@/lib/odoo-locations";
import {
  desiredFromOdooFloorBlob,
  desiredFromOdooRackBlob,
  pairMoves,
  planOdooSync,
  type OdooAuditRow,
  type OdooUnitAuditDraft,
  type OdooClientItem,
  type OdooDesired,
  type OdooCatalogProduct,
} from "@/lib/odoo-placement-sync";
import {
  cleanGrid,
  diffOdooCatalog,
  guessColumns,
  parseOdooCatalog,
  readSpreadsheet,
  type OdooCatalogDiff,
  type OdooCatalogParse,
} from "@/lib/odoo-catalog-file";

/** Admin always passes (requireRole); plus the two roles given the card. */
function requireOdooAccess() {
  return requireRole("buyer", "dispatch");
}

/** "freezer-rack-data" → {unit: "freezer", kind: "rack-data"}; bare keys are Dry Products. */
function parseKey(key: string): { unit: OdooWarehouseUnit; kind: string } | null {
  for (const unit of ODOO_UNITS) {
    if (unit !== "dry" && key.startsWith(`${unit}-`)) {
      return { unit, kind: key.slice(unit.length + 1) };
    }
  }
  if (/^(rack-data|floor-data|rack-rows)$/.test(key)) return { unit: "dry", kind: key };
  return null;
}

/** window.ODOO_STORAGE.get(key) */
export async function readOdooKey(key: string): Promise<{ value: string } | null> {
  await requireOdooAccess();
  if (key === "wh-audit-log") {
    return { value: JSON.stringify(await getOdooAudit(200)) };
  }
  const parsed = parseKey(key);
  if (!parsed) return null;
  if (parsed.kind === "rack-data") return { value: JSON.stringify(await getOdooRackData(parsed.unit)) };
  if (parsed.kind === "floor-data") return { value: JSON.stringify(await getOdooFloorData(parsed.unit)) };
  // rack-rows is layout metadata; the client falls back to its own defaults.
  return null;
}

/** window.ODOO_STORAGE.set(key, value) — only the harmless keys are accepted. */
export async function writeOdooKey(key: string): Promise<{ ok: boolean; error?: string }> {
  await requireOdooAccess();
  // The audit trail is written server-side; the client's copy is read-only.
  if (key === "wh-audit-log") return { ok: true };
  const parsed = parseKey(key);
  if (parsed?.kind === "rack-rows") return { ok: true };
  return { ok: false, error: "Whole-warehouse saves are not allowed — save one location at a time." };
}

/** Looks up every SKU a save mentions, ignoring case, in one query. */
async function skuResolver(items: OdooClientItem[]) {
  const wanted = [
    ...new Set(items.map((i) => String(i.sku ?? "").trim().toUpperCase()).filter(Boolean)),
  ];
  const found = new Map<string, OdooCatalogProduct>();
  if (wanted.length) {
    const rows = await db
      .select({ sku: odooItems.sku, description: odooItems.description })
      .from(odooItems)
      .where(inArray(sql`upper(${odooItems.sku})`, wanted));
    for (const r of rows) found.set(r.sku.toUpperCase(), r);
  }
  return (sku: string) => found.get(sku.trim().toUpperCase()) ?? null;
}

type LocationWrite = {
  unit: OdooWarehouseUnit;
  scope: "rack" | "floor";
  rackId?: string;
  slotCode?: string;
  floorId?: string;
  items: OdooClientItem[];
};
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Validates one location's payload into the rows it should hold. */
async function desiredFor(input: LocationWrite) {
  const { unit, scope, rackId, slotCode, floorId, items } = input;
  if (!ODOO_UNITS.includes(unit)) return { ok: false as const, error: `Unknown area ${unit}` };
  const list = Array.isArray(items) ? items : [];
  const resolveSku = await skuResolver(list);
  let result;
  if (scope === "rack") {
    if (!rackId || !slotCode) return { ok: false as const, error: "Missing rack location" };
    result = desiredFromOdooRackBlob({ [rackId]: { [slotCode]: list } }, resolveSku);
  } else if (scope === "floor") {
    if (!floorId) return { ok: false as const, error: "Missing floor area" };
    result = desiredFromOdooFloorBlob({ [floorId]: list }, resolveSku);
  } else {
    return { ok: false as const, error: `Unknown scope ${scope}` };
  }
  if (!result.ok) return { ok: false as const, error: result.error };
  return { ok: true as const, unit, scope, desired: result.desired, locations: result.locations };
}

/**
 * Applies one location's save inside the caller's transaction: insert /
 * update / delete only within the locations sent. Returns the audit drafts
 * rather than writing them, so a move can pair its two halves first.
 */
async function applyOdooSync(
  tx: Tx,
  user: User,
  unit: OdooWarehouseUnit,
  scope: "rack" | "floor",
  desired: OdooDesired[],
  scopeLocations: Set<string>,
): Promise<OdooUnitAuditDraft[]> {
  const existing = await tx.select().from(odooPlacements).where(eq(odooPlacements.unit, unit));
  const plan = planOdooSync(existing, scope, desired, scopeLocations);

  for (const d of plan.inserts) {
    await tx.insert(odooPlacements).values({
      unit,
      location: d.location,
      rack: d.rack,
      level: d.level,
      position: d.position,
      floorId: d.floorId,
      itemKey: d.itemKey,
      sku: d.sku,
      description: d.description,
      quantity: d.quantity,
      quantityUnit: d.quantityUnit,
      consignment: d.consignment,
      updatedBy: user.id,
    });
  }
  for (const u of plan.updates) {
    await tx
      .update(odooPlacements)
      .set({
        quantity: u.quantity,
        quantityUnit: u.quantityUnit,
        description: u.description,
        consignment: u.consignment,
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(odooPlacements.id, u.id));
  }
  if (plan.deleteIds.length) {
    await tx.delete(odooPlacements).where(inArray(odooPlacements.id, plan.deleteIds));
  }
  return plan.audits.map((a) => ({ ...a, unit }));
}

async function insertAudits(tx: Tx, user: User, rows: OdooAuditRow[]) {
  if (!rows.length) return;
  await tx.insert(odooAudit).values(
    rows.map((a) => ({
      action: a.action,
      unit: a.unit as OdooWarehouseUnit,
      sku: a.sku,
      description: a.description,
      location: a.location ?? null,
      fromLocation: a.fromLocation ?? null,
      toLocation: a.toLocation ?? null,
      quantity: a.quantity,
      quantityUnit: a.quantityUnit,
      prevQuantity: "prevQuantity" in a ? a.prevQuantity : undefined,
      prevQuantityUnit: "prevQuantityUnit" in a ? a.prevQuantityUnit : undefined,
      consignment: a.consignment,
      userId: user.id,
      userName: user.name,
    })),
  );
}

/**
 * Targeted, transactional write of ONE location — a rack slot ("50-A-1") or
 * a floor area ("floor:2"). How every count, edit and removal is saved.
 */
export async function writeOdooLocation(input: LocationWrite): Promise<{ ok: boolean; error?: string }> {
  const user = await requireOdooAccess();
  const d = await desiredFor(input);
  if (!d.ok) return { ok: false, error: d.error };
  try {
    await db.transaction(async (tx) => {
      const audits = await applyOdooSync(tx, user, d.unit, d.scope, d.desired, d.locations);
      await insertAudits(tx, user, audits);
    });
  } catch (err) {
    console.error("Odoo inventory save failed", err);
    return { ok: false, error: "The save did not go through — try again." };
  }
  revalidatePath("/odoo-inventory");
  return { ok: true };
}

/**
 * A move: the location gaining the pallet/product and the one losing it,
 * written together in ONE transaction — both happen or neither does, so a
 * move can never leave a pallet in two places or in none. The two halves are
 * logged as "moved" (from → to) instead of "removed" + "added".
 */
export async function writeOdooMove(
  target: LocationWrite,
  source: LocationWrite,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireOdooAccess();
  const t = await desiredFor(target);
  if (!t.ok) return { ok: false, error: t.error };
  const s = await desiredFor(source);
  if (!s.ok) return { ok: false, error: s.error };
  const crossArea = t.unit !== s.unit;
  const label = (unit: string, location: string) => {
    const u = unit as OdooWarehouseUnit;
    return displayLocation(u, location) + (crossArea ? ` (${ODOO_UNIT_LABELS[u]})` : "");
  };
  try {
    await db.transaction(async (tx) => {
      const audits = [
        ...(await applyOdooSync(tx, user, t.unit, t.scope, t.desired, t.locations)),
        ...(await applyOdooSync(tx, user, s.unit, s.scope, s.desired, s.locations)),
      ];
      await insertAudits(tx, user, pairMoves(audits, label));
    });
  } catch (err) {
    console.error("Odoo inventory move failed", err);
    return { ok: false, error: "The move did not go through — nothing was changed. Try again." };
  }
  revalidatePath("/odoo-inventory");
  return { ok: true };
}

/** Clears one area — the locator's "Reset all data" button. */
export async function clearOdooUnit(unit: OdooWarehouseUnit): Promise<{ ok: boolean; error?: string }> {
  const user = await requireOdooAccess();
  if (!ODOO_UNITS.includes(unit)) return { ok: false, error: `Unknown area ${unit}` };
  await db.transaction(async (tx) => {
    await tx.delete(odooPlacements).where(eq(odooPlacements.unit, unit));
    await tx.insert(odooAudit).values({
      action: "cleared",
      unit,
      description: `All pallet data for ${ODOO_UNIT_LABELS[unit]}`,
      userId: user.id,
      userName: user.name,
    });
  });
  revalidatePath("/odoo-inventory");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Odoo list upload: inspect (which columns?) → preview (what would change?)
// → apply. The file is sent again at each step, so nothing half-read is kept
// on the server between them.
// ---------------------------------------------------------------------------

const LIST_CAP = 300;

export type OdooUploadResult =
  | { ok: false; error: string }
  | {
      ok: true;
      stage: "columns";
      fileName: string;
      headers: string[];
      sample: string[][];
      guess: { skuCol: number; descCol: number };
    }
  | {
      ok: true;
      stage: "preview" | "applied";
      fileName: string;
      productCount: number;
      skipped: OdooCatalogParse["skipped"];
      conflicts: OdooCatalogParse["conflicts"];
      repeated: OdooCatalogParse["repeated"];
      sharedDescriptions: OdooCatalogParse["sharedDescriptions"];
      diff: Omit<OdooCatalogDiff, "unchanged"> & { unchanged: number };
      totals: { added: number; renamed: number; retired: number; restored: number; skipped: number; sharedDescriptions: number };
      /** Counted rows whose SKU this upload drops from the list. */
      countedRetired: number;
    };

const cap = <T,>(list: T[]) => list.slice(0, LIST_CAP);

function columnName(i: number) {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export async function odooCatalogUpload(formData: FormData): Promise<OdooUploadResult> {
  const user = await requireOdooAccess();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose the Odoo Excel file first." };
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: "That file is over 10 MB." };
  const mode = String(formData.get("mode") ?? "inspect");
  const hasHeader = formData.get("hasHeader") !== "0";

  const read = readSpreadsheet(Buffer.from(await file.arrayBuffer()), file.name);
  if (!read.ok) return { ok: false, error: read.error };
  const grid = cleanGrid(read.grid);
  if (!grid.length) return { ok: false, error: "That file is empty." };

  const width = Math.max(...grid.map((r) => r.length));
  const headers = Array.from({ length: width }, (_, i) =>
    hasHeader && grid[0][i] ? `${columnName(i)} — ${grid[0][i]}` : `Column ${columnName(i)}`,
  );
  const dataRows = hasHeader ? grid.slice(1) : grid;

  if (mode === "inspect") {
    return {
      ok: true,
      stage: "columns",
      fileName: file.name,
      headers,
      sample: dataRows.slice(0, 5),
      guess: hasHeader ? guessColumns(grid[0]) : { skuCol: -1, descCol: -1 },
    };
  }

  const skuCol = Number(formData.get("skuCol"));
  const descCol = Number(formData.get("descCol"));
  if (!Number.isInteger(skuCol) || !Number.isInteger(descCol) || skuCol < 0 || descCol < 0 || skuCol >= width || descCol >= width) {
    return { ok: false, error: "Pick the SKU column and the description column." };
  }
  if (skuCol === descCol) return { ok: false, error: "The SKU and description must be two different columns." };

  const parsed = parseOdooCatalog(dataRows, skuCol, descCol);
  if (!parsed.products.length && !parsed.conflicts.length) {
    return { ok: false, error: "No products found in those columns." };
  }

  const existing = await db
    .select({ sku: odooItems.sku, description: odooItems.description, active: odooItems.active })
    .from(odooItems);
  const diff = diffOdooCatalog(existing, parsed.products);

  const retiredSkus = diff.retired.map((r) => r.sku);
  let countedRetired = 0;
  if (retiredSkus.length) {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(odooPlacements)
      .where(inArray(odooPlacements.sku, retiredSkus));
    countedRetired = row?.n ?? 0;
  }

  const summary = {
    fileName: file.name,
    productCount: parsed.products.length,
    skipped: cap(parsed.skipped),
    conflicts: cap(parsed.conflicts),
    repeated: cap(parsed.repeated),
    sharedDescriptions: cap(parsed.sharedDescriptions),
    diff: {
      added: cap(diff.added),
      renamed: cap(diff.renamed),
      retired: cap(diff.retired),
      restored: cap(diff.restored),
      unchanged: diff.unchanged,
    },
    totals: {
      added: diff.added.length,
      renamed: diff.renamed.length,
      retired: diff.retired.length,
      restored: diff.restored.length,
      skipped: parsed.skipped.length,
      sharedDescriptions: parsed.sharedDescriptions.length,
    },
    countedRetired,
  };

  if (mode !== "apply") return { ok: true, stage: "preview", ...summary };

  if (parsed.conflicts.length) {
    return {
      ok: false,
      error: "Some SKUs appear twice with different descriptions. Fix them in the file, then upload again.",
    };
  }

  const CHUNK = 500;
  await db.transaction(async (tx) => {
    for (let i = 0; i < diff.added.length; i += CHUNK) {
      await tx.insert(odooItems).values(
        diff.added.slice(i, i + CHUNK).map((p) => ({ sku: p.sku, description: p.description, active: true })),
      );
    }
    // Every SKU in the file that already exists: take the file's wording and
    // make sure it is active. One statement per chunk, not one per SKU.
    const current = new Map(existing.map((e) => [e.sku.toUpperCase(), e]));
    const keep = parsed.products
      .map((p) => ({ e: current.get(p.sku.toUpperCase()), description: p.description }))
      .filter((x): x is { e: (typeof existing)[number]; description: string } => !!x.e)
      .filter((x) => !x.e.active || x.e.description !== x.description);
    for (let i = 0; i < keep.length; i += CHUNK) {
      const values = sql.join(
        keep.slice(i, i + CHUNK).map((x) => sql`(${x.e.sku}, ${x.description})`),
        sql`, `,
      );
      await tx.execute(sql`
        update odoo_items as i
           set description = v.d, active = true, updated_at = now()
          from (values ${values}) as v(s, d)
         where i.sku = v.s`);
    }
    for (let i = 0; i < retiredSkus.length; i += CHUNK) {
      await tx
        .update(odooItems)
        .set({ active: false, updatedAt: new Date() })
        .where(inArray(odooItems.sku, retiredSkus.slice(i, i + CHUNK)));
    }
    await tx.insert(odooAudit).values({
      action: "catalog",
      description:
        `${file.name}: ${parsed.products.length} products — ` +
        `${diff.added.length} new, ${diff.renamed.length} renamed, ` +
        `${diff.retired.length} no longer in list, ${diff.restored.length} back in list`,
      userId: user.id,
      userName: user.name,
    });
  });
  revalidatePath("/odoo-inventory");
  return { ok: true, stage: "applied", ...summary };
}

