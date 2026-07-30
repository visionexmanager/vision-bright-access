/**
 * VisionKids resilience — service criticality registry.
 *
 * Phase 19 spec item 11: "non-essential services must not bring the whole
 * system down." This registry is the single source of truth for which
 * dependencies are load-bearing. `critical` services (auth, database, core
 * content) must succeed; `optional` ones (AI, recommendations, analytics,
 * notifications) are always called through `withFallback` so their outage
 * degrades a feature, never the whole app.
 */

export type Criticality = "critical" | "optional";

export const SERVICE_CRITICALITY: Record<string, Criticality> = {
  // ── Load-bearing: an outage here is a real incident. ──
  auth: "critical",
  database: "critical",
  storage: "critical",
  content: "critical", // stories / lessons / games catalog
  realtime: "critical", // safe chat/voice presence

  // ── Optional: degrade the feature, keep learning alive. ──
  ai: "optional", // AI companion, generation, tutoring
  recommendations: "optional",
  analytics: "optional",
  notifications: "optional",
  search: "optional", // falls back to basic keyword filtering
  leaderboards: "optional",
};

/** Unknown services default to `optional` — safest for graceful degradation. */
export function isCritical(service: string): boolean {
  return SERVICE_CRITICALITY[service] === "critical";
}
