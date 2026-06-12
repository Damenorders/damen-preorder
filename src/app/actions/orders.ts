"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  clients,
  orders,
  orderLines,
  products,
  type Product,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { logAudit, type AuditEntry } from "@/lib/audit";
import { notifyOrdersChanged } from "@/lib/realtime-server";
import { formatExternalId } from "@/db/external-id";
import { isDepartment } from "@/lib/labels";
import {
  formatSpecs,
  type ProductFormConfig,
  type SpecsJson,
} from "@/lib/product-config";
import type {
  ActionResult,
  OrderInput,
  OrderLineInput,
} from "@/lib/order-input";

// ---------------------------------------------------------------------------
// Validation — every line is checked against the product's form_config
// (SPEC.md §7–8), server-side; the UI is never trusted.
// ---------------------------------------------------------------------------

interface ValidLine {
  id?: number;
  product: Product;
  specs: string;
  specsJson: SpecsJson;
  quantity: number;
  weight: string;
  notes: string | null;
}

function validateLine(
  line: OrderLineInput,
  product: Product | undefined,
  departmentOk: (p: Product) => boolean,
): ValidLine | { error: string } {
  if (!product || !product.active || !departmentOk(product)) {
    return { error: "Unknown product on one of the lines." };
  }
  const config = product.formConfig as ProductFormConfig;

  const specsJson: SpecsJson = {};
  for (const field of config.fields) {
    const value = line.specsJson?.[field.key];
    if (value === undefined || value === "") {
      if (field.required !== false) {
        return { error: `${product.productName}: "${field.label}" is required.` };
      }
      continue;
    }
    if (!field.options.includes(value)) {
      return { error: `${product.productName}: invalid value for "${field.label}".` };
    }
    specsJson[field.key] = value;
  }

  const { min, max } = config.quantity ?? { min: 1, max: 20 };
  if (!Number.isInteger(line.quantity) || line.quantity < min || line.quantity > max) {
    return { error: `${product.productName}: quantity must be between ${min} and ${max}.` };
  }

  const weight = Number(line.weight);
  if (!Number.isFinite(weight) || weight <= 0) {
    return { error: `${product.productName}: weight must be a positive number.` };
  }

  return {
    id: line.id,
    product,
    specs: formatSpecs(config, specsJson),
    specsJson,
    quantity: line.quantity,
    weight: weight.toFixed(2),
    notes: line.notes?.trim() || null,
  };
}

type OrderValidation =
  | { valid: false; error: string }
  | { valid: true; client: typeof clients.$inferSelect; validLines: ValidLine[] };

async function validateOrderInput(input: OrderInput): Promise<OrderValidation> {
  if (!isDepartment(input.department)) {
    return { valid: false, error: "Invalid section." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.deliveryDate)) {
    return { valid: false, error: "Please choose a delivery date." };
  }
  if (!input.lines || input.lines.length === 0) {
    return { valid: false, error: "Add at least one product to the order." };
  }

  const client = await db.query.clients.findFirst({
    where: eq(clients.id, input.clientId),
  });
  if (!client || !client.active) {
    return { valid: false, error: "Please choose a client." };
  }

  const productRows = await db.query.products.findMany({
    where: inArray(products.id, [...new Set(input.lines.map((l) => l.productId))]),
  });
  const byId = new Map(productRows.map((p) => [p.id, p]));

  const validLines: ValidLine[] = [];
  for (const line of input.lines) {
    const result = validateLine(
      line,
      byId.get(line.productId),
      (p) => p.department === input.department,
    );
    if ("error" in result) return { valid: false, error: result.error };
    validLines.push(result);
  }

  return { valid: true, client, validLines };
}

// ---------------------------------------------------------------------------
// Create — reps, buyers, admins (SPEC.md §3: everyone fills forms)
// ---------------------------------------------------------------------------

export async function createOrder(input: OrderInput): Promise<ActionResult> {
  const user = await requireRole("rep", "buyer");

  const validated = await validateOrderInput(input);
  if (!validated.valid) return { ok: false, error: validated.error };
  const { client, validLines } = validated;

  const orderId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(orders)
      .values({
        department: input.department,
        clientName: client.clientName,
        clientExternalId: client.externalId,
        deliveryDate: input.deliveryDate,
        repUserId: user.id,
        repName: user.name,
        repEmail: user.email,
        notes: input.notes?.trim() || null,
      })
      .returning({ id: orders.id });

    await tx
      .update(orders)
      .set({ externalId: formatExternalId("order", created.id) })
      .where(eq(orders.id, created.id));

    for (const line of validLines) {
      const [createdLine] = await tx
        .insert(orderLines)
        .values({
          orderId: created.id,
          department: input.department,
          product: line.product.productName,
          specs: line.specs,
          specsJson: line.specsJson,
          quantity: line.quantity,
          weight: line.weight,
          notes: line.notes,
        })
        .returning({ id: orderLines.id });
      await tx
        .update(orderLines)
        .set({ externalId: formatExternalId("order_line", createdLine.id) })
        .where(eq(orderLines.id, createdLine.id));
    }

    await logAudit(tx, user, [
      {
        action: "create",
        recordType: "order",
        recordId: created.id,
        newValue: {
          client: client.clientName,
          deliveryDate: input.deliveryDate,
          lines: validLines.map((l) => ({
            product: l.product.productName,
            specs: l.specs,
            quantity: l.quantity,
            weight: l.weight,
          })),
        },
      },
    ]);

    return created.id;
  });

  revalidatePath(`/orders/${input.department}/submissions`);
  await notifyOrdersChanged();
  return { ok: true, orderId };
}

// ---------------------------------------------------------------------------
// Update — rep: own + Pending only (SPEC.md §16); buyer/admin: any order.
// Logs every changed field per SPEC.md §27.
// ---------------------------------------------------------------------------

export async function updateOrder(
  orderId: number,
  input: OrderInput,
): Promise<ActionResult> {
  const user = await requireRole("rep", "buyer");

  const existing = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
  });
  if (!existing) return { ok: false, error: "Order not found." };

  if (user.role === "rep") {
    if (existing.repUserId !== user.id) {
      return { ok: false, error: "You can only edit your own submissions." };
    }
    if (existing.submissionStatus !== "pending") {
      return { ok: false, error: "This order is no longer Pending and can't be edited." };
    }
  }
  if (input.department !== existing.department) {
    return { ok: false, error: "An order can't change section." };
  }

  const validated = await validateOrderInput(input);
  if (!validated.valid) return { ok: false, error: validated.error };
  const { client, validLines } = validated;

  const existingLines = await db.query.orderLines.findMany({
    where: eq(orderLines.orderId, orderId),
  });
  const existingById = new Map(existingLines.map((l) => [l.id, l]));

  // Lines sent with an id must belong to this order
  for (const line of validLines) {
    if (line.id !== undefined && !existingById.has(line.id)) {
      return { ok: false, error: "One of the lines does not belong to this order." };
    }
  }

  await db.transaction(async (tx) => {
    const audit: AuditEntry[] = [];
    const now = new Date();

    // --- Header changes ----------------------------------------------------
    if (existing.clientName !== client.clientName) {
      audit.push({
        action: "update:client",
        recordType: "order",
        recordId: orderId,
        oldValue: existing.clientName,
        newValue: client.clientName,
      });
    }
    if (existing.deliveryDate !== input.deliveryDate) {
      audit.push({
        action: "update:delivery_date",
        recordType: "order",
        recordId: orderId,
        oldValue: existing.deliveryDate,
        newValue: input.deliveryDate,
      });
    }
    const newNotes = input.notes?.trim() || null;
    if ((existing.notes ?? null) !== newNotes) {
      audit.push({
        action: "update:notes",
        recordType: "order",
        recordId: orderId,
        oldValue: existing.notes,
        newValue: newNotes,
      });
    }

    await tx
      .update(orders)
      .set({
        clientName: client.clientName,
        clientExternalId: client.externalId,
        deliveryDate: input.deliveryDate,
        notes: newNotes,
        updatedAt: now,
      })
      .where(eq(orders.id, orderId));

    // --- Removed lines -----------------------------------------------------
    const keptIds = new Set(
      validLines.filter((l) => l.id !== undefined).map((l) => l.id as number),
    );
    for (const old of existingLines) {
      if (!keptIds.has(old.id)) {
        await tx.delete(orderLines).where(eq(orderLines.id, old.id));
        audit.push({
          action: "delete",
          recordType: "order_line",
          recordId: old.id,
          oldValue: {
            product: old.product,
            specs: old.specs,
            quantity: old.quantity,
            weight: old.weight,
          },
        });
      }
    }

    // --- Updated + new lines -------------------------------------------------
    for (const line of validLines) {
      if (line.id !== undefined) {
        const old = existingById.get(line.id)!;
        const fieldChanges: Array<[string, unknown, unknown]> = [];
        if (old.product !== line.product.productName) {
          fieldChanges.push(["product", old.product, line.product.productName]);
        }
        if (old.specs !== line.specs) {
          fieldChanges.push(["specs", old.specs, line.specs]);
        }
        if (old.quantity !== line.quantity) {
          fieldChanges.push(["quantity", old.quantity, line.quantity]);
        }
        if ((old.weight ?? null) !== line.weight) {
          fieldChanges.push(["weight", old.weight, line.weight]);
        }
        if ((old.notes ?? null) !== line.notes) {
          fieldChanges.push(["notes", old.notes, line.notes]);
        }
        if (fieldChanges.length > 0) {
          await tx
            .update(orderLines)
            .set({
              product: line.product.productName,
              specs: line.specs,
              specsJson: line.specsJson,
              quantity: line.quantity,
              weight: line.weight,
              notes: line.notes,
              updatedAt: now,
            })
            .where(eq(orderLines.id, line.id));
          for (const [field, oldValue, newValue] of fieldChanges) {
            audit.push({
              action: `update:${field}`,
              recordType: "order_line",
              recordId: line.id,
              oldValue,
              newValue,
            });
          }
        }
      } else {
        const [createdLine] = await tx
          .insert(orderLines)
          .values({
            orderId,
            department: existing.department,
            product: line.product.productName,
            specs: line.specs,
            specsJson: line.specsJson,
            quantity: line.quantity,
            weight: line.weight,
            notes: line.notes,
          })
          .returning({ id: orderLines.id });
        await tx
          .update(orderLines)
          .set({ externalId: formatExternalId("order_line", createdLine.id) })
          .where(eq(orderLines.id, createdLine.id));
        audit.push({
          action: "create",
          recordType: "order_line",
          recordId: createdLine.id,
          newValue: {
            product: line.product.productName,
            specs: line.specs,
            quantity: line.quantity,
            weight: line.weight,
          },
        });
      }
    }

    await logAudit(tx, user, audit);
  });

  revalidatePath(`/orders/${existing.department}/submissions`);
  await notifyOrdersChanged();
  return { ok: true, orderId };
}
