/**
 * Order Book import, step 2 of 2: loads order-book/order-book-data.json into
 * the app's own tables through the data layer. Dry run unless --apply.
 *
 *   npx tsx --conditions=react-server scripts/import-order-book.ts          (dry run)
 *   npx tsx --conditions=react-server scripts/import-order-book.ts --apply
 *
 * What it does (decisions from 2026-09-17):
 *   - Suppliers are matched by name ignoring case, punctuation and spacing.
 *     A match is used as it is — never renamed, never overwritten, not even a
 *     blank contact filled in. Only a supplier with no match is created, with
 *     the contact and email from the file. "JFC" is the existing
 *     "JFC International" (SUPPLIER_OVERRIDES). A near miss with no override
 *     is skipped and reported.
 *   - Products become supplier links (item_sourcing) to the catalogue product
 *     named in order-book/import-mapping.csv (item_code column, reviewed by a
 *     person). A blank item_code is skipped. The Order Book pack is stored as
 *     the purchase pack; unit, cost and sell stay empty — nothing is derived.
 *   - A product already linked to that supplier is left exactly as it is.
 *   - Open order lines (toOrder), order settings (orderMeta) and past orders
 *     are not imported.
 * Re-running creates nothing new: every supplier and link it would create is
 * found on the second run.
 */

import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { readFileSync, writeFileSync } from "node:fs";

const DATA = "order-book/order-book-data.json";
const MAPPING = "order-book/import-mapping.csv";
const REPORT = "order-book/import-report.txt";
const BY = "Order Book import";

/** Order Book supplier name -> the existing app supplier it is. */
const SUPPLIER_OVERRIDES: Record<string, string> = {
  JFC: "JFC International",
};

interface ObSupplier {
  contact?: string;
  email?: string;
  products: Array<{ name: string; pack: string; cost: number | null; sell: number | null }>;
}

async function main() {
  const apply = process.argv.includes("--apply");

  // Imported lazily so dotenv has run before the database client is built.
  const { db } = await import("../src/db");
  const { and, eq, sql } = await import("drizzle-orm");
  const { auditLogs, inventoryItems, itemSourcing, suppliers } = await import("../src/db/schema");
  const { matchSupplierName, normalizeName, supplierKey } = await import("../src/lib/order-book-core");
  const { parseCsv } = await import("../src/lib/csv");
  const { formatExternalId } = await import("../src/db/external-id");

  const data = JSON.parse(readFileSync(DATA, "utf8")) as {
    suppliers: Record<string, ObSupplier>;
    toOrder?: Record<string, unknown[]>;
    pastOrders?: Array<{ items: unknown[] }>;
  };

  // The reviewed mapping: supplier + product + pack -> item_code.
  const [header, ...mappingRows] = parseCsv(readFileSync(MAPPING, "utf8"));
  const col = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`${MAPPING} has no "${name}" column`);
    return i;
  };
  const cSupplier = col("supplier");
  const cProduct = col("order_book_product");
  const cPack = col("order_book_pack");
  const cCode = col("item_code");
  const mapping = new Map<string, string>();
  for (const row of mappingRows) {
    if (row.length < header.length) continue;
    const key = `${supplierKey(row[cSupplier])}|${normalizeName(row[cProduct])}|${row[cPack].trim()}`;
    mapping.set(key, row[cCode].trim());
  }

  const report: string[] = [];
  const created: string[] = [];
  const matched: string[] = [];
  const skipped: string[] = [];

  await db.transaction(async (tx) => {
    // Nobody else creates suppliers or links while this runs.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('suppliers'))`);

    const allSuppliers = await tx.select().from(suppliers);
    const supplierIds = new Map<string, { id: number; name: string } | null>();

    // ---- Suppliers ---------------------------------------------------------
    for (const [obName, ob] of Object.entries(data.suppliers)) {
      const override = SUPPLIER_OVERRIDES[obName];
      if (override) {
        const target = allSuppliers.find((s) => s.name === override);
        if (!target) {
          skipped.push(`supplier ${obName}: override "${override}" is not on file`);
          supplierIds.set(obName, null);
        } else {
          matched.push(`supplier ${obName} -> existing "${target.name}" (#${target.id}, as decided)`);
          supplierIds.set(obName, { id: target.id, name: target.name });
        }
        continue;
      }

      const match = matchSupplierName(obName, allSuppliers);
      if (match.kind === "existing") {
        matched.push(`supplier ${obName} -> existing "${match.supplier.name}" (#${match.supplier.id}), left unchanged`);
        supplierIds.set(obName, { id: match.supplier.id, name: match.supplier.name });
      } else if (match.kind === "similar") {
        skipped.push(
          `supplier ${obName}: only similar to ${match.suppliers.map((s) => `"${s.name}"`).join(", ")} — not created; its products are skipped`,
        );
        supplierIds.set(obName, null);
      } else if (match.kind === "new") {
        const values = {
          name: obName,
          contact: (ob.contact ?? "").trim(),
          email: (ob.email ?? "").trim(),
        };
        if (apply) {
          const [row] = await tx.insert(suppliers).values(values).returning();
          await tx
            .update(suppliers)
            .set({ externalId: formatExternalId("supplier", row.id) })
            .where(eq(suppliers.id, row.id));
          await tx.insert(auditLogs).values({
            userId: null,
            userName: BY,
            action: "create",
            recordType: "supplier",
            recordId: String(row.id),
            newValue: { ...values, via: "order-book-import" },
          });
          allSuppliers.push(row);
          supplierIds.set(obName, { id: row.id, name: row.name });
          created.push(`supplier "${obName}" (#${row.id}) contact="${values.contact}" email="${values.email}"`);
        } else {
          supplierIds.set(obName, { id: -1, name: obName });
          created.push(`supplier "${obName}" contact="${values.contact}" email="${values.email}" (would create)`);
        }
      } else {
        skipped.push(`supplier with a blank name`);
        supplierIds.set(obName, null);
      }
    }

    // ---- Products -> supplier links ---------------------------------------
    for (const [obName, ob] of Object.entries(data.suppliers)) {
      const supplier = supplierIds.get(obName);
      for (const p of ob.products) {
        const label = `${obName} :: ${p.name}${p.pack ? ` [${p.pack}]` : ""}`;
        if (!supplier) {
          skipped.push(`product ${label}: supplier not imported`);
          continue;
        }
        const key = `${supplierKey(obName)}|${normalizeName(p.name)}|${p.pack.trim()}`;
        if (!mapping.has(key)) {
          skipped.push(`product ${label}: not in ${MAPPING}`);
          continue;
        }
        const code = mapping.get(key)!;
        if (!code) {
          skipped.push(`product ${label}: no catalogue code chosen in ${MAPPING}`);
          continue;
        }
        const [item] = await tx
          .select({ code: inventoryItems.code, name: inventoryItems.description })
          .from(inventoryItems)
          .where(eq(inventoryItems.code, code));
        if (!item) {
          skipped.push(`product ${label}: code ${code} is not in the catalogue`);
          continue;
        }

        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext('item_sourcing'), hashtext(${item.code}))`,
        );
        if (supplier.id > 0) {
          const [existing] = await tx
            .select({ pack: itemSourcing.purchasePack })
            .from(itemSourcing)
            .where(and(eq(itemSourcing.itemCode, item.code), eq(itemSourcing.supplierId, supplier.id)));
          if (existing) {
            matched.push(
              `product ${label} -> ${item.code} already linked to ${supplier.name} (pack "${existing.pack}"), left unchanged`,
            );
            continue;
          }
        }

        const [{ n }] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(itemSourcing)
          .where(and(eq(itemSourcing.itemCode, item.code), eq(itemSourcing.preferred, true)));
        const preferred = n === 0;
        const values = {
          itemCode: item.code,
          supplierId: supplier.id,
          purchasePack: p.pack.trim(),
          purchaseUnit: null,
          preferred,
          cost: null,
          sell: null,
          costSetOn: null,
          assignedByName: BY,
        };
        const note = `${item.code} "${item.name}", pack "${values.purchasePack}", unit/cost/sell empty${
          preferred ? "" : ", not the Buyer card's supplier (another link already is)"
        }`;
        if (apply) {
          await tx.insert(itemSourcing).values(values);
          await tx.insert(auditLogs).values({
            userId: null,
            userName: BY,
            action: "create",
            recordType: "item_sourcing",
            recordId: item.code,
            newValue: { supplierId: supplier.id, purchasePack: values.purchasePack, preferred, via: "order-book-import" },
          });
          created.push(`link ${label} -> ${note}`);
        } else {
          created.push(`link ${label} -> ${note} (would create)`);
        }
      }
    }

    // ---- Not imported, by decision ------------------------------------------
    const openLines = Object.values(data.toOrder ?? {}).reduce((n, l) => n + l.length, 0);
    const past = data.pastOrders ?? [];
    skipped.push(`open order lines: ${openLines} (not imported, as decided)`);
    skipped.push(
      `past orders: ${past.length} with ${past.reduce((n, o) => n + o.items.length, 0)} lines (not imported, as decided)`,
    );
    skipped.push(`cost and sell: all empty in the file, left empty`);
  });

  report.push(
    `Order Book import — ${apply ? "APPLIED" : "DRY RUN (nothing written)"} — ${new Date().toISOString()}`,
    "",
    `CREATED (${created.length})`,
    ...created.map((l) => `  + ${l}`),
    "",
    `MATCHED TO EXISTING (${matched.length})`,
    ...matched.map((l) => `  = ${l}`),
    "",
    `SKIPPED (${skipped.length})`,
    ...skipped.map((l) => `  - ${l}`),
    "",
  );
  const text = report.join("\n");
  console.log(text);
  writeFileSync(REPORT, text);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
