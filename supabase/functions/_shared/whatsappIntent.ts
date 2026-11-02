// Recognising what somebody meant when they did not use the words we stored.
//
// ── The problem ─────────────────────────────────────────────────────────────
//
// The router matches a whole message against a feature's name and aliases, and
// the parsers match fixed shapes. A sender who writes "I want to turn my
// document into something I can edit" gets neither, and the message falls
// through to the general assistant, which does not know a feature exists for it.
//
// ── What this does ──────────────────────────────────────────────────────────
//
// Every feature is written down in several ways (its name in twenty languages,
// a description, its aliases) and each of those strings is turned into an
// embedding once. An incoming message that nothing else claimed is embedded
// too, and the closest feature wins — by meaning, in any language, with typos.
//
// ── What it deliberately does not do ────────────────────────────────────────
//
// It never opens the feature. A wrong guess that *did something* is far worse
// than no guess, so a strong match only produces a question — "did you mean X?
// send 'x' to open it" — and the sender's reply goes through the ordinary
// router. The threshold is high on purpose: below it the message goes to the
// assistant exactly as before, so the cost of a weak guess is nothing.
//
// Only features the router can already open by typing are candidates (they have
// an alias), because the suggestion tells the sender what to type.
//
// Pure apart from the two ports (`embed` and the database), so the suite drives
// every branch with fake vectors.

import { aliasesOf, CATALOG, localized, ROOT_ID, type CatalogNode, type Language } from "./whatsappCatalog.ts";
import { SUPPORTED_LANGUAGES } from "./whatsappLanguages.ts";

/** Cosine similarity the best feature must reach before anything is suggested. */
export const INTENT_MIN_SIMILARITY = 0.5;
/** And how far ahead of the next *different* feature it must be. */
export const INTENT_MIN_MARGIN = 0.04;
/** Longest message that is read as a request for a feature rather than a conversation. */
export const INTENT_MAX_CHARS = 80;
export const INTENT_MAX_WORDS = 9;
const EMBED_BATCH = 200;

export interface IntentRow {
  nodeId: string;
  content: string;
}

/** The features that can be suggested: visible, and openable by typing a name. */
export function suggestableNodes(nodes: readonly CatalogNode[] = CATALOG): CatalogNode[] {
  return nodes.filter((node) =>
    node.id !== ROOT_ID && !node.hidden && (aliasesOf(node, "ar").length > 0 || aliasesOf(node, "en").length > 0)
  );
}

/** Every string that describes a feature, once each, bounded. */
export function intentCorpus(nodes: readonly CatalogNode[] = CATALOG): IntentRow[] {
  const rows: IntentRow[] = [];
  for (const node of suggestableNodes(nodes)) {
    const seen = new Set<string>();
    const add = (value: string | undefined) => {
      const text = (value ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
      if (text.length < 2 || seen.has(text)) return;
      seen.add(text);
      rows.push({ nodeId: node.id, content: text });
    };
    for (const language of SUPPORTED_LANGUAGES) add(node.title[language as Language]);
    add(localized(node.description, "en"));
    add(localized(node.description, "ar"));
    for (const alias of [...aliasesOf(node, "en"), ...aliasesOf(node, "ar")]) add(alias);
  }
  return rows;
}

/** Fingerprint of the corpus, so a catalog edit rebuilds the index and nothing else does. */
export function corpusHash(rows: readonly IntentRow[]): string {
  let hash = 0x811c9dc5;
  for (const row of [...rows].map((r) => `${r.nodeId}|${r.content}`).sort()) {
    for (let i = 0; i < row.length; i++) {
      hash ^= row.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  }
  return hash.toString(16).padStart(8, "0");
}

export interface IntentMatch {
  nodeId: string;
  similarity: number;
}

export type IntentDecision =
  | { kind: "suggest"; nodeId: string; similarity: number; margin: number }
  | { kind: "none"; reason: "no_matches" | "weak" | "ambiguous"; top: number; margin: number };

/** The best feature if it is clearly the best, otherwise why not. */
export function decideIntent(matches: readonly IntentMatch[]): IntentDecision {
  const best = new Map<string, number>();
  for (const match of matches) {
    if (!Number.isFinite(match.similarity)) continue;
    if (match.similarity > (best.get(match.nodeId) ?? -1)) best.set(match.nodeId, match.similarity);
  }
  const ranked = [...best.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return { kind: "none", reason: "no_matches", top: 0, margin: 0 };
  const [nodeId, top] = ranked[0];
  const margin = ranked.length > 1 ? top - ranked[1][1] : top;
  if (top < INTENT_MIN_SIMILARITY) return { kind: "none", reason: "weak", top, margin };
  if (margin < INTENT_MIN_MARGIN) return { kind: "none", reason: "ambiguous", top, margin };
  return { kind: "suggest", nodeId, similarity: top, margin };
}

/** Whether a message is the right size to be a request for a feature. */
export function looksLikeARequest(text: string): boolean {
  const trimmed = (text ?? "").trim();
  if (trimmed.length < 3 || trimmed.length > INTENT_MAX_CHARS) return false;
  if (trimmed.split(/\s+/).length > INTENT_MAX_WORDS) return false;
  // A link or a number on its own is data, not a request.
  if (/^(https?:\/\/|\+?[\d\s().-]+$)/i.test(trimmed)) return false;
  return true;
}

// ── The index, in the database ───────────────────────────────────────────────

export interface IntentDb {
  // deno-lint-ignore no-explicit-any
  from(table: string): any;
  // deno-lint-ignore no-explicit-any
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: any; error: any }>;
}

export type Embedder = (texts: string[]) => Promise<number[][]>;

const vectorText = (vector: readonly number[]): string => `[${vector.join(",")}]`;

/**
 * Make sure the index holds this corpus, building it when it does not.
 *
 * Two instances racing to build is harmless: the rows are keyed by hash,
 * node and content, and the upsert makes the second a no-op. Rows of an older
 * hash are removed only after the new ones are in, so there is never a moment
 * with no index.
 */
export async function ensureIntentIndex(db: IntentDb, embed: Embedder, rows: readonly IntentRow[], hash: string): Promise<boolean> {
  const { data: existing, error } = await db.from("whatsapp_intent_index").select("node_id").eq("catalog_hash", hash).limit(1);
  if (error) return false;
  if (Array.isArray(existing) && existing.length > 0) return true;

  for (let start = 0; start < rows.length; start += EMBED_BATCH) {
    const chunk = rows.slice(start, start + EMBED_BATCH);
    const vectors = await embed(chunk.map((row) => row.content));
    if (vectors.length !== chunk.length) return false;
    const { error: writeError } = await db.from("whatsapp_intent_index").upsert(
      chunk.map((row, i) => ({
        catalog_hash: hash,
        node_id: row.nodeId,
        content: row.content,
        embedding: vectorText(vectors[i]),
      })),
      { onConflict: "catalog_hash,node_id,content" },
    );
    if (writeError) return false;
  }
  await db.from("whatsapp_intent_index").delete().neq("catalog_hash", hash);
  return true;
}

export interface IntentGuess {
  nodeId: string;
  title: string;
  alias: string;
  similarity: number;
}

/**
 * The feature this message most likely means, or null.
 *
 * `reason` is filled when there is no guess, for the log line: a number and a
 * word, never the message.
 */
export async function guessIntent(params: {
  db: IntentDb;
  embed: Embedder;
  text: string;
  language: Language;
  /** Whether a feature is switched on for this sender; an off feature is not offered. */
  isOn: (nodeId: string) => boolean;
}): Promise<{ guess: IntentGuess | null; reason: string; top: number; margin: number }> {
  const rows = intentCorpus();
  const hash = corpusHash(rows);
  if (!(await ensureIntentIndex(params.db, params.embed, rows, hash))) {
    return { guess: null, reason: "index_unavailable", top: 0, margin: 0 };
  }

  const [vector] = await params.embed([params.text.trim()]);
  if (!vector || vector.length === 0) return { guess: null, reason: "embed_failed", top: 0, margin: 0 };

  const { data, error } = await params.db.rpc("match_whatsapp_intents", {
    query_embedding: vectorText(vector),
    match_count: 12,
    p_hash: hash,
  });
  if (error || !Array.isArray(data)) return { guess: null, reason: "match_failed", top: 0, margin: 0 };

  const decision = decideIntent(
    data.map((row: { node_id: string; similarity: number }) => ({ nodeId: row.node_id, similarity: Number(row.similarity) })),
  );
  if (decision.kind === "none") return { guess: null, reason: decision.reason, top: decision.top, margin: decision.margin };

  const node = suggestableNodes().find((candidate) => candidate.id === decision.nodeId);
  if (!node || !params.isOn(node.id)) return { guess: null, reason: "unavailable", top: decision.similarity, margin: decision.margin };

  const alias = aliasesOf(node, params.language)[0] ?? aliasesOf(node, "en")[0] ?? aliasesOf(node, "ar")[0];
  if (!alias) return { guess: null, reason: "no_alias", top: decision.similarity, margin: decision.margin };

  return {
    guess: { nodeId: node.id, title: localized(node.title, params.language), alias, similarity: decision.similarity },
    reason: "suggest",
    top: decision.similarity,
    margin: decision.margin,
  };
}
