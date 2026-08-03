/**
 * Visionex Service Center — shared types.
 *
 * The Service Center replaces the flat "43 Start buttons" services list with a
 * hub-first structure. Everything the UI renders derives from `catalog.ts`, so
 * the taxonomy, pricing, skills, AI persona and audio identity of an experience
 * all live in one place.
 */

/** The six hubs a visitor picks from before ever seeing an individual card. */
export type HubId =
  | "business-lab"
  | "tech-repair"
  | "engineering"
  | "personal-growth"
  | "creative-studio"
  | "marketplace";

/**
 * How an entry is delivered. This drives the CTA wording and the route we
 * build — "experience" reads better than "simulator" on a professional page.
 */
export type DeliveryKind =
  | "experience" // hands-on simulator: /business-simulator/:slug
  | "advisor" // AI consultation session: /business-simulator/:slug (svc-*)
  | "service" // human-delivered professional service: /services/:slug
  | "tool" // self-serve utility: OCR, File Studio
  | "studio" // creative production surface: AI Media Studio, TV, Radio
  | "program"; // structured learning: Academy

export type Difficulty = "starter" | "intermediate" | "advanced" | "expert";

/** Broad intent buckets used by the AI Service Navigator. */
export type Intent =
  | "start-a-business"
  | "learn-a-skill"
  | "fix-a-device"
  | "grow-my-work"
  | "care-for-myself"
  | "create-something";

/**
 * Inputs to the feasibility engine. Amounts are USD so the numbers stay
 * meaningful as a real-world business estimate; VX pricing is separate and
 * only covers what the Visionex session itself costs.
 */
export interface FeasibilityInput {
  /** One-off capital needed before the first sale. */
  startupCostUsd: number;
  /** Recurring cost per month at the modelled scale. */
  monthlyCostUsd: number;
  /** Expected revenue per month once running at the modelled scale. */
  monthlyRevenueUsd: number;
  /** Ramp-up months before revenue reaches the modelled level. */
  rampUpMonths: number;
  /** 1 (very stable) … 5 (highly volatile). Drives the risk band. */
  volatility: 1 | 2 | 3 | 4 | 5;
  /** Short, concrete risks — i18n keys are overkill here, we ship en+ar pairs. */
  risks: LocalizedList;
  /** What the operator actually sells. */
  revenueModel: LocalizedText;
}

export interface LocalizedText {
  en: string;
  ar: string;
}

export interface LocalizedList {
  en: string[];
  ar: string[];
}

/** The AI character that hosts an experience. */
export interface PersonaRef {
  /** Key into `ai/personas.ts`. */
  id: string;
  /** Display role, e.g. "AI Agronomist". */
  role: LocalizedText;
}

/** Audio identity — resolved by `audio/serviceAudio.ts`. */
export interface AudioIdentity {
  /** Ambience loop key (server room, barn, workshop…). */
  ambience: string;
  /** Notable event cues this experience should be able to fire. */
  cues: string[];
}

export interface ServiceEntry {
  /** Stable id, matches the simulation slug where one exists. */
  slug: string;
  hub: HubId;
  kind: DeliveryKind;

  title: LocalizedText;
  /** One line that sells the outcome, not the mechanic. */
  tagline: LocalizedText;

  /** Destination route. */
  to: string;
  /** Optional hero image import; falls back to the hub gradient. */
  image?: string;

  difficulty: Difficulty;
  /** Typical session length in minutes. */
  durationMinutes: number;

  /**
   * VX cost. `usageBased` means metered against SIMULATION_PRICES rather than
   * a flat charge; `vx` is then the entry price for a single session.
   */
  vx: number;
  usageBased?: boolean;

  /** Intents this entry satisfies — the Navigator scores against these. */
  intents: Intent[];
  /** Free-text search terms, both languages. */
  keywords: LocalizedList;

  /** Concrete takeaways shown on the profile page. */
  outcomes: LocalizedList;
  /** Named, transferable skills — these feed the skills profile. */
  skills: LocalizedList;

  persona?: PersonaRef;
  audio?: AudioIdentity;
  feasibility?: FeasibilityInput;

  featured?: boolean;
  /** Marks entries that are new so the UI can badge them. */
  recentlyAdded?: boolean;
}

export interface HubDefinition {
  id: HubId;
  title: LocalizedText;
  /** The promise of the hub — appears under the title. */
  promise: LocalizedText;
  /** Longer positioning line for the hub landing header. */
  description: LocalizedText;
  /** Tailwind accent token, e.g. "amber". Kept as a string key, resolved in `theme.ts`. */
  accent: HubAccent;
  /** Lucide icon name, resolved in the UI layer. */
  icon: string;
}

export type HubAccent = "amber" | "cyan" | "violet" | "emerald" | "rose" | "sky";
