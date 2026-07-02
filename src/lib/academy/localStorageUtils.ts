/**
 * Academy — shared localStorage read/write helpers.
 *
 * Extracted from the ~9 *LocalStore.ts files that each defined an identical
 * copy of these two functions (lessonLocalStore, instructorLocalStore,
 * assessmentLocalStore, certificateLocalStore, gamificationLocalStore,
 * libraryLocalStore, scholarshipLocalStore, universityLocalStore,
 * studyPlannerLocalStore) — pure duplication with no behavioral differences,
 * consolidated here during the Phase 10 code-quality pass. Behavior is
 * unchanged: every call site kept the exact same try/catch/JSON semantics.
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
