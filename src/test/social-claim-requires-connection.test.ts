import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { runPublishAttempt, runPublishBatch } from "../../supabase/functions/_shared/publishing/runner.ts";
import type {
  AdapterOutcome,
  ClaimResult,
  Platform,
  PublishAdapter,
  PublishRequest,
  PublishingPorts,
  RpcResult,
} from "../../supabase/functions/_shared/publishing/types.ts";

// Phase 9, step 3 — the claim path stops handing slots to accounts that cannot
// publish.
//
// Two things are asserted here, and they are different kinds of claim.
//
// The migration assertions are structural, like the rest of the Phase 8/9
// suite: what the SQL says is a property of the SQL, and no caller can be
// trusted to preserve it. They also compare the new claim function against the
// one it replaces, because "same signature, same success payload" is the reason
// this is a safe replacement and is exactly the kind of thing a restatement
// quietly breaks.
//
// The runner assertions are behavioural, and cover the second half of the
// change: a slot that is withheld costs no attempt, but it also disappears from
// the queue, and a worker that reports that as "nothing to do" has turned a
// visible failure into a silent one.
//
// The behaviour of the SQL itself was verified separately by executing the
// migration against PostgreSQL (PGlite) — see the PR. Vitest reads these files
// as text and cannot run them.

const MIGRATIONS = "supabase/migrations";

/** Read with the line endings normalised — this repo is worked on from Windows. */
const read = (file: string) => readFileSync(`${MIGRATIONS}/${file}`, "utf8").replace(/\r\n/g, "\n");

const intent = read("20260908000000_social_publishing_intent_and_parking.sql");
const store = read("20260910000000_social_oauth_token_store.sql");
const migration = read("20260911000000_social_claim_requires_connection.sql");

/** One CREATE FUNCTION body, up to the REVOKE that follows it. */
function functionBody(sql: string, name: string): string {
  const start = sql.indexOf(`FUNCTION public.${name}(`);
  expect(start, `${name} must exist`).toBeGreaterThan(-1);
  const end = sql.indexOf("REVOKE ALL ON FUNCTION", start);
  return sql.slice(start, end === -1 ? undefined : end);
}

const claim = functionBody(migration, "claim_due_content_slot");
const previousClaim = functionBody(intent, "claim_due_content_slot");
const liveGrant = functionBody(migration, "social_account_has_live_grant");

/** The `ok: true` payload, which must not have changed. */
function successPayload(fn: string): string {
  const start = fn.indexOf("RETURN jsonb_build_object(\n    'ok', true,");
  expect(start, "the success payload must be findable").toBeGreaterThan(-1);
  const end = fn.indexOf("\n  );", start);
  return fn.slice(start, end).replace(/\s+/g, " ").trim();
}

/** The claim's diagnostic query, which restates the claimability rule. */
const diagnostic = claim.slice(claim.indexOf("SELECT count(*)"), claim.indexOf("RETURN jsonb_build_object(\n      'ok', false"));

describe("a slot is only claimed for an account that can actually publish", () => {
  it("requires a live grant in the predicate, not after the claim", () => {
    // After would be too late: the UPDATE has already incremented attempts, so
    // a token that expires overnight would spend every retry a slot has before
    // anyone is awake to reconnect the account.
    const predicate = claim.slice(claim.indexOf("UPDATE public.content_calendar c"), claim.indexOf("RETURNING * INTO _slot"));
    expect(predicate).toContain("a.status = 'active'");
    expect(predicate).toContain("public.social_account_has_live_grant(a.id)");
  });

  it("applies the same requirement to the account it then selects", () => {
    const selection = claim.slice(claim.indexOf("SELECT * INTO _account"), claim.indexOf("IF NOT FOUND THEN", claim.indexOf("SELECT * INTO _account")));
    expect(selection).toContain("a.status = 'active'");
    expect(selection).toContain("public.social_account_has_live_grant(a.id)");
    // Unchanged: the account with the best priority still wins.
    expect(selection).toContain("ORDER BY a.priority, a.health_score DESC");
  });

  it("tells a disconnected account apart from a disabled one", () => {
    // Reconnecting and re-enabling are different actions on different screens,
    // and a worker log that conflates them sends a human to the wrong one.
    expect(claim).toContain("'no_connected_account'");
    expect(claim).toContain("'no_active_account'");
    expect(previousClaim).not.toContain("no_connected_account");
  });

  it("leaves the raced slot retryable rather than parked", () => {
    // resolve_content_slot with no park reason. Nothing dispatched, so there is
    // nothing to protect a human from re-running.
    expect(claim).toContain("PERFORM public.resolve_content_slot(_slot.id, _reason)");
    expect(claim).not.toMatch(/resolve_content_slot\(_slot\.id, _reason, '/);
  });
});

describe("what \"connected\" means is written once", () => {
  it("matches the rule resolve and the status function already apply", () => {
    // All three: a grant row exists, and its expiry has not passed. A NULL
    // expires_at is a token the platform put no clock on and is live in each.
    expect(liveGrant).toContain("t.expires_at IS NULL OR t.expires_at > now()");
    expect(store).toContain("_row.expires_at IS NOT NULL AND _row.expires_at <= now()");
    expect(store).toContain("WHEN t.expires_at IS NOT NULL AND t.expires_at <= now() THEN 'expired'");
  });

  it("reads no cipher column on any path", () => {
    expect(liveGrant).not.toContain("cipher");
    expect(liveGrant).not.toContain("pgp_sym_decrypt");
  });

  it("is invoker rights and granted to nobody", () => {
    // Its callers are SECURITY DEFINER and reach the table as the owner. Leaving
    // this one as invoker means a later migration that grants it to a browser
    // role still does not give that role a way to read the token table.
    expect(liveGrant).toContain("SECURITY INVOKER");
    expect(liveGrant).not.toContain("SECURITY DEFINER");
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.social_account_has_live_grant(uuid) FROM PUBLIC, anon, authenticated",
    );
    expect(migration).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.social_account_has_live_grant/);
  });
});

describe("a withheld slot is reported, not silently dropped", () => {
  it("answers no_due_slot with the count and the platforms", () => {
    expect(claim).toContain("'withheld_for_connection', _withheld");
    expect(claim).toContain("'awaiting_connection', _awaiting");
    // Zero and [] on a genuinely empty queue, so the caller can tell them apart
    // without a second round trip.
    expect(claim).toContain("coalesce(jsonb_agg(DISTINCT s.platform), '[]'::jsonb)");
  });

  it("counts a revoked platform, whose account is no longer active", () => {
    // revoke_social_account_token() disables the account it disconnects, so a
    // count restricted to active accounts would make the one disconnection a
    // person performs deliberately the one that vanished without a trace.
    expect(store).toMatch(/UPDATE public\.social_accounts[\s\S]*SET status = 'disabled'/);
    const platformHasAccount = diagnostic.slice(diagnostic.indexOf("AND EXISTS ("));
    expect(platformHasAccount).toContain("WHERE a.platform = s.platform)");
    expect(platformHasAccount.slice(0, platformHasAccount.indexOf("AND NOT EXISTS"))).not.toContain("a.status");
  });

  it("counts nothing for a platform Visionex has no account row for", () => {
    // website and newsletter publish themselves. They are not waiting on anyone.
    expect(diagnostic).toContain("AND EXISTS (");
    expect(diagnostic).toContain("AND NOT EXISTS (");
    expect(diagnostic).toContain("public.social_account_has_live_grant(a.id)");
  });

  it("restates every clause of the claimability rule, so the two cannot drift", () => {
    // The diagnostic is the claim predicate minus the connection test. If a
    // later change adds a claimability clause to one and not the other, the
    // count starts describing a queue the claim does not have.
    for (const clause of [
      "s.slot_state IN ('PLANNED', 'FAILED')",
      "s.scheduled_for <= now()",
      "s.attempts < _ceiling",
      "s.parked_at IS NULL",
      "p.state = 'SCHEDULED'",
      "o.action_type = 'content_publish'",
      "o.state IN ('APPROVED', 'PROCESSING', 'COMPLETED')",
      "(_platform IS NULL OR s.platform = _platform)",
    ]) {
      expect(claim.split(clause).length - 1, `${clause} must appear in both predicates`).toBe(2);
    }
  });
});

describe("everything else about the claim is the same function", () => {
  it("keeps the signature a caller was written against", () => {
    expect(claim).toContain("_platform text DEFAULT NULL");
    expect(claim).toContain("_max_attempts int DEFAULT NULL");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.claim_due_content_slot(text, int) FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.claim_due_content_slot(text, int) TO service_role;");
  });

  it("returns a byte-identical success payload", () => {
    expect(successPayload(claim)).toBe(successPayload(previousClaim));
  });

  it("keeps the ceiling clamp, so a worker still cannot raise it", () => {
    expect(claim).toContain("_ceiling := least(");
    expect(claim).toContain("public.content_publish_max_attempts()");
  });

  it("keeps the row lock and the skip", () => {
    expect(claim).toContain("FOR UPDATE OF s SKIP LOCKED");
    expect(claim).toContain("ORDER BY s.scheduled_for");
  });

  it("redefines nothing else in the publishing path", () => {
    for (const fn of [
      "record_content_publication",
      "mark_publication_dispatched",
      "reap_stale_content_publications",
      "requeue_content_slot",
      "resolve_content_slot",
      "store_social_account_token",
      "resolve_social_account_token",
      "social_connection_status",
    ]) {
      expect(migration, `${fn} must not be redefined here`)
        .not.toMatch(new RegExp(`CREATE (OR REPLACE )?FUNCTION public\\.${fn}\\(`));
    }
    expect(migration).not.toMatch(/CREATE (OR REPLACE )?TRIGGER/i);
    expect(migration).not.toMatch(/ALTER TABLE/i);
  });

  it("contacts nothing and stores no credential", () => {
    expect(migration).not.toMatch(/https?:\/\//);
    expect(migration).not.toMatch(/graph\.facebook|tiktokapis|googleapis|api\.x\.com|linkedin\.com|threads\.net/i);
    expect(migration).not.toMatch(/INSERT INTO public\.social_account/);
    expect(migration).not.toContain("pgp_sym_encrypt");
    expect(migration).not.toContain("pgp_sym_decrypt");
  });
});

// ── The worker half ─────────────────────────────────────────────────────────

const idleAdapter: PublishAdapter = {
  platform: "facebook",
  name: "test",
  readiness: () => ({ ready: true }),
  publish: async (): Promise<AdapterOutcome> => ({ status: "published", externalPostId: "1" }),
};

const adapters = new Map<Platform, PublishAdapter>([["facebook", idleAdapter]]);

function portsReturning(result: ClaimResult): PublishingPorts {
  return {
    claimSlot: async () => result,
    markDispatched: async (): Promise<RpcResult> => ({ ok: true }),
    recordResult: async (): Promise<RpcResult> => ({ ok: true }),
  };
}

const EMPTY: ClaimResult = { ok: false, error: "no_due_slot", withheldForConnection: 0, awaitingConnection: [] };
const BLOCKED: ClaimResult = {
  ok: false,
  error: "no_due_slot",
  withheldForConnection: 4,
  awaitingConnection: ["facebook", "instagram"],
};

describe("the worker does not report a blocked queue as an empty one", () => {
  it("carries the withheld count onto the idle report", async () => {
    const report = await runPublishAttempt(portsReturning(BLOCKED), adapters);
    expect(report).toMatchObject({
      status: "idle",
      ok: false,
      dispatched: false,
      withheldForConnection: 4,
      awaitingConnection: ["facebook", "instagram"],
    });
  });

  it("still calls no adapter, and dispatches nothing", async () => {
    let published = false;
    const watching: PublishAdapter = { ...idleAdapter, publish: async () => { published = true; return { status: "published", externalPostId: "1" }; } };
    const report = await runPublishAttempt(portsReturning(BLOCKED), new Map([["facebook", watching]]));
    expect(published).toBe(false);
    expect(report.dispatched).toBe(false);
  });

  it("keeps the idle report in a batch when the queue is blocked", async () => {
    const reports = await runPublishBatch(portsReturning(BLOCKED), adapters, { limit: 50 });
    expect(reports).toHaveLength(1);
    expect(reports[0].withheldForConnection).toBe(4);
  });

  it("drops it when the queue is genuinely empty, and does not spin", async () => {
    let claims = 0;
    const ports = { ...portsReturning(EMPTY), claimSlot: async () => { claims += 1; return EMPTY; } };
    expect(await runPublishBatch(ports, adapters, { limit: 50 })).toEqual([]);
    expect(claims).toBe(1);
  });

  it("treats a claim that failed for any other reason as a failure, not as idle", async () => {
    // no_connected_account is a race, not an empty queue: something was claimed
    // and then resolved, and the batch must stop rather than poll around it.
    const report = await runPublishAttempt(
      portsReturning({ ok: false, error: "no_connected_account" }),
      adapters,
    );
    expect(report).toMatchObject({ status: "claim_failed", errorCode: "no_connected_account" });
  });
});

describe("a claimed slot is unaffected by any of this", () => {
  const request: PublishRequest = {
    publicationId: "pub-1",
    calendarId: "cal-1",
    proposalRef: "REF-1",
    platform: "facebook",
    contentType: "post",
    language: "en",
    hook: "Hook",
    body: "Body",
    hashtags: [],
    attempt: 1,
    maxAttempts: 3,
    account: {
      id: "acc-1",
      handle: "visionexworld",
      externalAccountId: "page-1",
      capabilities: ["post"],
      apiKeyRef: "META_APP_SECRET",
      baseUrl: null,
      config: {},
    },
  };

  it("publishes exactly as before", async () => {
    const report = await runPublishAttempt(portsReturning({ ok: true, request }), adapters);
    expect(report).toMatchObject({ status: "published", ok: true, dispatched: true });
    expect(report.withheldForConnection).toBeUndefined();
  });
});
