import type { OdooWarehouseUnit } from "@/db/odoo-inventory-schema";

// Names the Odoo Inventory shows for its areas and floor-storage spots. The
// same labels public/odoo-inventory/odoo-locator.js draws, so the Activity log
// and the export read exactly like the screen.

export const ODOO_UNITS: OdooWarehouseUnit[] = ["dry", "freezer", "fridge40", "fridge50", "fridge60", "meatfridge", "fishfridge"];

/** The fridges that are one location each: no racks, a single floor area 'main'. */
export const ODOO_FRIDGES: OdooWarehouseUnit[] = ["meatfridge", "fishfridge"];

export const ODOO_UNIT_LABELS: Record<OdooWarehouseUnit, string> = {
  dry: "Dry Products",
  freezer: "Freezer",
  fridge40: "Fridge 40",
  fridge50: "Fridge 50",
  fridge60: "Fridge 60",
  meatfridge: "Meat Fridge",
  fishfridge: "Fish Fridge",
};

const FLOOR_LABELS: Record<OdooWarehouseUnit, Record<string, string>> = {
  dry: { "1": "Floor 1", "2": "Floor 2", "3": "Floor 3" },
  freezer: { returns: "Returns", floor1: "Floor 1", floor2: "Floor 2", floor3: "Floor 3" },
  fridge40: { floor2: "Floor #2", floor1: "Floor 1" },
  fridge50: { floor3: "Floor 3", floor2: "Floor 2", floor1: "Floor 1" },
  fridge60: { floor2: "Floor 2", floor1: "Floor 1" },
  meatfridge: { main: "Meat Fridge" },
  fishfridge: { main: "Fish Fridge" },
};

export function floorLabel(unit: OdooWarehouseUnit, floorId: string): string {
  return FLOOR_LABELS[unit]?.[floorId] ?? floorId;
}

/**
 * A stored location as the screen shows it. Rack slots drop the "a" of a
 * front pallet on a double-deep rack ("30-A-1a" → "30-A-1", "30-A-1b" stays),
 * floor areas use their name ("floor:returns" → "Returns").
 */
export function displayLocation(unit: OdooWarehouseUnit, location: string): string {
  if (location.startsWith("floor:")) return floorLabel(unit, location.slice(6));
  return location.replace(/(\d)a$/, "$1");
}
