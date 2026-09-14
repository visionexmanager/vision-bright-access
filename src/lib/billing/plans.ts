// What the free week opens, what each paid tier keeps open, and where the
// boundary between them falls.
//
// Before this file the platform had one economic rule — thirty days of
// everything, then pay in VX credits for the few operations that cost money —
// and four plans (`basic`, `pro`, `enterprise`) that only ever described the
// AI Media Studio. Nothing said which *section* a subscriber could open, so
// every section was open to everyone and the plans were priced against credits
// nobody could relate to a feature.
//
// The model here is deliberately small:
//
//   • One free week from registration, with every section open — on the site
//     and on WhatsApp. Long enough to see what Visionex is, short enough that
//     it is a trial rather than a free product.
//   • Three tiers afterwards, nested: Bronze ⊂ Silver ⊂ Gold. Nesting is the
//     whole point — nobody upgrading ever loses a section they had, and the
//     pricing page can say "everything in Bronze, plus…" truthfully.
//   • A handful of sections that never need a plan, so an expired account is
//     still an account: the news, the community, the assistive-product
//     catalogue, and everything this file does not name.
//
// This module is pure and framework-free so the rules can be tested without a
// browser or a database, and `subscription-tiers.test.ts` pins it against the
// migration that mirrors it into `billing_plans.limits`. Change a price or a
// section here and that test tells you which SQL line disagrees.

/** Days of full access every new account gets, counted from registration. */
export const TRIAL_DAYS = 7;

/** How long before expiry somebody is told the week is ending. */
export const TRIAL_WARNING_DAYS = 1;

/** Where somebody goes to choose a tier. Mirrors `PLANS_URL` in the webhook. */
export const PRICING_PATH = "/pricing";

export type SectionKey =
  | "assistant"
  | "academy"
  | "library"
  | "arcade"
  | "kids"
  | "career"
  | "marketplace"
  | "community"
  | "news"
  | "assistive"
  | "tv"
  | "radio"
  | "messages"
  | "simulations"
  | "mediaStudio"
  | "studio"
  | "professional"
  | "finance";

export type TierId = "bronze" | "silver" | "gold";

/** Every plan somebody pays for: the three nested tiers, and Kids beside them. */
export type PaidPlanId = TierId | "kids";

/** Plan identifiers that can reach the access helpers, including "no plan". */
export type PlanId = PaidPlanId | "free_trial" | "none";

export interface SectionDef {
  key: SectionKey;
  /** Translation key for the section's name. Never a raw English string. */
  labelKey: string;
  /**
   * Route prefixes this section owns. Longest match wins, so `/library/studio`
   * resolves to the authoring studio rather than to the library it sits under.
   */
  paths: string[];
}

/**
 * Every section a plan can open.
 *
 * A route that appears in no entry here is free by construction — the home
 * page, the dashboard, sign-in, settings, the legal centre, the pricing page
 * itself. That is the safe direction for the default to point: forgetting to
 * list a section leaves it open, never locked.
 */
export const SECTIONS: readonly SectionDef[] = [
  { key: "assistant",   labelKey: "section.assistant",   paths: [] },
  { key: "academy",     labelKey: "section.academy",     paths: ["/academy"] },
  { key: "library",     labelKey: "section.library",     paths: ["/library"] },
  { key: "arcade",      labelKey: "section.arcade",      paths: ["/games"] },
  { key: "kids",        labelKey: "section.kids",        paths: ["/kids"] },
  { key: "career",      labelKey: "section.career",      paths: ["/career", "/careers"] },
  { key: "marketplace", labelKey: "section.marketplace", paths: ["/bazaar", "/marketplace"] },
  { key: "community",   labelKey: "section.community",   paths: ["/community"] },
  { key: "news",        labelKey: "section.news",        paths: ["/news"] },
  { key: "assistive",   labelKey: "section.assistive",   paths: ["/assistive-products"] },
  { key: "tv",          labelKey: "section.tv",          paths: ["/services/live-tv"] },
  { key: "radio",       labelKey: "section.radio",       paths: ["/services/live-radio"] },
  { key: "messages",    labelKey: "section.messages",    paths: ["/messages", "/community/voice-rooms"] },
  { key: "simulations", labelKey: "section.simulations", paths: ["/business-simulator", "/simulations"] },
  { key: "mediaStudio", labelKey: "section.mediaStudio", paths: ["/services/ai-media-studio"] },
  { key: "studio",      labelKey: "section.studio",      paths: ["/library/studio"] },
  { key: "professional",labelKey: "section.professional",paths: ["/professional-tools", "/services/file-studio"] },
  { key: "finance",     labelKey: "section.finance",     paths: ["/finance"] },
] as const;

/**
 * Open without any plan, and after the week has run out.
 *
 * An account that stops paying should still be able to read the news, talk to
 * the community and find an assistive product — those are the parts of
 * Visionex that exist to be reachable, and putting them behind five dollars
 * would be the wrong platform. The WhatsApp assistant is not in this list but
 * is not closed either: it keeps the small free daily allowance the webhook
 * has always given an unlinked number.
 */
export const FREE_SECTIONS: readonly SectionKey[] = ["news", "community", "assistive"] as const;

export interface TierDef {
  id: PaidPlanId;
  /** US dollars per month. */
  price: number;
  /** VX credits granted each month, for the operations that cost money. */
  vxMonthly: number;
  /** Paid WhatsApp operations per day. 0 means no daily ceiling. */
  whatsappDaily: number;
  /** Sections this tier opens, on top of the free ones. */
  sections: readonly SectionKey[];
}

const BRONZE_SECTIONS: readonly SectionKey[] = [
  ...FREE_SECTIONS,
  "assistant",
  "academy",
  "library",
  "arcade",
  "marketplace",
];

const SILVER_SECTIONS: readonly SectionKey[] = [
  ...BRONZE_SECTIONS,
  "kids",
  "career",
  "tv",
  "radio",
  "messages",
  "simulations",
];

const GOLD_SECTIONS: readonly SectionKey[] = [
  ...SILVER_SECTIONS,
  "mediaStudio",
  "studio",
  "professional",
  "finance",
];

/**
 * The three tiers, cheapest first.
 *
 * Bronze is the reading-and-learning platform: the assistant, the academy, the
 * library, the arcade, the bazaar. Silver adds the things a household uses —
 * the children's world, the career hub, television, radio, voice rooms, the
 * simulators. Gold adds the tools that cost real money to run: media
 * generation, publishing, the file studio, the finance hub — which is also why
 * it carries the credits and the uncapped WhatsApp allowance.
 */
export const TIERS: Readonly<Record<TierId, TierDef>> = {
  bronze: { id: "bronze", price: 5,  vxMonthly: 5_000,  whatsappDaily: 150, sections: BRONZE_SECTIONS },
  silver: { id: "silver", price: 7,  vxMonthly: 12_000, whatsappDaily: 400, sections: SILVER_SECTIONS },
  gold:   { id: "gold",   price: 10, vxMonthly: 30_000, whatsappDaily: 0,   sections: GOLD_SECTIONS },
};

/** Cheapest first — the nested tiers. */
export const TIER_ORDER: readonly TierId[] = ["bronze", "silver", "gold"] as const;

/**
 * Kids: VisionKids and nothing else, for three dollars.
 *
 * Beside the tiers, not inside them. A parent who wants the children's world
 * should not have to buy the assistant, the academy and the bazaar to get it —
 * and Kids does not open those, so it cannot undercut Bronze. Silver and Gold
 * still include VisionKids, so nobody upgrading from Kids loses it.
 */
export const KIDS_PLAN: TierDef = {
  id: "kids",
  price: 3,
  vxMonthly: 0,
  whatsappDaily: 50,
  sections: [...FREE_SECTIONS, "kids"],
};

/** Every paid plan by id. */
export const PAID_PLANS: Readonly<Record<PaidPlanId, TierDef>> = { kids: KIDS_PLAN, ...TIERS };

/** Every paid plan, cheapest first — the order the upgrade notice picks from. */
export const PAID_PLAN_ORDER: readonly PaidPlanId[] = ["kids", ...TIER_ORDER] as const;

/** Paid WhatsApp operations a day during the free week. */
export const TRIAL_WHATSAPP_DAILY = 200;

function isPaidPlan(planId: string): planId is PaidPlanId {
  return planId === "kids" || planId === "bronze" || planId === "silver" || planId === "gold";
}

/**
 * Which sections a plan opens.
 *
 * `free_trial` is every section — that is what the week is. Anything
 * unrecognised falls back to the free set rather than to nothing, for the same
 * reason the webhook's entitlement reader allows on a malformed row: a lookup
 * that fails should cost revenue, not lock somebody out.
 */
export function planSections(planId: string | null | undefined): readonly SectionKey[] {
  if (planId === "free_trial") return SECTIONS.map((section) => section.key);
  if (planId && isPaidPlan(planId)) return PAID_PLANS[planId].sections;
  return FREE_SECTIONS;
}

/** Does this plan open this section? */
export function planAllows(planId: string | null | undefined, section: SectionKey): boolean {
  return planSections(planId).includes(section);
}

/** The cheapest paid plan that opens a section, for "upgrade to…" copy. */
export function cheapestTierFor(section: SectionKey): PaidPlanId | null {
  return PAID_PLAN_ORDER.find((plan) => PAID_PLANS[plan].sections.includes(section)) ?? null;
}

/** The section a route belongs to, or null when the route needs no plan. */
export function sectionForPath(pathname: string): SectionKey | null {
  if (!pathname) return null;
  // Normalised once so "/library/" and "/Library" both resolve, and so a
  // prefix match cannot succeed on half a segment ("/newsletter" is not
  // "/news").
  const path = pathname.toLowerCase().replace(/\/+$/, "") || "/";

  let match: { key: SectionKey; length: number } | null = null;
  for (const section of SECTIONS) {
    for (const prefix of section.paths) {
      if (path !== prefix && !path.startsWith(`${prefix}/`)) continue;
      if (!match || prefix.length > match.length) match = { key: section.key, length: prefix.length };
    }
  }
  return match?.key ?? null;
}

/** The catalogue entry for a key, for rendering a name. */
export function sectionDef(key: SectionKey): SectionDef {
  // Non-null by construction: SectionKey is the union of the catalogue's keys.
  return SECTIONS.find((section) => section.key === key)!;
}
