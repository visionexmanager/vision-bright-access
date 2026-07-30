import type { Platform } from "@/features/visionkids/types/everywhere.types";

/**
 * Platform + device identity. The SAME web core runs everywhere; a native
 * wrapper (Capacitor/Tauri/RN) sets `window.__VISIONKIDS_PLATFORM__` to declare
 * itself. Absent that, we detect PWA (standalone display) vs TV vs plain web.
 */

export const APP_VERSION = "18.0.0";
const DEVICE_KEY_STORAGE = "kids:device-key";

declare global {
  interface Window {
    __VISIONKIDS_PLATFORM__?: Platform;
  }
}

/** A stable per-install id (persisted in localStorage). */
export function getDeviceKey(): string {
  if (typeof window === "undefined") return "server";
  let key = window.localStorage.getItem(DEVICE_KEY_STORAGE);
  if (!key) {
    key = (crypto.randomUUID?.() ?? `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    window.localStorage.setItem(DEVICE_KEY_STORAGE, key);
  }
  return key;
}

export function detectPlatform(): Platform {
  if (typeof window === "undefined") return "web";
  if (window.__VISIONKIDS_PLATFORM__) return window.__VISIONKIDS_PLATFORM__;

  const ua = navigator.userAgent.toLowerCase();
  if (/\b(tv|smart-tv|smarttv|googletv|appletv|crkey|large screen)\b/.test(ua)) return "tv";

  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari PWA flag
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return standalone ? "pwa" : "web";
}

/** A friendly device name from the platform + a short device-key suffix. */
export function suggestDeviceName(platform: Platform): string {
  const key = getDeviceKey().slice(0, 4).toUpperCase();
  const label: Record<Platform, string> = {
    web: "Browser", pwa: "Installed App", android: "Android", ios: "iPhone/iPad",
    windows: "Windows", macos: "Mac", tv: "TV",
  };
  return `${label[platform]} · ${key}`;
}
