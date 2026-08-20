// Phase 9, step 7 — the worker. The first thing in Visionex that can publish.
//
// Everything before this built the parts: the queue and its gate (Phase 8), the
// recovery path, the token store, the OAuth upgrade that yields a page token,
// and the activation that lets an account go `active`. None of it ever ran,
// because nothing called claim_due_content_slot(). This does.
//
// It is deliberately thin. The publishing protocol — claim, readiness, mark,
// publish once, record — lives in _shared/publishing/runner.ts and is driven by
// 3,000 lines of tests. This function resolves credentials, builds the adapter
// map, and hands both to the runner. It contains no retry, no loop over the
// same slot, and no decision about what a failure means.
//
// ── Why one function and not one per platform ──────────────────────────────
//
// The Supabase project is near its Edge Function ceiling. Three functions here
// would buy nothing: the runner already claims per platform when asked, and the
// adapters differ by a few dozen lines each.
//
// ── Authorisation ──────────────────────────────────────────────────────────
//
// CRON_SECRET, and it fails CLOSED. trial-billing checks `if (secret)`, which
// silently accepts every caller when the variable is unset; that is survivable
// for a billing sweep and is not survivable here, because an unauthenticated
// request to this endpoint publishes to the company's public accounts.

import { createClient } from "npm:@supabase/supabase-js@2";
import { defaultAdapters } from "../_shared/publishing/adapters.ts";
import { metaAdapters, type PublishFetch } from "../_shared/publishing/metaAdapters.ts";
import { runPublishBatch } from "../_shared/publishing/runner.ts";
import type {
  ClaimResult,
  Platform,
  PublishAdapter,
  PublishRequest,
  PublishingPorts,
  RecordInput,
  RpcResult,
} from "../_shared/publishing/types.ts";

const env = (name: string) => Deno.env.get(name);

/** How many attempts one invocation may make. Bounded so a run cannot spin. */
const DEFAULT_LIMIT = 10;

/**
 * The service-role client, and its type derived from this factory.
 *
 * Not `ReturnType<typeof createClient>`: that instantiates the generic with its
 * *default* type arguments, where the schema is `never` — so every `.rpc()`
 * call is typed as taking no arguments at all and each of the four RPCs below
 * fails to compile. Deriving from a concrete call keeps the arguments the
 * inference actually produced. Same shape as `whatsapp-webhook`.
 */
function serviceClient() {
  return createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!);
}

type Service = ReturnType<typeof serviceClient>;

// ── Reading the claim payload ────────────────────────────────────────────────
//
// snake_case from the database to camelCase for the runner, in one place. Doing
// this at each use site is how a field silently becomes undefined and a post
// goes out with an empty body.

function toRequest(row: Record<string, unknown>): PublishRequest {
  const account = (row.account ?? {}) as Record<string, unknown>;
  return {
    publicationId: String(row.publication_id ?? ""),
    calendarId: String(row.calendar_id ?? ""),
    proposalRef: String(row.proposal_ref ?? ""),
    platform: row.platform as Platform,
    contentType: String(row.content_type ?? ""),
    language: String(row.language ?? "en"),
    hook: String(row.hook ?? ""),
    body: String(row.body ?? ""),
    hashtags: Array.isArray(row.hashtags) ? row.hashtags.map(String) : [],
    // Absent from every proposal today; see PublishRequest.mediaUrl.
    mediaUrl: typeof row.media_url === "string" ? row.media_url : undefined,
    attempt: Number(row.attempt ?? 1),
    maxAttempts: Number(row.max_attempts ?? 1),
    account: {
      id: String(account.id ?? ""),
      handle: String(account.handle ?? ""),
      externalAccountId: (account.external_account_id as string | null) ?? null,
      capabilities: Array.isArray(account.capabilities) ? account.capabilities.map(String) : [],
      apiKeyRef: (account.api_key_ref as string | null) ?? null,
      baseUrl: (account.base_url as string | null) ?? null,
      config: (account.config ?? {}) as Record<string, unknown>,
    },
  };
}

/** The three RPCs, and nothing else. */
function createPorts(service: Service): PublishingPorts {
  return {
    async claimSlot(platform): Promise<ClaimResult> {
      const { data, error } = await service.rpc("claim_due_content_slot", {
        _platform: platform,
        _max_attempts: null,
      });
      if (error || !data) return { ok: false, error: "claim_call_failed" };

      const row = data as Record<string, unknown>;
      if (row.ok !== true) {
        return {
          ok: false,
          error: String(row.error ?? "claim_refused"),
          // Carried through so "nothing due" and "blocked on a reconnection"
          // stay distinguishable all the way to the response.
          withheldForConnection: Number(row.withheld_for_connection ?? 0),
          awaitingConnection: Array.isArray(row.awaiting_connection)
            ? (row.awaiting_connection as Platform[])
            : [],
        };
      }
      return { ok: true, request: toRequest(row) };
    },

    async markDispatched(publicationId): Promise<RpcResult> {
      const { data, error } = await service.rpc("mark_publication_dispatched", {
        _publication_id: publicationId,
      });
      if (error || !data) return { ok: false, error: "dispatch_call_failed" };
      const row = data as Record<string, unknown>;
      return { ok: row.ok === true, error: row.error ? String(row.error) : undefined };
    },

    async recordResult(input: RecordInput): Promise<RpcResult> {
      const { data, error } = await service.rpc("record_content_publication", {
        _publication_id: input.publicationId,
        _success: input.success,
        _external_post_id: input.externalPostId ?? null,
        _external_url: input.externalUrl ?? null,
        _error_code: input.errorCode ?? null,
        _error_message: input.errorMessage ?? null,
      });
      if (error || !data) return { ok: false, error: "record_call_failed" };
      const row = data as Record<string, unknown>;
      return {
        ok: row.ok === true,
        error: row.error ? String(row.error) : undefined,
        state: row.state ? String(row.state) : undefined,
      };
    },
  };
}

// ── Credentials ──────────────────────────────────────────────────────────────

/**
 * Decrypt the grant for every account that could be claimed, before the run.
 *
 * Eager rather than on demand because readiness() is synchronous, and readiness
 * is what keeps an account with no usable token from costing a dispatch marker
 * — a marker parks the slot for a human, and "the token would not decrypt" is
 * not something a human should have to unpark a slot over.
 *
 * At most seven rows. Nothing is logged, and the map never leaves this scope.
 */
async function resolveTokens(service: Service, key: string): Promise<Map<string, string>> {
  const tokens = new Map<string, string>();

  const { data: accounts } = await service
    .from("social_accounts")
    .select("id")
    .eq("status", "active");

  for (const account of (accounts ?? []) as Array<{ id: string }>) {
    const { data } = await service.rpc("resolve_social_account_token", {
      _account_id: account.id,
      _key: key,
    });
    const row = data as Record<string, unknown> | null;
    // An expired or unreadable grant simply contributes no entry. The adapter
    // then refuses at readiness, which is the cheap, non-parking path.
    if (row?.ok === true && typeof row.access_token === "string") {
      tokens.set(account.id, row.access_token);
    }
  }

  return tokens;
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Fails closed. An unset secret means this endpoint answers nobody, which is
  // the correct posture for the one endpoint that can post publicly.
  const cronSecret = env("CRON_SECRET");
  if (!cronSecret) return json({ ok: false, error: "not_configured" }, 503);
  if (req.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  const encryptionKey = env("SOCIAL_TOKEN_ENCRYPTION_KEY");
  if (!encryptionKey) {
    // Without it no grant can be decrypted, so every attempt would refuse at
    // readiness. Saying so once is more useful than ten identical refusals.
    return json({ ok: false, error: "encryption_key_missing", attempts: [] }, 503);
  }

  try {
    const service = serviceClient();

    const body = await req.json().catch(() => ({}));
    const platform = typeof body.platform === "string" ? body.platform as Platform : null;
    const limit = Number.isFinite(body.limit) ? Number(body.limit) : DEFAULT_LIMIT;

    const tokens = await resolveTokens(service, encryptionKey);

    const deps = {
      tokenFor: (accountId: string) => tokens.get(accountId),
      fetchImpl: fetch as unknown as PublishFetch,
    };

    // Everything refuses by default; the three Meta platforms are replaced with
    // real adapters. A platform with no adapter still answers `not_configured`
    // and costs no dispatch, which is what keeps TikTok and YouTube inert.
    const adapters = new Map<Platform, PublishAdapter>(defaultAdapters());
    for (const [name, adapter] of metaAdapters(deps)) {
      adapters.set(name as Platform, adapter);
    }

    const reports = await runPublishBatch(createPorts(service), adapters, { platform, limit });

    // A report carries no token and no provider text — only ids, codes and
    // counts — so it is safe to return and safe for the caller to log.
    const published = reports.filter((report) => report.ok).length;
    const needsReview = reports.filter((report) => report.needsManualReview).length;
    const idle = reports.find((report) => report.status === "idle");

    return json({
      ok: true,
      attempted: reports.length,
      published,
      needs_manual_review: needsReview,
      // Surfaced at the top level because it is the one operational fact that
      // looks identical to an empty queue and is not one.
      withheld_for_connection: idle?.withheldForConnection ?? 0,
      awaiting_connection: idle?.awaitingConnection ?? [],
      attempts: reports.map((report) => ({
        status: report.status,
        platform: report.platform,
        publication_id: report.publicationId,
        attempt: report.attempt,
        external_post_id: report.externalPostId,
        error_code: report.errorCode,
        needs_manual_review: report.needsManualReview ?? false,
      })),
    });
  } catch {
    // No detail crosses this boundary: an exception raised mid-publish can
    // carry a request body, and a request body here carries a bearer token.
    return json({ ok: false, error: "internal_error" }, 500);
  }
});
