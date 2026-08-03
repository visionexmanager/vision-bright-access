export const AD_CONSENT_KEY = "vx_cookie_consent_v2";
export const LEGACY_CONSENT_KEY = "vx_cookie_consent";
export const AD_CONSENT_EVENT = "visionex:consent-changed";
export const OPEN_CONSENT_EVENT = "visionex:open-consent";

export type ConsentChoice = "all" | "essential";

export interface ConsentRecord {
  version: 2;
  choice: ConsentChoice;
  advertising: boolean;
  analytics: boolean;
  updatedAt: string;
}

export function readConsent(): ConsentRecord | null {
  try {
    const value = localStorage.getItem(AD_CONSENT_KEY);
    if (value) {
      const parsed = JSON.parse(value) as ConsentRecord;
      if (parsed.version === 2 && (parsed.choice === "all" || parsed.choice === "essential")) return parsed;
    }

    // Old consent did not provide the granular, advertising-specific disclosure
    // used by v2. A previous decline can be retained safely; an acceptance must be
    // requested again before any advertising script is loaded.
    if (localStorage.getItem(LEGACY_CONSENT_KEY) === "declined") {
      return { version: 2, choice: "essential", advertising: false, analytics: false, updatedAt: new Date().toISOString() };
    }
  } catch {
    // Storage may be unavailable in hardened browsers. Treat that as no consent.
  }
  return null;
}

export function saveConsent(choice: ConsentChoice): ConsentRecord {
  const record: ConsentRecord = {
    version: 2,
    choice,
    advertising: choice === "all",
    analytics: choice === "all",
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(AD_CONSENT_KEY, JSON.stringify(record));
    localStorage.removeItem(LEGACY_CONSENT_KEY);
  } catch {
    // The in-memory event still lets the current page react to the choice.
  }
  window.dispatchEvent(new CustomEvent(AD_CONSENT_EVENT, { detail: record }));
  return record;
}

export function openConsentPreferences() {
  window.dispatchEvent(new Event(OPEN_CONSENT_EVENT));
}

