"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  orders,
  orderLines,
  products,
  type Product,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { logAudit, type AuditEntry } from "@/lib/audit";
import { resolveClient } from "@/lib/clients";
import { notifyOrdersChanged } from "@/lib/realtime-server";
import { formatExternalId } from "@/db/external-id";
import { isDepartment } from "@/lib/labels";
import {
  formatSpecs,
  isFieldVisible,
  isQuantityVisible,
  isWeightVisible,
  quantityLabelFor,
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
  quantity: number | null;
  weight: string | null;
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
    // Skip fields hidden by an unmet showWhen condition, and read-only info
    // fields (their value is fixed and recorded by formatSpecs).
    if (!isFieldVisible(field, specsJson)) continue;
    if (field.type === "info") continue;
    const raw = line.specsJson?.[field.key];
    const value = typeof raw === "string" ? raw.trim() : "";
    if (value === "") {
      if (field.required !== false) {
        return { error: `${product.productName}: "${field.label}" is required.` };
      }
      continue;
    }
    if (field.type === "text") {
      if (value.length > 300) {
        return { error: `${product.productName}: "${field.label}" is too long (max 300 characters).` };
      }
    } else if (!field.options?.includes(value)) {
      return { error: `${product.productName}: invalid value for "${field.label}".` };
    }
    specsJson[field.key] = value;
  }

  // Quantity applies only to products configured with a piece count. Products
  // without one store null; an optional count left blank also stores null.
  const quantityLabel = quantityLabelFor(config, specsJson);
  let quantity: number | null = null;
  if (isQuantityVisible(config, specsJson) && config.quantity) {
    const hasValue = line.quantity !== null && line.quantity !== undefined;
    if (!hasValue) {
      if (!config.quantityOptional) {
        return { error: `${product.productName}: ${quantityLabel} is required.` };
      }
    } else {
      const { min, max } = config.quantity;
      if (!Number.isInteger(line.quantity) || line.quantity! < min || line.quantity! > max) {
        return { error: `${product.productName}: ${quantityLabel} must be between ${min} and ${max}.` };
      }
      quantity = line.quantity!;
    }
  }

  // Weight: only when visible (respects hideWeight + weightShowWhen). Required
  // when the product says so, positive when provided; ignored if hidden.
  const weightLabel = config.weightLabel ?? "weight";
  let weight: string | null = null;
  if (isWeightVisible(config, specsJson)) {
    if (line.weight !== null && line.weight !== undefined) {
      const w = Number(line.weight);
      if (!Number.isFinite(w) || w <= 0) {
        return { error: `${product.productName}: ${weightLabel} must be a positive number.` };
      }
      weight = w.toFixed(2);
    } else if (config.weightRequired) {
      return { error: `${product.productName}: ${weightLabel} is required.` };
    }
  }

  return {
    id: line.id,
    product,
    specs: formatSpecs(config, specsJson),
    specsJson,
    quantity,
    weight,
    notes: line.notes?.trim() || null,
  };
}

type OrderValidation =
  | { valid: false; error: string }
  | { valid: true; clientName: string; validLines: ValidLine[] };

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

  const clientName = input.clientName?.trim();
  if (!clientName) {
    return { valid: false, error: "Please enter a client name." };
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

  return { valid: true, clientName, validLines };
}

// ---------------------------------------------------------------------------
// Create — reps, buyers, admins (SPEC.md §3: everyone fills forms)
// ---------------------------------------------------------------------------

export async function createOrder(input: OrderInput): Promise<ActionResult> {
  const user = await requireRole("rep", "buyer");

  const validated = await validateOrderInput(input);
  if (!validated.valid) return { ok: false, error: validated.error };
  const { validLines } = validated;
  const client = await resolveClient(validated.clientName, user);

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
        // every new order starts Pending in both workflows (SPEC.md §11–12)
        submissionStatus: "pending",
        buyerTableStatus: "pending",
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
// Quick weight edit from the submissions page. Buyer/admin/scheduling: any
// order; rep: only own + Pending (SPEC.md §16).
// ---------------------------------------------------------------------------

export async function updateLineWeight(
  lineId: number,
  weight: number,
): Promise<ActionResult> {
  const user = await requireRole("rep", "buyer", "scheduling", "picker");

  if (!Number.isFinite(weight) || weight <= 0) {
    return { ok: false, error: "Weight must be a positive number." };
  }

  const line = await db.query.orderLines.findFirst({
    where: eq(orderLines.id, lineId),
  });
  if (!line) return { ok: false, error: "Line not found." };
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, line.orderId),
  });
  if (!order) return { ok: false, error: "Order not found." };

  if (user.role === "rep") {
    if (order.repUserId !== user.id) {
      return { ok: false, error: "You can only edit your own submissions." };
    }
    if (order.submissionStatus !== "pending") {
      return { ok: false, error: "This order is no longer Pending and can't be edited." };
    }
  }

  const newWeight = weight.toFixed(2);
  if ((line.weight ?? null) === newWeight) return { ok: true, orderId: order.id };

  await db.transaction(async (tx) => {
    const now = new Date();
    await tx
      .update(orderLines)
      .set({ weight: newWeight, updatedAt: now })
      .where(eq(orderLines.id, lineId));
    await tx
      .update(orders)
      .set({ updatedAt: now, editedAt: now, editSummary: "weight" })
      .where(eq(orders.id, order.id));
    await logAudit(tx, user, [
      {
        action: "update:weight",
        recordType: "order_line",
        recordId: lineId,
        oldValue: line.weight,
        newValue: newWeight,
      },
    ]);
  });

  revalidatePath(`/orders/${order.department}/submissions`);
  await notifyOrdersChanged();
  return { ok: true, orderId: order.id };
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
  const { validLines } = validated;
  const client = await resolveClient(validated.clientName, user);

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

    // Flag the order as edited (Edit form only) and record a short summary of
    // what changed, for the "Edited" pill on the submission card.
    if (audit.length > 0) {
      const labels: string[] = [];
      const add = (l: string) => {
        if (!labels.includes(l)) labels.push(l);
      };
      for (const e of audit) {
        if (e.recordType === "order") {
          if (e.action === "update:client") add("client");
          else if (e.action === "update:delivery_date") add("delivery date");
          else if (e.action === "update:notes") add("order notes");
        } else {
          if (e.action === "create") add("added item");
          else if (e.action === "delete") add("removed item");
          else if (e.action === "update:product") add("product");
          else if (e.action === "update:specs") add("specs");
          else if (e.action === "update:quantity") add("quantity");
          else if (e.action === "update:weight") add("weight");
          else if (e.action === "update:notes") add("item notes");
        }
      }
      await tx
        .update(orders)
        .set({ editedAt: now, editSummary: labels.join(", ") })
        .where(eq(orders.id, orderId));
    }

    await logAudit(tx, user, audit);
  });

  revalidatePath(`/orders/${existing.department}/submissions`);
  await notifyOrdersChanged();
  return { ok: true, orderId };
}

// ---------------------------------------------------------------------------
// Delete — buyer/admin only. Removes the order and its lines (cascade).
// ---------------------------------------------------------------------------

export async function deleteOrder(orderId: number): Promise<ActionResult> {
  const user = await requireRole("buyer"); // admins pass

  const existing = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
  });
  if (!existing) return { ok: false, error: "Order not found." };

  await db.transaction(async (tx) => {
    const lines = await tx.query.orderLines.findMany({
      where: eq(orderLines.orderId, orderId),
    });
    // order_lines have ON DELETE CASCADE, so deleting the order clears them.
    await tx.delete(orders).where(eq(orders.id, orderId));
    await logAudit(tx, user, [
      {
        action: "delete",
        recordType: "order",
        recordId: orderId,
        oldValue: {
          client: existing.clientName,
          deliveryDate: existing.deliveryDate,
          lines: lines.map((l) => ({
            product: l.product,
            specs: l.specs,
            quantity: l.quantity,
            weight: l.weight,
          })),
        },
      },
    ]);
  });

  revalidatePath(`/orders/${existing.department}/submissions`);
  revalidatePath("/orders/submissions");
  revalidatePath("/buyer/submissions");
  revalidatePath("/buyer/table");
  await notifyOrdersChanged();
  return { ok: true, orderId };
}
