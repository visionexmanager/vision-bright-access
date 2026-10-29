const KEY = "visionex.androidApp";
const TWA_REFERRER = "android-app://app.visionex.twa";

/**
 * True when the site runs inside the Google Play app (a Trusted Web Activity).
 *
 * Play requires its own billing for digital goods bought in an app, and the
 * plans and VX here are paid outside it, so the Android app does not offer
 * them. The app opens `/?source=twa`; the flag is kept for the tab, not in
 * localStorage, which a TWA shares with the browser.
 */
export function isAndroidApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.sessionStorage.getItem(KEY) === "1") return true;
    const fromApp =
      new URLSearchParams(window.location.search).get("source") === "twa" ||
      document.referrer.startsWith(TWA_REFERRER);
    if (fromApp) window.sessionStorage.setItem(KEY, "1");
    return fromApp;
  } catch {
    return false;
  }
}
