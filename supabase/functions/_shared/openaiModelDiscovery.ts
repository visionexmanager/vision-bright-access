// OpenAI model discovery — the I/O around openaiModelCatalog.ts.
//
// GET https://api.openai.com/v1/models with the existing OPENAI_API_KEY (the
// project has no OpenAI SDK; every OpenAI call here is plain fetch, as this
// one is). Server-side only: called from provider-hub by an admin or by the
// scheduled workflow, never from a user request path — routing reads the
// catalog, it never asks OpenAI.
//
// The key is read here and sent in one header. It is never logged, stored or
// returned, and an OpenAI error body is never passed on: a failure is a short
// code, because an error body can echo a request header.

import {
  type CatalogRow,
  type DiscoveryReport,
  normalizeOpenAIModels,
  planReconciliation,
} from "./openaiModelCatalog.ts";

export type DiscoveryFailure = "no_key" | "rejected" | "unavailable" | "unreachable" | "empty" | "store_failed";

export type DiscoveryOutcome =
  | { ok: true; dryRun: boolean; report: DiscoveryReport }
  | { ok: false; error: DiscoveryFailure; status?: number };

/** The service client, as far as this file uses it. */
// deno-lint-ignore no-explicit-any
type CatalogDb = any;

export interface DiscoveryDeps {
  db: CatalogDb;
  read: (name: string) => string | undefined;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
}

export async function discoverOpenAIModels(deps: DiscoveryDeps, options: { dryRun: boolean }): Promise<DiscoveryOutcome> {
  const key = deps.read("OPENAI_API_KEY");
  if (!key) return { ok: false, error: "no_key" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? 15_000);
  let payload: unknown;
  try {
    const response = await (deps.fetchImpl ?? fetch)("https://api.openai.com/v1/models", {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
      signal: controller.signal,
    });
    if (response.status === 401 || response.status === 403) return { ok: false, error: "rejected", status: response.status };
    if (!response.ok) return { ok: false, error: "unavailable", status: response.status };
    payload = await response.json();
  } catch {
    return { ok: false, error: "unreachable" };
  } finally {
    clearTimeout(timer);
  }

  const discovered = normalizeOpenAIModels(payload);
  // An empty list is refused, not reconciled: it would mark every model
  // unavailable on what is far more likely a broken response than a real one.
  if (discovered.length === 0) return { ok: false, error: "empty" };

  const { data: existing, error: readError } = await deps.db
    .from("ph_provider_models")
    .select("model_id, available, capabilities, capability_source, pricing, routing_enabled, first_seen_at")
    .eq("provider", "openai");
  if (readError) return { ok: false, error: "store_failed" };

  const nowIso = (deps.now?.() ?? new Date()).toISOString();
  const plan = planReconciliation(discovered, (existing ?? []) as CatalogRow[], nowIso);
  if (options.dryRun) return { ok: true, dryRun: true, report: plan.report };

  // New models: inserted once. ignoreDuplicates makes a concurrent second run
  // a no-op rather than an overwrite of what the first wrote.
  if (plan.inserts.length > 0) {
    const { error } = await deps.db
      .from("ph_provider_models")
      .upsert(plan.inserts, { onConflict: "provider,model_id", ignoreDuplicates: true });
    if (error) return { ok: false, error: "store_failed" };
  }
  // Seen models: discovery columns only, one row at a time by exact id.
  for (const { model_id, patch } of plan.seen) {
    const { error } = await deps.db.from("ph_provider_models").update(patch)
      .eq("provider", "openai").eq("model_id", model_id);
    if (error) return { ok: false, error: "store_failed" };
  }
  // Gone models: marked, never deleted.
  if (plan.unavailable.length > 0) {
    const { error } = await deps.db.from("ph_provider_models")
      .update({ available: false, unavailable_since: nowIso, updated_at: nowIso })
      .eq("provider", "openai").in("model_id", plan.unavailable);
    if (error) return { ok: false, error: "store_failed" };
  }
  return { ok: true, dryRun: false, report: plan.report };
}
