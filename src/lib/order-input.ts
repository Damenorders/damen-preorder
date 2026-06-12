// Shapes passed from the order form (client) to the server actions.
// Types only — safe to import on both sides.

import type { Department } from "@/db/schema";
import type { SpecsJson } from "@/lib/product-config";

export interface OrderLineInput {
  /** Present when editing an existing line; absent for new lines */
  id?: number;
  productId: number;
  specsJson: SpecsJson;
  quantity: number;
  /** Weight in KG — optional */
  weight: number | null;
  notes: string;
}

export interface OrderInput {
  department: Department;
  /** Free-typed client name — matched case-insensitively to an existing
   *  client, or auto-created as a new one (the client list learns itself). */
  clientName: string;
  /** YYYY-MM-DD */
  deliveryDate: string;
  notes: string;
  lines: OrderLineInput[];
}

export type ActionResult =
  | { ok: true; orderId: number }
  | { ok: false; error: string };
