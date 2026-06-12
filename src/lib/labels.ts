import type {
  Department,
  SubmissionStatus,
  BuyerTableStatus,
} from "@/db/schema";

export const DEPARTMENTS: Department[] = ["meat", "fish", "other"];

// SPEC.md §2
export const departmentLabels: Record<Department, string> = {
  meat: "Meat Orders",
  fish: "Fish Orders",
  other: "Other Preorders",
};

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
