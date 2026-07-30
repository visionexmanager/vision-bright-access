/**
 * Device experience modes — low-data and TV — applied as <html> data-attributes
 * (like the Theme Engine) so CSS can respond, and persisted locally. A signed-in
 * child's server preferences (kids_user_preferences) hydrate these on load so
 * the choice roams across devices.
 */

const LOW_DATA_KEY = "kids:low-data";
const TV_MODE_KEY = "kids:tv-mode";

export function getLowData(): boolean {
  return typeof window !== "undefined" && window.localStorage.getItem(LOW_DATA_KEY) === "1";
}
export function setLowData(on: boolean): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-kids-lowdata", on ? "on" : "off");
  window.localStorage.setItem(LOW_DATA_KEY, on ? "1" : "0");
}

export function getTvMode(): boolean {
  return typeof window !== "undefined" && window.localStorage.getItem(TV_MODE_KEY) === "1";
}
export function setTvMode(on: boolean): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-kids-tv", on ? "on" : "off");
  window.localStorage.setItem(TV_MODE_KEY, on ? "1" : "0");
}

/** Re-apply stored modes (call once on section mount). */
export function hydrateModes(): void {
  setLowData(getLowData());
  setTvMode(getTvMode());
}
