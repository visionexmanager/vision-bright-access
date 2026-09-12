/**
 * The wiring that ties a control, its hint and its error together.
 *
 * Lives beside the components rather than inside them so the form file exports
 * only components — and, more usefully, so there is exactly one place that
 * decides what an error element is called. A page that spelled the id itself
 * would eventually spell it differently, and `aria-describedby` pointing at an
 * element that does not exist fails silently: the field simply stops announcing
 * why it was rejected, and nothing in the page looks wrong.
 */

export const errorId = (field: string): string => `travel-${field}-error`;

export const hintId = (field: string): string => `travel-${field}-hint`;

/**
 * The attributes every control in a `Field` needs, so no page forgets one.
 *
 * `aria-describedby` carries the hint and the error together — a control that
 * loses its hint the moment it is rejected is a control whose format rule is
 * announced only while it is not needed.
 */
export const fieldProps = (id: string, hasHint: boolean, hasError: boolean) => ({
  id,
  name: id,
  "aria-invalid": hasError || undefined,
  "aria-describedby":
    [hasHint ? hintId(id) : null, hasError ? errorId(id) : null].filter(Boolean).join(" ") ||
    undefined,
});
