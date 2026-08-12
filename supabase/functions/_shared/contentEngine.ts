// Phase 7 content engine: discover → draft → screen → propose.
//
// Discovery reads the existing ai_embeddings index through the existing
// match_embeddings(). There is no second index and no second retrieval path.
//
// Drafting goes through the `content-writer` entry in the generator registry —
// the same entry ai-generate serves — so the prompt and schema have one home.
// This module adds what a stateless generate call cannot do on its own:
// retrieval, three layers of duplicate prevention, confidentiality screening,
// and the atomic write that pairs a proposal with its approval.
//
// Nothing here publishes. The engine's last act is creating a row a human has
// to decide on.

import { createEmbedding, structuredCompletion } from "./aiProvider.ts";
import { getGenerator, CONTENT_SECTIONS, CONTENT_TYPES, CONTENT_PLATFORMS } from "./generators.ts";
import {
  SECTION_SEEDS,
  buildMemoryContext,
  detectConfidentialLeak,
  normalizeProposedTime,
  normalizeTopicKey,
  renderSourcesForPrompt,
  validateSourceRefs,
  type ContentSection,
} from "./content/proposalRules.ts";

// deno-lint-ignore no-explicit-any
type SupabaseServiceClient = any;

/**
 * Cost controls. The owner asked for deliberate limits rather than a sweep that
 * drafts something for every row in the index.
 */
const MAX_SOURCES_PER_DRAFT = 6;
const MAX_MEMORY_ROWS = 12;
const NEAR_DUPLICATE_THRESHOLD = 0.88;
const DEDUPE_LOOKBACK_DAYS = 90;
const SOURCE_COOLDOWN_DAYS = 30;
const RATE_LIMIT_FUNCTION = "content-writer";

export interface ProposeOptions {
  section: string;
  contentType: string;
  platform: string;
  language: "en" | "ar";
  actorId: string;
  /** Set when the owner asked for another take on an existing proposal. */
  supersedesRef?: string;
}

export interface ProposeResult {
  ok: boolean;
  error?: string;
  detail?: string;
  proposal_ref?: string;
  reference?: string;
}

const isSection = (v: string): v is ContentSection =>
  (CONTENT_SECTIONS as readonly string[]).includes(v);

/** Serialise for a pgvector column, which parses a bracketed list. */
const toVectorLiteral = (embedding: number[]): string => `[${embedding.join(",")}]`;

export async function proposeContent(
  service: SupabaseServiceClient,
  opts: ProposeOptions,
): Promise<ProposeResult> {
  // ── Vocabulary ────────────────────────────────────────────────────────
  // Checked before anything costs money. A section outside the indexed set
  // has nothing to retrieve, so it is refused rather than answered with an
  // ungrounded draft.
  if (!isSection(opts.section)) {
    return { ok: false, error: "unknown_section", detail: opts.section };
  }
  if (!(CONTENT_TYPES as readonly string[]).includes(opts.contentType)) {
    return { ok: false, error: "unknown_content_type", detail: opts.contentType };
  }
  if (!(CONTENT_PLATFORMS as readonly string[]).includes(opts.platform)) {
    return { ok: false, error: "unknown_platform", detail: opts.platform };
  }

  // ── The existing guard, not a new one ─────────────────────────────────
  const { data: allowed, error: rateError } = await service.rpc("check_ai_rate_limit", {
    _user_id: opts.actorId,
    _function_name: RATE_LIMIT_FUNCTION,
  });
  // Fails closed: unlike a chat reply, a refused draft costs the owner nothing
  // and an unmetered generation loop costs real money.
  if (rateError) return { ok: false, error: "rate_limit_unavailable" };
  if (allowed === false) return { ok: false, error: "rate_limited" };

  // ── Discovery, through the existing index ─────────────────────────────
  let seedEmbedding: number[];
  try {
    [seedEmbedding] = await createEmbedding([SECTION_SEEDS[opts.section]]);
  } catch {
    return { ok: false, error: "embedding_failed" };
  }

  const { data: matches, error: matchError } = await service.rpc("match_embeddings", {
    query_embedding: seedEmbedding,
    match_count: MAX_SOURCES_PER_DRAFT * 3,
    filter_source: opts.section,
  });
  if (matchError) return { ok: false, error: "discovery_failed" };

  const retrieved = (matches ?? []) as Array<{
    source_table: string; source_id: string; content: string; similarity: number;
  }>;
  if (retrieved.length === 0) {
    // Honest answer: this section is indexed but currently holds nothing to
    // talk about. Inventing a topic here is exactly what was forbidden.
    return { ok: false, error: "no_indexed_content", detail: opts.section };
  }

  // ── Duplicate prevention, layer 3: source cooldown ────────────────────
  const { data: cooling } = await service.rpc("content_sources_in_cooldown", {
    _source_ids: retrieved.map((r) => r.source_id),
    _cooldown_days: SOURCE_COOLDOWN_DAYS,
  });
  const onCooldown = new Set(
    ((cooling ?? []) as Array<{ source_id: string }>).map((r) => r.source_id),
  );

  const usable = retrieved.filter((r) => !onCooldown.has(r.source_id)).slice(0, MAX_SOURCES_PER_DRAFT);
  if (usable.length === 0) {
    return { ok: false, error: "all_sources_on_cooldown", detail: opts.section };
  }

  // ── Memory, as context only ───────────────────────────────────────────
  const { data: memoryRows } = await service
    .from("content_memory")
    .select("memory_type, topic, lesson")
    .or(`section.eq.${opts.section},section.is.null`)
    .order("created_at", { ascending: false })
    .limit(MAX_MEMORY_ROWS);

  const { memory, avoid } = buildMemoryContext((memoryRows ?? []) as Array<{
    memory_type: string; topic: string | null; lesson: string;
  }>);

  // ── Draft, through the registry entry ─────────────────────────────────
  const generator = getGenerator("content-writer");
  if (!generator?.schema) return { ok: false, error: "generator_missing" };

  const params: Record<string, string> = {
    section: opts.section,
    contentType: opts.contentType,
    platform: opts.platform,
    sources: renderSourcesForPrompt(usable),
    memory,
    avoid,
  };

  let draft: Record<string, unknown>;
  try {
    draft = (await structuredCompletion({
      provider: generator.provider,
      model: generator.model,
      system: generator.buildSystem(params, opts.language),
      userText: generator.buildUser(params, opts.language),
      schema: generator.schema,
      toolName: generator.toolName ?? "content_proposal",
      maxTokens: 1500,
    })) as Record<string, unknown>;
  } catch {
    return { ok: false, error: "generation_failed" };
  }

  await service.from("ai_usage_log").insert({
    user_id: opts.actorId,
    function_name: RATE_LIMIT_FUNCTION,
  });

  // ── Screening ─────────────────────────────────────────────────────────
  const topic = typeof draft.topic === "string" ? draft.topic.trim() : "";
  const hook = typeof draft.hook === "string" ? draft.hook.trim() : "";
  const body = typeof draft.body === "string" ? draft.body.trim() : "";
  if (!topic || !hook || !body) return { ok: false, error: "incomplete_draft" };

  // Confidentiality is enforced here, not left to the prompt. A draft that
  // names a supplier or a cost is discarded rather than cleaned up: a partial
  // scrub would leave the model believing that content was acceptable.
  const leak = detectConfidentialLeak([topic, hook, body, String(draft.rationale ?? "")].join("\n"));
  if (leak.length > 0) {
    console.error("[content-engine] draft rejected, confidential terms:", leak.join(", "));
    return { ok: false, error: "confidentiality_violation", detail: leak.join(", ") };
  }

  const sourceRefs = validateSourceRefs(draft.source_refs, usable);
  if (sourceRefs.length === 0) {
    // Every proposal must be traceable to indexed evidence. A draft citing
    // nothing real is ungrounded by definition.
    return { ok: false, error: "no_valid_sources" };
  }

  // ── Duplicate prevention, layer 2: near-duplicate ─────────────────────
  let topicEmbedding: number[];
  try {
    [topicEmbedding] = await createEmbedding([topic]);
  } catch {
    return { ok: false, error: "embedding_failed" };
  }

  const { data: similar } = await service.rpc("match_content_proposals", {
    query_embedding: topicEmbedding,
    match_threshold: NEAR_DUPLICATE_THRESHOLD,
    lookback_days: DEDUPE_LOOKBACK_DAYS,
    match_count: 3,
  });
  const nearest = ((similar ?? []) as Array<{ proposal_ref: string; topic: string; similarity: number }>)[0];
  if (nearest) {
    return {
      ok: false,
      error: "near_duplicate",
      detail: `${nearest.proposal_ref}: ${nearest.topic}`,
    };
  }

  // ── Persist: proposal and approval in one transaction ─────────────────
  let supersedesId: string | null = null;
  if (opts.supersedesRef) {
    const { data: previous } = await service
      .from("content_proposals")
      .select("id")
      .eq("proposal_ref", opts.supersedesRef.toUpperCase())
      .maybeSingle();
    supersedesId = (previous as { id: string } | null)?.id ?? null;
  }

  const { data: created, error: createError } = await service.rpc("create_content_proposal", {
    _proposal: {
      content_type: typeof draft.content_type === "string" ? draft.content_type : opts.contentType,
      section: opts.section,
      platform: typeof draft.platform === "string" ? draft.platform : opts.platform,
      topic,
      topic_key: normalizeTopicKey(topic),
      topic_embedding: toVectorLiteral(topicEmbedding),
      hook,
      body,
      hashtags: Array.isArray(draft.hashtags)
        ? (draft.hashtags as unknown[]).filter((h): h is string => typeof h === "string").slice(0, 12)
        : [],
      rationale: typeof draft.rationale === "string" ? draft.rationale : "",
      target_audience: typeof draft.target_audience === "string" ? draft.target_audience : null,
      language: opts.language,
      source_refs: sourceRefs,
      proposed_publish_at: normalizeProposedTime(draft.proposed_publish_at),
      supersedes_id: supersedesId,
    },
    _actor_id: opts.actorId,
  });

  if (createError) {
    console.error("[content-engine] create failed:", createError.message);
    return { ok: false, error: "create_failed" };
  }

  const result = created as ProposeResult;
  if (!result?.ok) return { ok: false, error: result?.error ?? "create_failed" };

  return { ok: true, proposal_ref: result.proposal_ref, reference: result.reference };
}
