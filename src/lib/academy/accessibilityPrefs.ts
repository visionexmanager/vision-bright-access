/**
 * Academy — Accessibility Preferences (Phase 9, Control Center)
 *
 * High-contrast already exists site-wide via ThemeContext.tsx ("high-contrast"
 * theme + .high-contrast CSS in index.css) — reused as-is here, not
 * duplicated. Text-scale and manual reduce-motion are genuinely new (nothing
 * like them existed before); both follow the SAME mechanism ThemeContext
 * already uses (a class on <html>, persisted to localStorage) so they
 * compose cleanly with the existing theme system instead of introducing a
 * second, competing preference pipeline.
 */

export type AcademyTextScale = "normal" | "large" | "extra-large";

const TEXT_SCALE_KEY = "academy:text-scale";
const REDUCE_MOTION_KEY = "academy:reduce-motion";
const TEXT_SCALE_CLASSES = ["text-scale-lg", "text-scale-xl"];

export function getAcademyTextScale(): AcademyTextScale {
  const stored = window.localStorage.getItem(TEXT_SCALE_KEY);
  return stored === "large" || stored === "extra-large" ? stored : "normal";
}

export function setAcademyTextScale(scale: AcademyTextScale): void {
  window.localStorage.setItem(TEXT_SCALE_KEY, scale);
  applyStoredAcademyAccessibilityPrefs();
}

export function getAcademyReduceMotion(): boolean {
  return window.localStorage.getItem(REDUCE_MOTION_KEY) === "true";
}

export function setAcademyReduceMotion(enabled: boolean): void {
  window.localStorage.setItem(REDUCE_MOTION_KEY, String(enabled));
  applyStoredAcademyAccessibilityPrefs();
}

export function applyStoredAcademyAccessibilityPrefs(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  root.classList.remove(...TEXT_SCALE_CLASSES);
  const scale = getAcademyTextScale();
  if (scale === "large") root.classList.add("text-scale-lg");
  else if (scale === "extra-large") root.classList.add("text-scale-xl");

  root.classList.toggle("reduce-motion", getAcademyReduceMotion());
}

// Apply immediately on first import so prefs are live from app load, not
// just after visiting the Academy Settings page.
if (typeof window !== "undefined") {
  applyStoredAcademyAccessibilityPrefs();
}
