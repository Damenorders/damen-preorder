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
  /**
   * "select" renders option chips; "text" renders a free-text input;
   * "info" is a read-only auto value (no input) — used for fixed facts like
   * Cod USA = "Fillets · 10 lb box". Its `text` is recorded in the spec string.
   */
  type: "select" | "text" | "info";
  /** Choices for select fields; unused for text/info fields */
  options?: string[];
  /** Fixed value for "info" fields (recorded into the spec string) */
  text?: string;
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
  /**
   * Conditional visibility: only show (and require/record) this field when
   * another field equals a given value. e.g. Ribeye "Size" only appears when
   * "Cut" equals "Portioned".
   */
  showWhen?: { field: string; equals: string };
}

/**
 * Whether a conditional field should be shown, given the current answers.
 * Fields without a showWhen are always visible.
 */
export function isFieldVisible(
  field: ProductField,
  specsJson: SpecsJson,
): boolean {
  if (!field.showWhen) return true;
  return specsJson[field.showWhen.field] === field.showWhen.equals;
}

/**
 * Whether the quantity input should be shown for the current answers.
 * Needs a quantity config, then respects the optional quantityShowWhen.
 */
export function isQuantityVisible(
  config: ProductFormConfig,
  specsJson: SpecsJson,
): boolean {
  if (!config.quantity) return false;
  if (!config.quantityShowWhen) return true;
  const value = specsJson[config.quantityShowWhen.field];
  const { equals } = config.quantityShowWhen;
  return Array.isArray(equals) ? equals.includes(value) : value === equals;
}

/** The quantity input's label for the current answers (quantityLabelWhen). */
export function quantityLabelFor(
  config: ProductFormConfig,
  specsJson: SpecsJson,
): string {
  if (config.quantityLabelWhen) {
    const matched =
      config.quantityLabelWhen.map[specsJson[config.quantityLabelWhen.field]];
    if (matched) return matched;
  }
  return config.quantityLabel ?? "Quantity";
}

/**
 * Whether the weight input should be shown for the current answers.
 * Respects hideWeight and the optional weightShowWhen condition.
 */
export function isWeightVisible(
  config: ProductFormConfig,
  specsJson: SpecsJson,
): boolean {
  if (config.hideWeight) return false;
  if (!config.weightShowWhen) return true;
  return specsJson[config.weightShowWhen.field] === config.weightShowWhen.equals;
}

export interface ProductFormConfig {
  fields: ProductField[];
  /**
   * Bounds for the piece-count Quantity input (SPEC.md §8: 1–20).
   * null → no quantity input for this product (stored as null); used by meats,
   * which are ordered purely by KG via the weight input.
   */
  quantity: { min: number; max: number } | null;
  /** Label for the quantity input (default "Quantity"); e.g. "Number of Lobsters" */
  quantityLabel?: string;
  /**
   * Vary the quantity label by another field's value, e.g. Cod shows
   * "Number of boxes" for USA and "Quantity of Fish" for Icelandic. Falls back
   * to quantityLabel when no value matches.
   */
  quantityLabelWhen?: { field: string; map: Record<string, string> };
  /** Quantity may be left blank (stored as null); default false (required) */
  quantityOptional?: boolean;
  /**
   * Show the quantity input only when another field equals a value (or one of
   * several values), e.g. Cod count appears once Type is USA or Icelandic.
   * Without this, quantity follows the quantity bounds alone.
   */
  quantityShowWhen?: { field: string; equals: string | string[] };
  /** Label for the weight input (default "Weight (kg)"); meats use "Quantity (KG)" */
  weightLabel?: string;
  /** Weight must be filled in (meats); default false */
  weightRequired?: boolean;
  /** Hide the weight input entirely (free-text Other orders) */
  hideWeight?: boolean;
  /**
   * Show the weight input only when another field equals a value, e.g. Cod
   * weight (lbs) appears only when Type = "USA". Without this, weight follows
   * hideWeight alone.
   */
  weightShowWhen?: { field: string; equals: string };
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
    if (field.type !== "select" && field.type !== "text" && field.type !== "info") {
      return { ok: false, error: `${where}: "type" must be "select", "text" or "info".` };
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
    if (field.type === "info") {
      if (typeof field.text !== "string" || !field.text.trim()) {
        return { ok: false, error: `${where}: info fields need a "text" value.` };
      }
    }
    if (typeof field.display !== "string" || !field.display.trim()) {
      return { ok: false, error: `${where}: "display" is required (e.g. "Skin {value}").` };
    }
    if (field.required !== undefined && typeof field.required !== "boolean") {
      return { ok: false, error: `${where}: "required" must be true or false.` };
    }
    if (field.showWhen !== undefined) {
      const sw = field.showWhen as Record<string, unknown>;
      if (
        typeof sw !== "object" ||
        sw === null ||
        typeof sw.field !== "string" ||
        !sw.field.trim() ||
        typeof sw.equals !== "string"
      ) {
        return {
          ok: false,
          error: `${where}: "showWhen" must be {"field": "<key>", "equals": "<value>"}.`,
        };
      }
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
  for (const flag of ["quantityOptional", "weightRequired", "hideWeight", "hideNotes"] as const) {
    if (cfg[flag] !== undefined && typeof cfg[flag] !== "boolean") {
      return { ok: false, error: `"${flag}" must be true or false.` };
    }
  }
  for (const label of ["quantityLabel", "weightLabel"] as const) {
    if (cfg[label] !== undefined && typeof cfg[label] !== "string") {
      return { ok: false, error: `"${label}" must be text.` };
    }
  }
  for (const cond of ["quantityShowWhen", "weightShowWhen"] as const) {
    if (cfg[cond] === undefined) continue;
    const sw = cfg[cond] as Record<string, unknown>;
    const equalsOk =
      typeof sw.equals === "string" ||
      (Array.isArray(sw.equals) &&
        sw.equals.length > 0 &&
        sw.equals.every((e) => typeof e === "string"));
    if (
      typeof sw !== "object" ||
      sw === null ||
      typeof sw.field !== "string" ||
      !sw.field.trim() ||
      !equalsOk
    ) {
      return {
        ok: false,
        error: `"${cond}" must be {"field": "<key>", "equals": "<value>" | ["<value>"...]}.`,
      };
    }
  }
  if (cfg.quantityLabelWhen !== undefined) {
    const lw = cfg.quantityLabelWhen as Record<string, unknown>;
    const mapOk =
      typeof lw.map === "object" &&
      lw.map !== null &&
      !Array.isArray(lw.map) &&
      Object.values(lw.map as Record<string, unknown>).every(
        (v) => typeof v === "string",
      );
    if (typeof lw !== "object" || lw === null || typeof lw.field !== "string" || !lw.field.trim() || !mapOk) {
      return {
        ok: false,
        error: '"quantityLabelWhen" must be {"field": "<key>", "map": {"<value>": "<label>"}}.',
      };
    }
  }

  return {
    ok: true,
    config: {
      fields: cfg.fields as ProductField[],
      quantity: (cfg.quantity ?? null) as ProductFormConfig["quantity"],
      ...(cfg.quantityLabel !== undefined ? { quantityLabel: cfg.quantityLabel as string } : {}),
      ...(cfg.quantityLabelWhen !== undefined
        ? { quantityLabelWhen: cfg.quantityLabelWhen as ProductFormConfig["quantityLabelWhen"] }
        : {}),
      ...(cfg.quantityOptional !== undefined ? { quantityOptional: cfg.quantityOptional as boolean } : {}),
      ...(cfg.quantityShowWhen !== undefined
        ? { quantityShowWhen: cfg.quantityShowWhen as ProductFormConfig["quantityShowWhen"] }
        : {}),
      ...(cfg.weightLabel !== undefined ? { weightLabel: cfg.weightLabel as string } : {}),
      ...(cfg.weightRequired !== undefined ? { weightRequired: cfg.weightRequired as boolean } : {}),
      ...(cfg.hideWeight !== undefined ? { hideWeight: cfg.hideWeight as boolean } : {}),
      ...(cfg.weightShowWhen !== undefined
        ? { weightShowWhen: cfg.weightShowWhen as ProductFormConfig["weightShowWhen"] }
        : {}),
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
      if (!isFieldVisible(field, specsJson)) return null;
      if (field.type === "info") {
        return field.text ? field.display.replace("{value}", field.text) : null;
      }
      const value = specsJson[field.key];
      if (value === undefined || value === "") return null;
      return field.display.replace("{value}", value);
    })
    .filter((part): part is string => part !== null)
    .join(" · ");
}
