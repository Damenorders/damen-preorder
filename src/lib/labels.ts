import type {
  Department,
  SubmissionStatus,
  BuyerTableStatus,
  ErrorType,
} from "@/db/schema";

// Order sections (SPEC.md §2) — orders only ever use these three.
export const DEPARTMENTS: Department[] = ["meat", "fish", "other"];

// Order Errors can additionally be attributed to the Warehouse, and use
// shorter department names than the order sections.
export const ERROR_DEPARTMENTS: Department[] = [
  "meat",
  "fish",
  "other",
  "warehouse",
];

export const errorDepartmentLabels: Record<Department, string> = {
  meat: "Meat",
  fish: "Fish",
  other: "Order Desk",
  warehouse: "Warehouse",
};

export const departmentLabels: Record<Department, string> = {
  meat: "Meat Orders",
  fish: "Fish Orders",
  other: "Other Preorders",
  warehouse: "Warehouse",
};

// Coloured corner accent on each order section's dashboard card, so they're
// easy to tell apart at a glance: meat red, fish blue, other orange.
export type CardCorner = {
  color: "red" | "blue" | "orange";
  position: "tl" | "tr";
};

export const departmentCardCorner: Record<Department, CardCorner> = {
  meat: { color: "red", position: "tl" },
  fish: { color: "blue", position: "tl" },
  other: { color: "orange", position: "tl" },
  warehouse: { color: "orange", position: "tl" },
};

export function isErrorDepartment(value: string): value is Department {
  return (ERROR_DEPARTMENTS as string[]).includes(value);
}

// SPEC.md §11
export const submissionStatusLabels: Record<SubmissionStatus, string> = {
  pending: "Pending",
  ready: "Ready",
  shipped: "Shipped",
};

// SPEC.md §12
export const buyerTableStatusLabels: Record<BuyerTableStatus, string> = {
  pending: "Pending",
  ordered: "Ordered",
  received: "Received",
  pending_delivery: "Pending Delivery",
  pending_pickup: "Pending Pickup",
};

export function isDepartment(value: string): value is Department {
  return (DEPARTMENTS as string[]).includes(value);
}

// Order Errors form
export const ERROR_TYPES: ErrorType[] = [
  "wrong_item",
  "not_delivered",
  "damaged_product",
  "not_scheduled",
  "shorted_items",
];

export const errorTypeLabels: Record<ErrorType, string> = {
  wrong_item: "Wrong item Shipped",
  not_delivered: "Not Delivered",
  damaged_product: "Damaged Product",
  not_scheduled: "Not Scheduled",
  shorted_items: "Shorted Items",
};

export function isErrorType(value: string): value is ErrorType {
  return (ERROR_TYPES as string[]).includes(value);
}
