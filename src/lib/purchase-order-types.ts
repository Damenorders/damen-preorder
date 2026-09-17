// Shared Purchase Order shapes. Pure types, kept out of the "use server"
// module (a type re-exported from one crashes on module evaluation) and free of
// server imports so client components can use them.

import type {
  PurchaseMethod,
  PurchaseUnit,
  SupplierProduct,
} from "@/lib/order-book-core";

/** A catalogue product as the buyer sees it before committing. */
export interface PurchaseHit {
  code: string;
  name: string;
  /** Purchase pack from sourcing; null when no supplier is assigned yet. */
  pack: string | null;
  unit: PurchaseUnit | null;
  supplierId: number | null;
  supplierName: string | null;
}

export interface SupplierOption {
  id: number;
  name: string;
  contact: string;
  email: string;
}

export interface AddLineInput {
  qty: string;
  unit: string;
  /** Set when the buyer picked a suggestion; otherwise `typed` is resolved. */
  itemCode?: string | null;
  typed: string;
  /** False while the unit box still shows its default. */
  unitChosen?: boolean;
}

export interface PlacedLine {
  supplierName: string;
  name: string;
  pack: string;
  unit: PurchaseUnit;
  /** The line's quantity after this add. */
  qty: number;
  /** True when it was added onto an existing line at the same unit. */
  merged: boolean;
}

export type Ask = {
  status: "ask";
  field: "qty" | "unit" | "product" | "purchasePack" | "purchaseUnit" | "supplier" | "code" | "description" | "section" | "cost" | "sell";
  message: string;
};

export type AddLineResult =
  | { status: "added"; line: PlacedLine }
  | Ask
  | { status: "needs-sourcing"; product: PurchaseHit }
  /** Found, but bought in a different unit than the untouched default: shown, not added. */
  | { status: "check-unit"; product: PurchaseHit }
  | { status: "choose"; typed: string; products: PurchaseHit[] }
  | { status: "similar"; typed: string; products: PurchaseHit[] }
  | { status: "none"; typed: string }
  | { status: "error"; message: string };

export interface AssignInput {
  itemCode: string;
  /** An existing supplier picked from the list… */
  supplierId?: number | null;
  /** …or a new one typed in. Matched against the list before anything is created. */
  newSupplier?: { name: string; contact: string; email: string } | null;
  /** The buyer saw the similar suppliers and still wants a new one. */
  confirmNewSupplier?: boolean;
  purchasePack: string;
  purchaseUnit: string;
  supplierSku: string;
  qty: string;
  unit: string;
}

export type AssignResult =
  | {
      status: "assigned";
      /** Set when a typed "new" supplier turned out to be one already on file. */
      matchedExisting: string | null;
      createdSupplier: boolean;
      line: PlacedLine;
    }
  | Ask
  | { status: "supplier-similar"; typed: string; suppliers: SupplierOption[] }
  | { status: "already-assigned"; product: PurchaseHit }
  | { status: "error"; message: string };

export interface CreateProductInput {
  code: string;
  description: string;
  section: string;
  /** The buyer saw the similar products and says this one is different. */
  confirmSimilar?: boolean;
}

export type CreateProductResult =
  | { status: "created"; product: PurchaseHit }
  | Ask
  | { status: "code-taken"; product: PurchaseHit }
  | { status: "duplicate"; products: PurchaseHit[] }
  | { status: "similar"; products: PurchaseHit[] }
  | { status: "error"; message: string };

export interface OrderLineView {
  id: string;
  itemCode: string;
  qty: number;
  unit: PurchaseUnit;
  nameAtTime: string;
  packAtTime: string;
  addedByName: string;
}

export interface OrderView {
  id: number;
  supplierId: number;
  supplierName: string;
  contact: string;
  email: string;
  status: "open" | "ordered";
  method: PurchaseMethod;
  /** YYYY-MM-DD, or "" when no date is set. */
  wantedFor: string;
  /** YYYY-MM-DD (Montreal) the order was marked ordered, or null. */
  orderedOn: string | null;
  orderedByName: string;
  lines: OrderLineView[];
}

export type PurchaseActionResult = { ok: true } | { ok: false; error: string };

export type MarkOrderedResult =
  | { ok: true; supplierName: string; date: string }
  | { ok: false; error: string };

export type UndoOrderResult =
  | { ok: true; supplierName: string }
  | { ok: false; error: string; openLines?: number };

// ---------------------------------------------------------------------------
// Suppliers view
// ---------------------------------------------------------------------------

export type SupplierEditResult =
  | {
      ok: true;
      /** Open purchase order lines that took the new wording or pack. */
      openLinesUpdated: number;
      /** Set when the price file will put its own wording back. */
      note: string | null;
    }
  | { ok: false; error: string };

export type PriceEditResult =
  | { ok: true; costSetOn: string | null }
  | { ok: false; error: string };

export interface AddSupplierProductInput {
  supplierId: number;
  /** A catalogue product picked from the search… */
  itemCode: string | null;
  /** …or the text typed, resolved against the catalogue. */
  typed: string;
  pack: string;
  unit: string;
  cost: string;
  sell: string;
  /** The answer to a "same product?" question. */
  decision?: { kind: "same"; sourcingId: string } | { kind: "separate" } | null;
}

export type AddSupplierProductResult =
  | { status: "added"; name: string; pack: string; preferred: boolean }
  | { status: "updated"; name: string; pack: string }
  | Ask
  | { status: "similar"; existing: SupplierProduct }
  | { status: "pack-conflict"; existing: SupplierProduct }
  | { status: "choose"; products: PurchaseHit[] }
  | { status: "similar-catalogue"; products: PurchaseHit[] }
  | { status: "none"; typed: string }
  | { status: "error"; message: string };

export type AddSupplierResult =
  | { status: "created"; supplier: SupplierOption }
  | { status: "existing"; supplier: SupplierOption }
  | { status: "similar"; typed: string; suppliers: SupplierOption[] }
  | Ask;

export interface OtherSupplierLink {
  sourcingId: string;
  supplierName: string;
  pack: string;
}

export type RemoveSupplierProductResult =
  | { ok: true }
  | { ok: false; error: string }
  /** It was the Buyer card's supplier and others remain: say which takes over. */
  | { ok: false; error: string; choosePreferred: OtherSupplierLink[] };
