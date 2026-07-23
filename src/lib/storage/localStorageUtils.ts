/**
 * Shared localStorage read/write helpers.
 *
 * Originally lived in src/lib/academy/localStorageUtils.ts (itself already a
 * consolidation of ~9 near-identical copies across Academy's *LocalStore.ts
 * files). Relocated to a neutral, section-agnostic path so other sections
 * (e.g. Library) can reuse it without importing from `academy/`. Behavior is
 * unchanged: same try/catch/JSON semantics as before.
 */

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable — fail silently.
  }
}
