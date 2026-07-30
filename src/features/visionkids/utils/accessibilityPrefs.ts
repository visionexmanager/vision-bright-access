/**
 * VisionKids — Accessibility Preferences.
 *
 * Reuses the exact mechanism already established by src/lib/academy/accessibilityPrefs.ts:
 * a class on <html>, persisted to localStorage, backed by the SAME global CSS
 * (.text-scale-lg/.text-scale-xl/.reduce-motion in src/index.css) — nothing new
 * to add to the stylesheet, just a second namespaced writer of those classes.
 * High-contrast is not duplicated here either — it's the site-wide "high-contrast"
 * ThemeContext theme (see useThemeToggle), reused as-is.
 */
import type { KidsTextScale } from "@/features/visionkids/types/visionkids.types";

const TEXT_SCALE_KEY = "kids:text-scale";
const REDUCE_MOTION_KEY = "kids:reduce-motion";
const TEXT_SCALE_CLASSES = ["text-scale-lg", "text-scale-xl"];

export function getKidsTextScale(): KidsTextScale {
  const stored = window.localStorage.getItem(TEXT_SCALE_KEY);
  return stored === "large" || stored === "extra-large" ? stored : "normal";
}

export function setKidsTextScale(scale: KidsTextScale): void {
  window.localStorage.setItem(TEXT_SCALE_KEY, scale);
  applyStoredKidsAccessibilityPrefs();
}

export function getKidsReduceMotion(): boolean {
  return window.localStorage.getItem(REDUCE_MOTION_KEY) === "true";
}

export function setKidsReduceMotion(enabled: boolean): void {
  window.localStorage.setItem(REDUCE_MOTION_KEY, String(enabled));
  applyStoredKidsAccessibilityPrefs();
}

export function applyStoredKidsAccessibilityPrefs(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  root.classList.remove(...TEXT_SCALE_CLASSES);
  const scale = getKidsTextScale();
  if (scale === "large") root.classList.add("text-scale-lg");
  else if (scale === "extra-large") root.classList.add("text-scale-xl");

  root.classList.toggle("reduce-motion", getKidsReduceMotion());
  window.dispatchEvent(new Event("visionkids:a11y-change"));
}

/** True if motion should be suppressed: OS preference OR the manual VisionKids toggle. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  const osPref = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  return osPref || getKidsReduceMotion();
}
