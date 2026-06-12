// Dynamic product form definitions — SPEC.md §7–8, §25.
//
// Each product row stores a ProductFormConfig in products.form_config.
// The fill form renders ONLY these fields once a product is chosen; nothing
// is hardcoded in JSX, so Meat/Fish/Other inputs can be adjusted later by
// editing product rows, not code.

export interface ProductField {
  /** Key used in specs_json, e.g. "size", "skin", "headAndSkin" */
  key: string;
  /** Label shown above the input, e.g. "Head & Skin" */
  label: string;
  /** "select" renders option chips; "text" renders a free-text input */
  type: "select" | "text";
  /** Choices for select fields; unused for text fields */
  options?: string[];
  required?: boolean;
  /**
   * Template for the readable specs string (SPEC.md §25), with {value}
   * substituted. Examples that produce
   * "10/12 · Skin On · Bone Off · Deep Clean · Head & Skin Yes":
   *   size →        "{value}"
   *   skin →        "Skin {value}"
   *   bone →        "Bone {value}"
   *   clean →       "{value} Clean"
   *   headAndSkin → "Head & Skin {value}"
   */
  display: string;
}

export interface ProductFormConfig {
  fields: ProductField[];
  /**
   * Bounds for the piece-count Quantity input (SPEC.md §8: 1–20).
   * null → no quantity input for this product (stored as 1); used by meats,
   * which are ordered purely by KG via the weight input.
   */
  quantity: { min: number; max: number } | null;
  /** Label for the weight input (default "Weight (kg)"); meats use "Quantity (KG)" */
  weightLabel?: string;
  /** Weight must be filled in (meats); default false */
  weightRequired?: boolean;
  /** Hide the weight input entirely (free-text Other orders) */
  hideWeight?: boolean;
  /** Hide the line-notes input */
  hideNotes?: boolean;
}

export type SpecsJson = Record<string, string>;

/**
 * Validates admin-entered JSON for a product's form definition.
 * Returns a normalized config or a human-readable error.
 */
export function parseFormConfig(
  json: string,
): { ok: true; config: ProductFormConfig } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: "Not valid JSON." };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "Config must be a JSON object." };
  }
  const cfg = raw as Record<string, unknown>;

  if (!Array.isArray(cfg.fields)) {
    return { ok: false, error: '"fields" must be an array (use [] for none).' };
  }
  const seenKeys = new Set<string>();
  for (const [i, f] of (cfg.fields as unknown[]).entries()) {
    const field = f as Record<string, unknown>;
    const where = `fields[${i}]`;
    if (typeof field?.key !== "string" || !field.key.trim()) {
      return { ok: false, error: `${where}: "key" is required.` };
    }
    if (seenKeys.has(field.key)) {
      return { ok: false, error: `${where}: duplicate key "${field.key}".` };
    }
    seenKeys.add(field.key);
    if (typeof field.label !== "string" || !field.label.trim()) {
      return { ok: false, error: `${where}: "label" is required.` };
    }
    if (field.type !== "select" && field.type !== "text") {
      return { ok: false, error: `${where}: "type" must be "select" or "text".` };
    }
    if (field.type === "select") {
      if (
        !Array.isArray(field.options) ||
        field.options.length === 0 ||
        field.options.some((o) => typeof o !== "string" || !o.trim())
      ) {
        return { ok: false, error: `${where}: select fields need an "options" list of texts.` };
      }
    }
    if (typeof field.display !== "string" || !field.display.trim()) {
      return { ok: false, error: `${where}: "display" is required (e.g. "Skin {value}").` };
    }
    if (field.required !== undefined && typeof field.required !== "boolean") {
      return { ok: false, error: `${where}: "required" must be true or false.` };
    }
  }

  if (cfg.quantity !== null && cfg.quantity !== undefined) {
    const q = cfg.quantity as Record<string, unknown>;
    if (
      typeof q !== "object" ||
      !Number.isInteger(q.min) ||
      !Number.isInteger(q.max) ||
      (q.min as number) < 1 ||
      (q.max as number) < (q.min as number)
    ) {
      return {
        ok: false,
        error: '"quantity" must be null or {"min": 1, "max": 20} with max ≥ min ≥ 1.',
      };
    }
  }
  for (const flag of ["weightRequired", "hideWeight", "hideNotes"] as const) {
    if (cfg[flag] !== undefined && typeof cfg[flag] !== "boolean") {
      return { ok: false, error: `"${flag}" must be true or false.` };
    }
  }
  if (cfg.weightLabel !== undefined && typeof cfg.weightLabel !== "string") {
    return { ok: false, error: '"weightLabel" must be text.' };
  }

  return {
    ok: true,
    config: {
      fields: cfg.fields as ProductField[],
      quantity: (cfg.quantity ?? null) as ProductFormConfig["quantity"],
      ...(cfg.weightLabel !== undefined ? { weightLabel: cfg.weightLabel as string } : {}),
      ...(cfg.weightRequired !== undefined ? { weightRequired: cfg.weightRequired as boolean } : {}),
      ...(cfg.hideWeight !== undefined ? { hideWeight: cfg.hideWeight as boolean } : {}),
      ...(cfg.hideNotes !== undefined ? { hideNotes: cfg.hideNotes as boolean } : {}),
    },
  };
}

/**
 * Builds the readable specs string from structured specs (SPEC.md §25).
 * Field order in the config drives display order.
 */
export function formatSpecs(
  config: ProductFormConfig,
  specsJson: SpecsJson,
): string {
  return config.fields
    .map((field) => {
      const value = specsJson[field.key];
      if (value === undefined || value === "") return null;
      return field.display.replace("{value}", value);
    })
    .filter((part): part is string => part !== null)
    .join(" · ");
}
