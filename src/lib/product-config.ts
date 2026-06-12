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
  type: "select";
  options: string[];
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
  /** Bounds for the standard Quantity input (SPEC.md §8: 1–20) */
  quantity: { min: number; max: number };
}

export type SpecsJson = Record<string, string>;

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
