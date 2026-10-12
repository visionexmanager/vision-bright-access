// Which outside sources VisionKids may draw educational resources from, and what
// a resource must look like before an administrator is even offered it.
//
// A domain is not "safe for children". OpenStax is a publisher of peer-reviewed
// textbooks, but a calculus book is not for a seven-year-old; Wikibooks is
// written by volunteers and any title may change tomorrow. So this list only
// decides what may be *proposed* — it is the first of three gates:
//
//   1. this file       the source is on the list and the item is well formed
//   2. a person        an administrator approves that one resource, with an age
//                      range and a subject (nothing is approved by default)
//   3. the database    kids_approved_resources refuses an address, licence,
//                      credit line or age range it does not recognise, whatever
//                      the client sent (migration 20261068000000)
//
// Whether a listed source is switched on at all is a feature flag
// (`kids_source_<id>`, off by default), managed in the existing Feature flags
// page. Nothing external is ever embedded or executed: a resource is a link.

import type { ExternalContentItem } from "@/services/library/externalContent";

export interface ApprovedSource {
  id: "openstax" | "wikibooks";
  /** The registry provider that supplies candidates. */
  providerId: string;
  /** The feature flag that switches this source on for children. */
  flagKey: string;
  /** Hosts an item's address may be on. A language subdomain is matched by `.suffix`. */
  hosts: readonly string[];
  /** What the licence note says about this source, for the admin to read. */
  licenceSummary: string;
}

export const APPROVED_SOURCES: readonly ApprovedSource[] = [
  {
    id: "openstax",
    providerId: "openstax",
    flagKey: "kids_source_openstax",
    hosts: ["openstax.org"],
    licenceSummary: "Peer-reviewed textbooks, CC BY or CC BY-NC-SA per book; many are written for older students.",
  },
  {
    id: "wikibooks",
    providerId: "wikibooks",
    flagKey: "kids_source_wikibooks",
    hosts: [".wikibooks.org"],
    licenceSummary: "Volunteer-written open textbooks, CC BY-SA; content can change at any time.",
  },
];

export const SUBJECTS = ["math", "science", "language", "social", "technology", "arts", "other"] as const;
export type Subject = (typeof SUBJECTS)[number];

export const MIN_AGE = 3;
export const MAX_AGE = 17;

export const sourceById = (id: string): ApprovedSource | undefined => APPROVED_SOURCES.find((s) => s.id === id);

/** A candidate prepared for approval: exactly the columns the database will check. */
export interface ApprovalCandidate {
  source: ApprovedSource["id"];
  provider_item_id: string;
  title: string;
  summary: string | null;
  url: string;
  license_name: string;
  license_url: string | null;
  attribution: string;
  language: string;
}

export type CandidateProblem =
  | "source_not_allowed"
  | "address_not_allowed"
  | "licence_missing"
  | "credit_missing"
  | "title_missing";

/** Plain text only: tags, control characters and runs of whitespace removed, then cut to length. */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/g, " ")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F‎‏‪-‮⁦-⁩]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** True only for an https address on one of the source's hosts, with no userinfo and no port. */
export function addressAllowed(source: ApprovedSource, value: unknown): value is string {
  if (typeof value !== "string" || value.length > 500 || /[\s<>"']/.test(value)) return false;
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  return source.hosts.some((h) => (h.startsWith(".") ? /^[a-z]{2,3}$/.test(host.slice(0, -h.length)) && host.endsWith(h) : host === h));
}

/**
 * Turns a registry item into something an administrator may approve, or says why
 * not. Nothing the provider sent is trusted: text is stripped, the address and
 * licence are re-checked, and an item with no stated licence or credit is refused
 * rather than guessed.
 */
export function toCandidate(item: Pick<ExternalContentItem,
  "provider" | "providerItemId" | "title" | "description" | "externalUrl" | "license" | "attribution" | "language">):
  { ok: true; candidate: ApprovalCandidate } | { ok: false; problem: CandidateProblem } {
  const source = APPROVED_SOURCES.find((s) => s.providerId === item.provider);
  if (!source) return { ok: false, problem: "source_not_allowed" };
  if (!addressAllowed(source, item.externalUrl)) return { ok: false, problem: "address_not_allowed" };
  const title = cleanText(item.title, 200);
  if (!title) return { ok: false, problem: "title_missing" };
  const licence = cleanText(item.license?.name, 40);
  if (!/^CC (BY|0)/.test(licence)) return { ok: false, problem: "licence_missing" };
  const attribution = cleanText(item.attribution, 300);
  if (!attribution) return { ok: false, problem: "credit_missing" };
  const licenseUrl = typeof item.license?.url === "string" && /^https:\/\/creativecommons\.org\/[^\s<>"']*$/.test(item.license.url)
    ? item.license.url : null;
  const language = typeof item.language === "string" && /^[a-z]{2,3}$/.test(item.language) ? item.language : "en";
  return {
    ok: true,
    candidate: {
      source: source.id,
      provider_item_id: cleanText(item.providerItemId, 200),
      title,
      summary: cleanText(item.description, 500) || null,
      url: item.externalUrl,
      license_name: licence,
      license_url: licenseUrl,
      attribution,
      language,
    },
  };
}

/** The age range an approval may take: whole years within bounds, from <= to. */
export function validAgeRange(from: number, to: number): boolean {
  return Number.isInteger(from) && Number.isInteger(to) && from >= MIN_AGE && to <= MAX_AGE && from <= to;
}
