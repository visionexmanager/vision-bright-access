/**
 * VisionKids Theme Engine.
 *
 * A lightweight, additive theme layer: it stamps `data-kids-theme="<slug>"` on
 * <html> and remembers the choice in localStorage. It's deliberately decoupled
 * from the site-wide ThemeContext (light/dark/high-contrast) — kids themes are a
 * cosmetic layer on top, so switching one never breaks the base color scheme.
 * A signed-in child's server preference (kids_theme_prefs) hydrates this on load.
 *
 * Adding a theme is a catalog row (kids_themes) + optional CSS targeting
 * `:root[data-kids-theme="<slug>"]` — no code change here.
 */

const KIDS_THEME_KEY = "kids:theme";
export const DEFAULT_KIDS_THEME = "kids";

export function getStoredKidsTheme(): string {
  if (typeof window === "undefined") return DEFAULT_KIDS_THEME;
  return window.localStorage.getItem(KIDS_THEME_KEY) || DEFAULT_KIDS_THEME;
}

export function applyKidsTheme(themeSlug: string): void {
  if (typeof document === "undefined") return;
  const slug = themeSlug || DEFAULT_KIDS_THEME;
  document.documentElement.setAttribute("data-kids-theme", slug);
  window.localStorage.setItem(KIDS_THEME_KEY, slug);
  window.dispatchEvent(new CustomEvent("visionkids:theme-change", { detail: { theme: slug } }));
}

/** Re-apply the stored theme (call once on app/section mount). */
export function hydrateKidsTheme(): void {
  applyKidsTheme(getStoredKidsTheme());
}
