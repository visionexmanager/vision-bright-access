/**
 * Pages that never call `useDocumentHead` kept the one title from index.html,
 * so a screen-reader user hearing "Visionex — Global Platform…" on /services,
 * /news and /pricing could not tell the pages apart (WCAG 2.4.2).
 *
 * Returns the title a route should now carry, or null to leave it alone: the
 * title is replaced only while it is still the index.html default or the one
 * this function produced for the previous route, never one a page set itself.
 */
export function routeTitle(
  current: string,
  defaultTitle: string,
  lastDerived: string | null,
  heading: string | null | undefined,
  brand = "Visionex",
): string | null {
  const text = heading?.replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (current && current !== defaultTitle && current !== lastDerived) return null;
  return `${text} — ${brand}`;
}
