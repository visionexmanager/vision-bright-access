// Pure rules for the Phase 7 content engine: duplicate detection, source
// validation, confidentiality screening, and memory formatting.
//
// Deliberately free of Deno and Supabase imports so the unit suite can import
// and exercise these directly rather than asserting on file text. The rules
// that matter here are the ones that must not silently stop working, so they
// are tested against real inputs, not greps.

import { INTERNAL_ONLY_FIELDS } from "../sourcing/confidentiality.ts";
import { CONTENT_SECTIONS } from "./writerPrompt.ts";

export type ContentSection = (typeof CONTENT_SECTIONS)[number];

/**
 * Seed phrase per discoverable section.
 *
 * Discovery needs a query vector, and these describe what the section holds in
 * the words its rows are written in. Only the eleven indexed sections appear —
 * there is no seed for a section that embed-content does not index, because
 * there would be nothing for it to match.
 */
export const SECTION_SEEDS: Record<ContentSection, string> = {
  products: "accessible products, assistive tools and devices for blind and low-vision users",
  content_items: "published articles, guides and learning content",
  academy_courses: "online courses, lessons and structured learning paths",
  kids_games: "educational games and activities for children",
  simulations: "interactive simulations and hands-on practice scenarios",
  tv_channels: "live television channels and streaming programmes",
  radio_stations: "radio stations and audio broadcasts",
  communities: "community groups, discussions and member spaces",
  events: "upcoming events, sessions and meetups",
  jobs: "job openings, careers and hiring opportunities",
  services: "platform services and what the site offers",
};

/** Arabic letter forms that differ only orthographically. */
const ARABIC_NORMALISATIONS: Array<[RegExp, string]> = [
  [/[آأإٱ]/g, "ا"], // آ أ إ ٱ → ا
  [/ى/g, "ي"],           // alef maqsura → ya
  [/ة/g, "ه"],           // ta marbuta → ha
  [/ـ/g, ""],            // tatweel
];

/**
 * Normalised form used for exact-duplicate detection.
 *
 * Case, punctuation, diacritics and Arabic letter-form variants all collapse,
 * because "منتجات Visionex" and "منتجات visionex." are the same idea and a
 * duplicate check that misses that is not a duplicate check. Word order is
 * preserved: sorting the words would merge genuinely different topics that
 * happen to share vocabulary.
 */
export function normalizeTopicKey(topic: string): string {
  // Decompose, then drop every combining mark. This has to come before the
  // letter-form table: NFKD turns أ into ا plus a combining hamza, so a table
  // matching the composed character alone would miss it, and the leftover mark
  // would later be replaced by a space — splitting the word in half.
  let s = topic.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase();
  for (const [pattern, replacement] of ARABIC_NORMALISATIONS) s = s.replace(pattern, replacement);
  return s
    // Keep letters and digits in any script; drop everything else.
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 200);
}

/**
 * Keep only the source ids that were actually retrieved and shown.
 *
 * The model is asked to cite what it used, and a model can cite something it
 * was never given. Anything not in the supplied set is dropped rather than
 * trusted, so `source_refs` always answers "which indexed row is the evidence
 * for this" truthfully.
 */
export function validateSourceRefs(
  claimed: unknown,
  supplied: Array<{ source_table: string; source_id: string }>,
): Array<{ source_table: string; source_id: string }> {
  if (!Array.isArray(claimed)) return [];
  const byId = new Map(supplied.map((s) => [s.source_id, s]));
  const seen = new Set<string>();
  const kept: Array<{ source_table: string; source_id: string }> = [];

  for (const raw of claimed) {
    const id = typeof raw === "string" ? raw : null;
    if (!id || seen.has(id)) continue;
    const match = byId.get(id);
    if (!match) continue;
    seen.add(id);
    kept.push({ source_table: match.source_table, source_id: match.source_id });
  }
  return kept;
}

/**
 * Terms that must never reach a customer-facing surface.
 *
 * Built from the Phase 6 allow-list rather than a second hand-written list, so
 * a field added to INTERNAL_ONLY_FIELDS is screened here automatically. Each
 * internal field name is matched in camelCase and snake_case, plus the plain
 * commercial words for the same ideas.
 */
export const CONFIDENTIAL_TERMS: string[] = [
  ...INTERNAL_ONLY_FIELDS,
  ...INTERNAL_ONLY_FIELDS.map((f) => f.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)),
  "supplier", "wholesale", "profit margin", "markup", "purchase price",
  "cost price", "source price", "المورد", "سعر الشراء", "هامش الربح", "الجملة",
];

/**
 * Report every confidential term found in generated content.
 *
 * Returns the matches rather than a boolean so a refusal can say what tripped
 * it. Matching is case-insensitive and, for ASCII terms, word-bounded — an
 * unbounded "supplier" would fire on "supplies" and train everyone to ignore
 * the check.
 */
export function detectConfidentialLeak(text: string): string[] {
  const haystack = text.toLowerCase();
  const hits: string[] = [];

  for (const term of CONFIDENTIAL_TERMS) {
    const needle = term.toLowerCase();
    const isAscii = /^[\x20-\x7E]+$/.test(needle);
    const found = isAscii
      ? new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(haystack)
      : haystack.includes(needle);
    if (found && !hits.includes(term)) hits.push(term);
  }
  return hits;
}

/** The `owner_approvals.action_type` that create_content_proposal writes. */
export const CONTENT_APPROVAL_TYPE = "content_publish";

/**
 * How long a content proposal's approval stays answerable.
 *
 * owner_approvals defaults to seven days because a customer escalation goes
 * stale — the customer has moved on. A content proposal has no time-sensitive
 * action behind it in this phase, because nothing publishes; letting the
 * default apply meant the approval quietly became undecidable and took the
 * proposal with it, since decide_content_proposal asks the same engine and is
 * refused. Ten years is "does not expire" expressed in the column that exists.
 */
export function contentApprovalExpiry(now: Date = new Date()): string {
  const expiry = new Date(now);
  expiry.setUTCFullYear(expiry.getUTCFullYear() + 10);
  return expiry.toISOString();
}

/**
 * Run a generic approval decision, unless the approval belongs to a content
 * proposal.
 *
 * The guard owns the call rather than sitting beside it, so refusing is
 * structural: a content approval means `decide` is never invoked, and no state
 * can change. A missing approval is also refused — deciding a reference that
 * could not be read would be deciding blind.
 */
export async function decideUnlessContentApproval<T>(
  approval: { action_type: string } | null | undefined,
  decide: () => Promise<T>,
): Promise<{ ok: boolean; error?: string; result?: T }> {
  if (!approval) return { ok: false, error: "not_found" };
  if (approval.action_type === CONTENT_APPROVAL_TYPE) {
    return { ok: false, error: "use_content_proposals" };
  }
  return { ok: true, result: await decide() };
}

export interface GenerationGateInput {
  /** The retrieved records, already projected for the prompt. */
  sources: string;
  /** Distilled guidance read back from content_memory. */
  memory: string;
  /** The explicit do-not-propose list. */
  avoid: string;
}

export interface GenerationGateResult<T> {
  ok: boolean;
  error?: string;
  detail?: string;
  draft?: T;
}

/**
 * Screen everything about to be sent to the model, then generate — in that
 * order, and only in that order.
 *
 * Fail-closed by construction: `generate` is a callback this function decides
 * whether to invoke, so a confidential term in the assembled input means the
 * model is never called at all and no proposal can exist to save. Screening
 * only the model's reply would be too late twice over — the data would already
 * have left the system, and the output screen matches internal field names and
 * commercial vocabulary, not a supplier's actual name or a bare cost figure.
 *
 * Uses the same detectConfidentialLeak — and therefore the same Phase 6
 * INTERNAL_ONLY_FIELDS — as the output screen. There is deliberately no second
 * list to keep in step.
 */
export async function generateAfterInputScreen<T>(
  input: GenerationGateInput,
  generate: () => Promise<T>,
): Promise<GenerationGateResult<T>> {
  const hits = detectConfidentialLeak([input.sources, input.memory, input.avoid].join("\n"));
  if (hits.length > 0) {
    return { ok: false, error: "confidential_input", detail: hits.join(", ") };
  }
  return { ok: true, draft: await generate() };
}

export interface MemoryRow {
  memory_type: string;
  topic: string | null;
  lesson: string;
}

/**
 * Split stored memory into guidance and a hard avoid-list.
 *
 * Rejections become an explicit "do not propose these again" block rather than
 * being blended into general guidance, because a rejected topic reworded is
 * exactly the failure the owner asked to prevent.
 */
export function buildMemoryContext(rows: MemoryRow[]): { memory: string; avoid: string } {
  const avoidRows = rows.filter((r) => r.memory_type === "rejected_topic" || r.memory_type === "avoid_topic");
  const guidanceRows = rows.filter((r) => !avoidRows.includes(r));

  return {
    memory: guidanceRows.map((r) => `- ${r.lesson}`).join("\n"),
    avoid: avoidRows.map((r) => `- ${r.topic ?? "(unnamed)"}: ${r.lesson}`).join("\n"),
  };
}

/**
 * Render retrieved rows for the prompt.
 *
 * An allow-list projection, like the Phase 6 customer projection it mirrors:
 * only the id and the already-public indexed text cross into the prompt. A
 * column added to a source config later cannot leak through here, because
 * nothing reads the underlying row at all — `content` is what embed-content
 * chose to index, and that is all the model sees.
 */
export function renderSourcesForPrompt(
  rows: Array<{ source_table: string; source_id: string; content: string }>,
  maxChars = 600,
): string {
  return rows
    .map((r) => `- [${r.source_id}] (${r.source_table}) ${r.content.slice(0, maxChars)}`)
    .join("\n");
}

/** A future timestamp, defaulting when the model returns something unusable. */
export function normalizeProposedTime(value: unknown, fallbackHoursAhead = 24): string {
  const parsed = typeof value === "string" ? Date.parse(value) : NaN;
  if (Number.isFinite(parsed) && parsed > Date.now()) return new Date(parsed).toISOString();
  return new Date(Date.now() + fallbackHoursAhead * 3_600_000).toISOString();
}
