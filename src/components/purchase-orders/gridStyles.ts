// Spreadsheet look shared by the Purchase Orders lists: one tight line per
// row, rows striped white / light grey for scanning, and edit boxes that read
// as plain cells until hovered or focused. Phones keep 16px text so iOS
// doesn't zoom in on focus; larger screens get 14px.

export const zebra = "odd:bg-white even:bg-neutral-100 hover:bg-accent-50";
export const td = "px-1.5 py-0.5 align-middle";
export const th = "px-1.5 py-1 font-medium";
export const gridInput =
  "h-7 rounded border border-transparent bg-transparent px-1 text-base sm:text-sm hover:border-neutral-300 focus:border-accent-600 focus:bg-white focus:outline-none";
// Reads as plain text beside the quantity it belongs to — no box, no native
// arrow — until hovered or focused, which is when it shows it can be changed.
export const gridSelect =
  "h-7 cursor-pointer appearance-none rounded border border-transparent bg-transparent px-1 text-base sm:text-sm hover:border-neutral-300 focus:border-accent-600 focus:bg-white focus:outline-none";
export const gridButton =
  "h-7 w-7 shrink-0 rounded text-base leading-none text-neutral-400 hover:bg-neutral-200 hover:text-red-700";
