/**
 * Describes the structure of a JSON value: keys and types, never values.
 * Used by scripts/pi-contract-probe.ts so the real PI response shapes can be
 * captured (and shared) without exposing any customer data.
 */
export function shapeOf(v: unknown, depth = 0): unknown {
  if (v === null) return "null";
  if (Array.isArray(v)) return depth > 4 ? "array" : { array: v.length === 0 ? "empty" : shapeOf(v[0], depth + 1), length: v.length };
  if (typeof v === "object") {
    if (depth > 4) return "object";
    return Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, shapeOf(x, depth + 1)]));
  }
  return typeof v;
}
