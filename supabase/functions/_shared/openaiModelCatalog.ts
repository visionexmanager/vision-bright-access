// OpenAI model discovery — the decisions, with no I/O.
//
// Three different things, never treated as one:
//   * what OpenAI publishes in its docs            (not consulted here)
//   * what this project's key can see              (GET /v1/models → `available`)
//   * what Visionex may route to, for what         (curated capabilities, pricing,
//                                                   routing_enabled)
//
// Discovery only ever writes the second. It inserts a model it has not seen,
// refreshes one it has, and marks one that has gone missing unavailable — it
// never deletes a row and never touches the curated columns. So a new model
// arrives registered but not routable, and stays that way until someone who
// has checked its price and capability says otherwise. Fail closed.
//
// Pure: fetch, database and clock are the caller's. See openaiModelDiscovery.ts.

/** The capability names a catalog row may carry: ph_providers.type, plus embedding. */
export const MODEL_CAPABILITIES = [
  "chat", "vision", "tts", "stt", "image", "text_to_video", "voice_cloning", "embedding",
] as const;
export type ModelCapability = typeof MODEL_CAPABILITIES[number];

/** One model as GET /v1/models returned it, after validation. */
export interface DiscoveredModel {
  model_id: string;
  owned_by: string | null;
  upstream_created_at: string | null;
}

/** The columns of ph_provider_models that reconciliation reads. */
export interface CatalogRow {
  model_id: string;
  available: boolean;
  capabilities: string[];
  capability_source: "curated" | "classified" | "unknown";
  pricing: Record<string, unknown> | null;
  routing_enabled: boolean;
  first_seen_at: string | null;
}

/** The same pattern the table's CHECK enforces. Anything else is not a model id. */
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

/**
 * The `data` array of a /v1/models response, validated and de-duplicated.
 *
 * The id is kept exactly as OpenAI wrote it — `gpt-5.6-luna` stays
 * `gpt-5.6-luna`. An entry with a malformed id is dropped rather than repaired:
 * a guess at what a model is called is a model nobody asked for.
 */
export function normalizeOpenAIModels(payload: unknown): DiscoveredModel[] {
  const data = (payload as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];
  const seen = new Map<string, DiscoveredModel>();
  for (const entry of data) {
    const id = (entry as { id?: unknown } | null)?.id;
    if (typeof id !== "string" || !MODEL_ID.test(id) || seen.has(id)) continue;
    const ownedBy = (entry as { owned_by?: unknown }).owned_by;
    const created = (entry as { created?: unknown }).created;
    seen.set(id, {
      model_id: id,
      owned_by: typeof ownedBy === "string" ? ownedBy.slice(0, 100) : null,
      upstream_created_at: typeof created === "number" && Number.isFinite(created) && created > 0
        ? new Date(created * 1000).toISOString()
        : null,
    });
  }
  return [...seen.values()].sort((a, b) => a.model_id.localeCompare(b.model_id));
}

/**
 * What a model id's family says it can do — for a model nobody has curated yet.
 *
 * Deliberately narrow. Each rule names a family whose single purpose is
 * unambiguous from OpenAI's own naming (an image model, a speech model, a
 * transcription model, an embedding model, a GPT text model). Everything else —
 * realtime, audio-in/out chat, search, computer-use, o-series reasoning, legacy
 * completions, moderation, anything new — returns no capability at all, and so
 * can never be routed. Vision is never inferred from a name; only curation
 * grants it.
 *
 * A classification is informational until curated: without pricing and
 * routing_enabled, no classified model is routable.
 */
export function classifyOpenAIModel(modelId: string): ModelCapability[] {
  const id = modelId.toLowerCase();
  if (/(realtime|audio|search|computer-use|moderation|codex|instruct|davinci|babbage|sora)/.test(id)) return [];
  if (/^(gpt-image-|dall-e-)/.test(id)) return ["image"];
  if (/^tts-1(-hd)?(-\d{4})?$/.test(id) || /-tts(-\d{4}-\d{2}-\d{2})?$/.test(id)) return ["tts"];
  if (/^whisper-\d$/.test(id) || /-transcribe(-\d{4}-\d{2}-\d{2})?$/.test(id)) return ["stt"];
  if (/^text-embedding-/.test(id)) return ["embedding"];
  if (/^gpt-(4o|4\.1|5(\.\d+)?)(-(mini|nano|luna|sol|terra))?(-\d{4}-\d{2}-\d{2})?$/.test(id)) return ["chat"];
  return [];
}

/** Routing-eligible: every condition holds, or it is not. Mirrors ph_provider_models_routable. */
export function isRoutingEligible(row: Pick<CatalogRow, "available" | "capabilities" | "pricing" | "routing_enabled">): boolean {
  return row.available && row.routing_enabled && row.pricing !== null && row.capabilities.length > 0;
}

/** What a dry run shows, and what an applied run also returns. Ids and flags only — no prices. */
export interface DiscoveryReport {
  returned: string[];
  already_registered: string[];
  new: string[];
  now_unavailable: string[];
  missing_pricing: string[];
  missing_capabilities: string[];
  routing_eligible: string[];
}

export interface ReconciliationPlan {
  report: DiscoveryReport;
  /** Rows to insert, for models the catalog has never had. */
  inserts: Array<Record<string, unknown>>;
  /** Discovery columns to refresh on models already in the catalog. */
  seen: Array<{ model_id: string; patch: Record<string, unknown> }>;
  /** Models to mark unavailable: listed before, absent now. */
  unavailable: string[];
}

/**
 * Compare one discovery against the catalog and say what to write.
 *
 * Idempotent by construction: identity is the exact model id, a model already
 * present is updated rather than inserted, and a second run over the same list
 * plans the same refresh and no inserts. An empty discovery is refused by the
 * caller before this is reached — an empty list is far likelier to be a broken
 * response than OpenAI withdrawing every model at once.
 */
export function planReconciliation(
  discovered: DiscoveredModel[],
  existing: CatalogRow[],
  nowIso: string,
): ReconciliationPlan {
  const byId = new Map(existing.map((row) => [row.model_id, row]));
  const seenIds = new Set(discovered.map((m) => m.model_id));

  const inserts: ReconciliationPlan["inserts"] = [];
  const seen: ReconciliationPlan["seen"] = [];
  const after = new Map<string, CatalogRow>();

  for (const model of discovered) {
    const row = byId.get(model.model_id);
    const upstream = { owned_by: model.owned_by, upstream_created_at: model.upstream_created_at };
    if (!row) {
      const capabilities = classifyOpenAIModel(model.model_id);
      const inserted: CatalogRow = {
        model_id: model.model_id,
        available: true,
        capabilities,
        capability_source: capabilities.length > 0 ? "classified" : "unknown",
        pricing: null,
        routing_enabled: false,
        first_seen_at: nowIso,
      };
      inserts.push({
        provider: "openai",
        model_id: model.model_id,
        ...upstream,
        first_seen_at: nowIso,
        last_seen_at: nowIso,
        available: true,
        unavailable_since: null,
        capabilities,
        capability_source: inserted.capability_source,
        pricing: null,
        routing_enabled: false,
        updated_at: nowIso,
      });
      after.set(model.model_id, inserted);
      continue;
    }
    // Discovery columns only. Capabilities, pricing and routing_enabled are
    // curated and are not this function's to change.
    seen.push({
      model_id: model.model_id,
      patch: {
        ...upstream,
        ...(row.first_seen_at ? {} : { first_seen_at: nowIso }),
        last_seen_at: nowIso,
        available: true,
        unavailable_since: null,
        updated_at: nowIso,
      },
    });
    after.set(model.model_id, { ...row, available: true });
  }

  const unavailable: string[] = [];
  for (const row of existing) {
    if (seenIds.has(row.model_id)) continue;
    if (row.available) unavailable.push(row.model_id);
    after.set(row.model_id, { ...row, available: false });
  }

  const rows = [...after.values()].sort((a, b) => a.model_id.localeCompare(b.model_id));
  const ids = (list: CatalogRow[]) => list.map((r) => r.model_id);
  return {
    report: {
      returned: discovered.map((m) => m.model_id),
      already_registered: discovered.filter((m) => byId.has(m.model_id)).map((m) => m.model_id),
      new: inserts.map((r) => r.model_id as string),
      now_unavailable: unavailable,
      missing_pricing: ids(rows.filter((r) => r.available && r.pricing === null)),
      missing_capabilities: ids(rows.filter((r) => r.available && r.capabilities.length === 0)),
      routing_eligible: ids(rows.filter(isRoutingEligible)),
    },
    inserts,
    seen,
    unavailable,
  };
}
