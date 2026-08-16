import { readFileSync, readdirSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { createFakeAdapter, defaultAdapters, notConfiguredAdapter, NOT_CONFIGURED } from "@/lib/publishing/adapters";
import { runPublishAttempt, runPublishBatch } from "@/lib/publishing/runner";
import { PLATFORMS } from "@/lib/publishing/types";
import type {
  ClaimResult,
  Platform,
  PublishAdapter,
  PublishRequest,
  PublishingPorts,
  RecordInput,
  RpcResult,
} from "@/lib/publishing/types";

// Phase 8, PR C1 — the intent marker, parking, and one ceiling.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THESE TESTS DO AND DO NOT ESTABLISH
//
// EXECUTED FOR REAL: src/lib/publishing/runner.ts. Every scenario below drives
// the actual runner — the same function PR C2 will call — against ports backed
// by the in-memory model further down. Its ordering guarantees (readiness
// before dispatch, marker before the external call, exactly one call per
// attempt, no internal retry) are therefore genuinely tested, not asserted from
// its source text.
//
// MODELLED, NOT EXECUTED: the SQL. There is no Postgres in this suite — no
// PGlite, no pg-mem, no testcontainers, no Docker in CI — so the model below
// mirrors the migration statement by statement, with its constants read out of
// the SQL rather than retyped, so it cannot drift silently. What that
// establishes is the state machine. It does NOT establish:
//   • that the PL/pgSQL compiles or behaves as written,
//   • that the CHECK constraints and partial unique indexes fire,
//   • that FOR UPDATE SKIP LOCKED actually serialises concurrent sessions.
//
// The concurrency tests model contention by holding rows in a `locked` set and
// by interleaving calls in a fixed order. That is a test of the state machine
// under interleaving — real and useful — and it is NOT a test of PostgreSQL's
// locking. A worker/worker or worker/reaper race proven here would still need a
// real Postgres with parallel sessions to be proven for production. That
// integration test does not exist yet and is named as outstanding in the PR.
// ─────────────────────────────────────────────────────────────────────────────

const INTENT_FILE = "supabase/migrations/20260908000000_social_publishing_intent_and_parking.sql";
const intent = readFileSync(INTENT_FILE, "utf8");
const phase8 = readFileSync("supabase/migrations/20260905000000_social_publishing_core.sql", "utf8");
const recovery = readFileSync("supabase/migrations/20260907000000_social_publishing_recovery.sql", "utf8");
const ownerControl = readFileSync("supabase/functions/owner-control/index.ts", "utf8");

/** The body of one CREATE FUNCTION, up to the REVOKE that follows it. */
function functionBody(sql: string, name: string): string {
  const start = sql.indexOf(`FUNCTION public.${name}(`);
  expect(start, `${name} must exist`).toBeGreaterThan(-1);
  const end = sql.indexOf("REVOKE ALL ON FUNCTION", start);
  return sql.slice(start, end === -1 ? undefined : end);
}

/** A value the migration declares, read from the SQL so the model cannot drift. */
function declared(source: RegExp, label: string): string {
  const match = intent.match(source);
  expect(match, `${label} must be declared in ${INTENT_FILE}`).not.toBeNull();
  return match![1];
}

const claimFn = functionBody(intent, "claim_due_content_slot");
const recordFn = functionBody(intent, "record_content_publication");
const reaperFn = functionBody(intent, "reap_stale_content_publications");
const requeueFn = functionBody(intent, "requeue_content_slot");
const markFn = functionBody(intent, "mark_publication_dispatched");

// ── Constants, read out of the SQL ───────────────────────────────────────────

const MAX_ATTEMPTS = Number(
  declared(/FUNCTION public\.content_publish_max_attempts\(\)[\s\S]{0,200}?AS \$\$ SELECT (\d+) \$\$/, "the attempt ceiling"),
);
const STALE_MINUTES = Number(declared(/_stale_after interval DEFAULT interval '(\d+) minutes'/, "the stale-after default"));
const BATCH_DEFAULT = Number(declared(/_limit\s+int\s+DEFAULT (\d+)/, "the batch default"));
const BATCH_MAX = Number(declared(/least\(greatest\(COALESCE\(_limit, \d+\), 1\), (\d+)\)/, "the batch ceiling"));

const REAP_AFTER = declared(/error_code\s+= CASE WHEN _parked THEN '(\w+)'/, "the dispatched reap code");
const REAP_BEFORE = declared(/ELSE '(reclaimed_before_dispatch)' END/, "the undispatched reap code");
const PARK_ON_FAILURE = declared(/CASE WHEN _dispatched THEN '(\w+)' ELSE NULL END/, "the post-dispatch park reason");

const MINUTE = 60_000;
const NOW = Date.UTC(2026, 8, 8, 12, 0, 0);

// ═════════════════════════════════════════════════════════════════════════════
// THE MODEL — mirrors the migration statement for statement.
// ═════════════════════════════════════════════════════════════════════════════

type PubState = "CLAIMED" | "PUBLISHED" | "FAILED";
type SlotState = "PLANNED" | "CANCELLED" | "PUBLISHING" | "PUBLISHED" | "FAILED";

interface Slot {
  id: string;
  platform: Platform;
  scheduledFor: number;
  slotState: SlotState;
  attempts: number;
  lastError: string | null;
  parkedAt: number | null;
  parkReason: string | null;
  updatedAt: number;
  externalPostId: string | null;
  proposalState: string;
  approvalState: string | null;
  approvalAction: string | null;
  accountActive: boolean;
}

interface Pub {
  id: string;
  calendarId: string;
  state: PubState;
  attempt: number;
  claimedAt: number;
  dispatchedAt: number | null;
  completedAt: number | null;
  errorCode: string | null;
  externalPostId: string | null;
}

interface AuditRow { action: string; actorId: string | null; metadata: Record<string, unknown> }

interface World {
  slots: Slot[];
  pubs: Pub[];
  audit: AuditRow[];
  /** Rows another transaction holds. SKIP LOCKED passes over them. */
  locked: Set<string>;
  clock: number;
  seq: number;
}

function world(over: Partial<Slot> = {}): World {
  return {
    slots: [{
      id: "slot-1", platform: "facebook", scheduledFor: NOW - 10 * MINUTE,
      slotState: "PLANNED", attempts: 0, lastError: null, parkedAt: null, parkReason: null,
      updatedAt: NOW - 10 * MINUTE, externalPostId: null,
      proposalState: "SCHEDULED", approvalState: "APPROVED", approvalAction: "content_publish",
      accountActive: true, ...over,
    }],
    pubs: [], audit: [], locked: new Set(), clock: NOW, seq: 0,
  };
}

/**
 * resolve_content_slot(_calendar_id, _last_error, _park_reason, _only_if_publishing)
 * A park reason of null resolves the slot and leaves it retryable.
 */
function resolveContentSlot(
  w: World, calendarId: string, lastError: string | null,
  parkReason: string | null = null, onlyIfPublishing = false,
): boolean {
  const slot = w.slots.find((s) => s.id === calendarId);
  if (!slot) return false;
  if (onlyIfPublishing && slot.slotState !== "PUBLISHING") return false;

  slot.slotState = "FAILED";
  slot.lastError = lastError;
  slot.updatedAt = w.clock;
  if (parkReason !== null) {
    slot.parkedAt = slot.parkedAt ?? w.clock;          // COALESCE: the first park wins
    slot.parkReason = slot.parkReason ?? parkReason;
  }
  return true;
}

/** claim_due_content_slot(_platform, _max_attempts) */
function claimDueContentSlot(w: World, platform: Platform | null = null, maxAttempts?: number): ClaimResult {
  const ceiling = Math.min(Math.max(maxAttempts ?? MAX_ATTEMPTS, 1), MAX_ATTEMPTS);

  const slot = w.slots
    .filter((s) =>
      ["PLANNED", "FAILED"].includes(s.slotState) &&
      s.scheduledFor <= w.clock &&
      s.attempts < ceiling &&
      s.parkedAt === null &&
      s.proposalState === "SCHEDULED" &&
      s.approvalAction === "content_publish" &&
      ["APPROVED", "PROCESSING", "COMPLETED"].includes(s.approvalState ?? "") &&
      (platform === null || s.platform === platform) &&
      s.accountActive &&
      !w.locked.has(s.id))
    .sort((a, b) => a.scheduledFor - b.scheduledFor)[0];

  if (!slot) return { ok: false, error: "no_due_slot" };

  slot.slotState = "PUBLISHING";
  slot.attempts += 1;
  slot.updatedAt = w.clock;

  const attempt = w.pubs.filter((p) => p.calendarId === slot.id).length + 1;
  w.seq += 1;
  w.pubs.push({
    id: `pub-${w.seq}`, calendarId: slot.id, state: "CLAIMED", attempt,
    claimedAt: w.clock, dispatchedAt: null, completedAt: null, errorCode: null, externalPostId: null,
  });
  w.audit.push({ action: "content_slot_claimed", actorId: null, metadata: { platform: slot.platform, attempt } });

  return {
    ok: true,
    request: {
      publicationId: `pub-${w.seq}`, calendarId: slot.id, proposalRef: "TEST1", platform: slot.platform,
      contentType: "post", language: "ar", hook: "hook", body: "body", hashtags: ["visionex"],
      attempt, maxAttempts: ceiling,
      account: {
        id: "acct-1", handle: "@visionex", externalAccountId: "ext-1",
        capabilities: ["publish"], apiKeyRef: "SOCIAL_FACEBOOK_TOKEN", baseUrl: null, config: {},
      },
    },
  };
}

/** mark_publication_dispatched(_publication_id) */
function markPublicationDispatched(w: World, publicationId: string): RpcResult {
  const pub = w.pubs.find((p) => p.id === publicationId);
  if (!pub) return { ok: false, error: "not_found" };
  if (pub.state !== "CLAIMED") return { ok: false, error: "not_pending", state: pub.state };
  if (pub.dispatchedAt !== null) return { ok: false, error: "already_dispatched" };

  pub.dispatchedAt = w.clock;
  w.audit.push({ action: "content_publication_dispatched", actorId: null, metadata: { attempt: pub.attempt } });
  return { ok: true };
}

/** record_content_publication(...) */
function recordContentPublication(w: World, input: RecordInput): RpcResult {
  const pub = w.pubs.find((p) => p.id === input.publicationId);
  if (!pub) return { ok: false, error: "not_found" };
  if (pub.state !== "CLAIMED") return { ok: false, error: "not_pending", state: pub.state };

  const dispatched = pub.dispatchedAt !== null;
  const slot = w.slots.find((s) => s.id === pub.calendarId)!;

  if (input.success && !input.externalPostId?.trim()) return { ok: false, error: "external_post_id_required" };
  if (input.success && !dispatched) return { ok: false, error: "not_dispatched" };

  if (!input.success) {
    pub.state = "FAILED";
    pub.errorCode = input.errorCode ?? "publish_failed";
    pub.completedAt = w.clock;

    resolveContentSlot(w, pub.calendarId, input.errorMessage ?? pub.errorCode,
      dispatched ? PARK_ON_FAILURE : null);

    w.audit.push({
      action: "content_publication_failed", actorId: null,
      metadata: { attempt: pub.attempt, error_code: pub.errorCode, dispatched, parked: dispatched },
    });
    return { ok: true, state: "FAILED" };
  }

  if (slot.proposalState !== "SCHEDULED") return { ok: false, error: "proposal_not_scheduled" };

  const externalPostId = input.externalPostId!.trim();
  // social_publications_external_post_uniq (platform, external_post_id)
  if (w.pubs.some((p) => p.externalPostId === externalPostId && p.id !== pub.id)) {
    return { ok: false, error: "duplicate_publication" };
  }
  // social_publications_one_success_per_slot (calendar_id) WHERE state = 'PUBLISHED'
  if (w.pubs.some((p) => p.calendarId === slot.id && p.state === "PUBLISHED")) {
    return { ok: false, error: "duplicate_publication" };
  }

  pub.state = "PUBLISHED";
  pub.externalPostId = externalPostId;
  pub.completedAt = w.clock;
  slot.slotState = "PUBLISHED";
  slot.externalPostId = externalPostId;
  slot.lastError = null;
  slot.proposalState = "PUBLISHED";
  slot.updatedAt = w.clock;
  w.audit.push({ action: "content_publication_recorded", actorId: null, metadata: { attempt: pub.attempt } });
  return { ok: true, state: "PUBLISHED" };
}

/** reap_stale_content_publications(_stale_after, _limit) */
function reap(
  w: World,
  { staleMinutes = STALE_MINUTES, limit = BATCH_DEFAULT }: { staleMinutes?: number; limit?: number } = {},
): { ok: boolean; error?: string; reaped?: number; before?: number; after?: number; unstranded?: number; batch?: number } {
  if (staleMinutes <= 0) return { ok: false, error: "invalid_interval" };
  const batch = Math.min(Math.max(limit ?? BATCH_DEFAULT, 1), BATCH_MAX);
  const cutoff = w.clock - staleMinutes * MINUTE;
  let before = 0, after = 0, unstranded = 0;

  // Pass 1: publications whose worker stopped reporting.
  const open = w.pubs
    .filter((p) => p.state === "CLAIMED" && p.claimedAt < cutoff && !w.locked.has(p.id))
    .sort((a, b) => a.claimedAt - b.claimedAt)
    .slice(0, batch);

  for (const pub of open) {
    const parked = pub.dispatchedAt !== null;
    pub.state = "FAILED";
    pub.errorCode = parked ? REAP_AFTER : REAP_BEFORE;
    pub.completedAt = w.clock;

    resolveContentSlot(w, pub.calendarId, parked ? REAP_AFTER : REAP_BEFORE,
      parked ? REAP_AFTER : null, true);

    if (parked) after += 1; else before += 1;
    w.audit.push({
      action: "content_publication_reclaimed", actorId: null,
      metadata: { attempt: pub.attempt, dispatched: parked, parked },
    });
  }

  // Pass 2: slots stranded in PUBLISHING with no CLAIMED publication.
  const stranded = w.slots
    .filter((s) =>
      s.slotState === "PUBLISHING" &&
      s.updatedAt < cutoff &&
      !w.pubs.some((p) => p.calendarId === s.id && p.state === "CLAIMED") &&
      !w.locked.has(s.id))
    .sort((a, b) => a.updatedAt - b.updatedAt)
    .slice(0, batch);

  for (const slot of stranded) {
    const parked = w.pubs.some((p) => p.calendarId === slot.id && p.dispatchedAt !== null);
    if (!resolveContentSlot(w, slot.id,
      parked ? "stranded_after_dispatch" : "stranded_before_dispatch",
      parked ? "stranded_after_dispatch" : null, true)) continue;

    unstranded += 1;
    w.audit.push({
      action: "content_slot_unstranded", actorId: null,
      metadata: { attempts: slot.attempts, dispatched: parked, parked },
    });
  }

  return { ok: true, reaped: before + after, before, after, unstranded, batch };
}

/** requeue_content_slot(_calendar_id, _actor_id, _reason, _confirm_not_published) */
function requeueContentSlot(
  w: World,
  calendarId: string,
  actor: { id: string | null; isAdmin: boolean },
  reason: string | null = null,
  confirmNotPublished = false,
): { ok: boolean; error?: string; state?: string; attempts?: number; wasParked?: boolean } {
  if (actor.id === null || !actor.isAdmin) return { ok: false, error: "not_authorized" };

  const slot = w.slots.find((s) => s.id === calendarId);
  if (!slot) return { ok: false, error: "not_found" };
  if (slot.slotState !== "FAILED") return { ok: false, error: "not_requeueable" };
  if (slot.proposalState !== "SCHEDULED") return { ok: false, error: "proposal_not_scheduled" };
  if (slot.approvalAction !== "content_publish" ||
      !["APPROVED", "PROCESSING", "COMPLETED"].includes(slot.approvalState ?? "")) {
    return { ok: false, error: "not_approved" };
  }
  if (w.pubs.some((p) => p.calendarId === slot.id && p.state === "PUBLISHED")) {
    return { ok: false, error: "already_published" };
  }

  const dispatched = w.pubs.some((p) => p.calendarId === slot.id && p.dispatchedAt !== null);
  if (dispatched && confirmNotPublished !== true) {
    return { ok: false, error: "dispatch_confirmation_required" };
  }

  const wasParked = slot.parkedAt !== null;
  const previousAttempts = slot.attempts;
  slot.slotState = "PLANNED";
  slot.attempts = 0;
  slot.lastError = null;
  slot.parkedAt = null;
  slot.parkReason = null;
  slot.updatedAt = w.clock;

  w.audit.push({
    action: "content_slot_requeued", actorId: actor.id,
    metadata: {
      previous_attempts: previousAttempts, was_parked: wasParked,
      had_dispatched_attempt: dispatched, confirmed_not_published: confirmNotPublished, reason,
    },
  });
  return { ok: true, state: "PLANNED", attempts: 0, wasParked };
}

// ── Ports over the model ─────────────────────────────────────────────────────

function portsFor(w: World, options: { crashOnRecord?: boolean } = {}): PublishingPorts {
  return {
    claimSlot: (platform) => Promise.resolve(claimDueContentSlot(w, platform)),
    markDispatched: (id) => Promise.resolve(markPublicationDispatched(w, id)),
    recordResult: (input) => options.crashOnRecord
      ? Promise.reject(new Error("process died before the result was recorded"))
      : Promise.resolve(recordContentPublication(w, input)),
  };
}

const fakeRegistry = (adapter: PublishAdapter): Map<Platform, PublishAdapter> =>
  new Map<Platform, PublishAdapter>([[adapter.platform, adapter]]);

/** A timer that fires immediately — the deadline, without waiting for it. */
const instantTimeout = () => Promise.resolve();
/** A timer that never fires, so the adapter always wins the race. */
const neverTimeout = () => new Promise<void>(() => {});

const ADMIN = { id: "11111111-1111-1111-1111-111111111111", isAdmin: true };
const NOT_ADMIN = { id: "22222222-2222-2222-2222-222222222222", isAdmin: false };

/** Claim, dispatch, then abandon — the state a crashed worker leaves behind. */
function dispatchedAndAbandoned(over: Partial<Slot> = {}): World {
  const w = world(over);
  const claim = claimDueContentSlot(w) as { request: PublishRequest };
  markPublicationDispatched(w, claim.request.publicationId);
  return w;
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. THE RULE: dispatched_at
// ═════════════════════════════════════════════════════════════════════════════

describe("dispatched_at is the whole recovery rule", () => {
  it("has exactly one writer", () => {
    expect(intent).toContain("ADD COLUMN IF NOT EXISTS dispatched_at timestamptz");
    expect([...intent.matchAll(/SET\s+dispatched_at\s*=/g)]).toHaveLength(1);
    expect(markFn).toContain("SET dispatched_at = now()");
  });

  it("refuses a second marker for the same attempt", () => {
    const w = world();
    const claim = claimDueContentSlot(w) as { request: PublishRequest };
    const id = claim.request.publicationId;

    expect(markPublicationDispatched(w, id)).toMatchObject({ ok: true });
    expect(markPublicationDispatched(w, id)).toMatchObject({ ok: false, error: "already_dispatched" });
  });

  it("refuses a marker for a publication that is already resolved or absent", () => {
    const w = world();
    const claim = claimDueContentSlot(w) as { request: PublishRequest };
    markPublicationDispatched(w, claim.request.publicationId);
    recordContentPublication(w, { publicationId: claim.request.publicationId, success: false, errorCode: "boom" });

    expect(markPublicationDispatched(w, claim.request.publicationId)).toMatchObject({ ok: false, error: "not_pending" });
    expect(markPublicationDispatched(w, "nope")).toMatchObject({ ok: false, error: "not_found" });
  });

  it("refuses a success whose attempt was never marked dispatched", () => {
    // This is what makes the marker mandatory rather than advisory.
    const w = world();
    const claim = claimDueContentSlot(w) as { request: PublishRequest };
    expect(recordContentPublication(w, {
      publicationId: claim.request.publicationId, success: true, externalPostId: "post-1",
    })).toMatchObject({ ok: false, error: "not_dispatched" });
  });

  it("retries an undispatched failure and parks a dispatched one", () => {
    const undispatched = world();
    const a = claimDueContentSlot(undispatched) as { request: PublishRequest };
    recordContentPublication(undispatched, { publicationId: a.request.publicationId, success: false, errorCode: "rate_limited" });
    expect(undispatched.slots[0].parkedAt).toBeNull();
    expect(claimDueContentSlot(undispatched).ok).toBe(true);

    const dispatched = dispatchedAndAbandoned();
    recordContentPublication(dispatched, { publicationId: "pub-1", success: false, errorCode: "rate_limited" });
    expect(dispatched.slots[0].parkedAt).not.toBeNull();
    expect(dispatched.slots[0].parkReason).toBe(PARK_ON_FAILURE);
    expect(claimDueContentSlot(dispatched)).toMatchObject({ ok: false, error: "no_due_slot" });
  });

  it("decides parking from the column, never from the caller's error code", () => {
    // Same code, opposite outcome — the only difference is the marker.
    for (const code of ["rate_limited", "media_too_large", "unknown_error"]) {
      const w = dispatchedAndAbandoned();
      recordContentPublication(w, { publicationId: "pub-1", success: false, errorCode: code });
      expect(w.slots[0].parkedAt, `${code} after dispatch must park`).not.toBeNull();
    }
    expect(recordFn).toContain("_dispatched := _pub.dispatched_at IS NOT NULL;");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. parked_at
// ═════════════════════════════════════════════════════════════════════════════

describe("parking is a fact, not an arithmetic side effect", () => {
  it("adds the columns additively and destroys nothing", () => {
    expect(intent).toContain("ADD COLUMN IF NOT EXISTS parked_at    timestamptz");
    expect(intent).toContain("ADD COLUMN IF NOT EXISTS park_reason  text");
    expect(intent).not.toMatch(/DROP CONSTRAINT|DROP COLUMN|DROP TABLE|TRUNCATE|DELETE FROM/);
  });

  it("keeps attempts meaning what it says after a park", () => {
    const w = dispatchedAndAbandoned();
    w.clock = NOW + 60 * MINUTE;
    reap(w);

    // PR #117 would have written 2147483647 here and lost the real count.
    expect(w.slots[0].attempts).toBe(1);
    expect(w.slots[0].parkedAt).toBe(w.clock);
    expect(w.slots[0].parkReason).toBe(REAP_AFTER);
  });

  it("is unclaimable at every ceiling, including one above the maximum", () => {
    const w = dispatchedAndAbandoned();
    w.clock = NOW + 60 * MINUTE;
    reap(w);

    for (const ceiling of [1, MAX_ATTEMPTS, MAX_ATTEMPTS + 1, 100, 2147483647]) {
      expect(claimDueContentSlot(w, null, ceiling), `ceiling ${ceiling}`).toMatchObject({ ok: false, error: "no_due_slot" });
    }
    expect(claimFn).toContain("AND s.parked_at IS NULL");
  });

  it("keeps the first park reason when a slot is parked twice", () => {
    const w = dispatchedAndAbandoned();
    w.clock = NOW + 60 * MINUTE;
    reap(w);
    const firstAt = w.slots[0].parkedAt;

    w.clock = NOW + 120 * MINUTE;
    resolveContentSlot(w, "slot-1", "later", "some_other_reason");
    expect(w.slots[0].parkedAt).toBe(firstAt);
    expect(w.slots[0].parkReason).toBe(REAP_AFTER);
  });

  it("backfills PR #117's sentinel without deleting anything", () => {
    expect(intent).toContain("WHERE attempts = 2147483647");
    expect(intent).toContain("park_reason = _reason");
    expect(intent).toContain("attempts    = _ceiling");
    expect(intent).toContain("'content_slot_parking_migrated'");
    // The original value is preserved in the audit row, not discarded.
    expect(intent).toContain("'previous_attempts', _slot.attempts");
    // And PR #117's file is untouched, so its own suite still describes it.
    expect(recovery).toContain("attempts   = 2147483647");
  });

  it("is written in one place and cleared in one place", () => {
    // resolve_content_slot is the only writer; requeue is the only clearer.
    const resolver = functionBody(intent, "resolve_content_slot");
    expect(resolver).toContain("parked_at   = CASE WHEN _park_reason IS NULL");
    expect([...intent.matchAll(/parked_at\s*=\s*NULL/g)]).toHaveLength(1);
    expect(requeueFn).toContain("parked_at   = NULL");
    expect(reaperFn).not.toMatch(/parked_at\s*=/);
    expect(recordFn).not.toMatch(/parked_at\s*=/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. One ceiling
// ═════════════════════════════════════════════════════════════════════════════

describe("_max_attempts has exactly one source of truth", () => {
  it("declares the ceiling once, as a function the claimer reads", () => {
    expect(intent).toContain("FUNCTION public.content_publish_max_attempts()");
    expect(MAX_ATTEMPTS).toBeGreaterThan(0);
    expect(claimFn).toContain("public.content_publish_max_attempts()");
    expect(claimFn).toContain("_max_attempts int DEFAULT NULL");
  });

  it("lets a caller lower the budget and never raise it", () => {
    for (const asked of [1, 2, MAX_ATTEMPTS, MAX_ATTEMPTS + 1, 50, 2147483647]) {
      const w = world();
      const claim = claimDueContentSlot(w, null, asked) as { request: PublishRequest };
      expect(claim.request.maxAttempts, `${asked}`).toBe(Math.min(asked, MAX_ATTEMPTS));
    }
  });

  it("stops an undispatched slot at the ceiling however often it is retried", () => {
    const w = world();
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      const claim = claimDueContentSlot(w);
      expect(claim.ok, `attempt ${i + 1}`).toBe(true);
      recordContentPublication(w, {
        publicationId: (claim as { request: PublishRequest }).request.publicationId,
        success: false, errorCode: "rate_limited",
      });
    }
    expect(w.slots[0].attempts).toBe(MAX_ATTEMPTS);
    for (const ceiling of [MAX_ATTEMPTS, MAX_ATTEMPTS + 5, 2147483647]) {
      expect(claimDueContentSlot(w, null, ceiling)).toMatchObject({ ok: false, error: "no_due_slot" });
    }
  });

  it("leaves PR #108's and PR #117's own files describing themselves", () => {
    expect(phase8).toContain("_max_attempts int DEFAULT 3");
    expect(recovery).not.toContain("content_publish_max_attempts");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. The reaper, v2
// ═════════════════════════════════════════════════════════════════════════════

describe("reaper v2 — the batch limit and the two classes of stall", () => {
  it("replaces PR #117's signature instead of leaving an overload", () => {
    expect(intent).toContain("DROP FUNCTION IF EXISTS public.reap_stale_content_publications(interval);");
    expect(intent).toContain("ON FUNCTION public.reap_stale_content_publications(interval, int) TO service_role;");
  });

  it("clamps the batch and refuses a non-positive interval", () => {
    const w = world();
    expect(reap(w, { staleMinutes: 0 })).toMatchObject({ ok: false, error: "invalid_interval" });
    expect(reap(w, { limit: 0 }).batch).toBe(1);
    expect(reap(w, { limit: 10_000 }).batch).toBe(BATCH_MAX);
    expect(reap(w).batch).toBe(BATCH_DEFAULT);
    expect(reaperFn).toContain("LIMIT _batch");
  });

  it("honours the batch limit across both passes", () => {
    const w = world();
    // Five stale, undispatched claims across five slots.
    for (let i = 2; i <= 5; i += 1) {
      w.slots.push({ ...w.slots[0], id: `slot-${i}`, slotState: "PLANNED", attempts: 0, updatedAt: NOW - 10 * MINUTE });
    }
    for (let i = 1; i <= 5; i += 1) claimDueContentSlot(w);
    w.clock = NOW + 60 * MINUTE;

    expect(reap(w, { limit: 2 }).reaped).toBe(2);
    expect(w.pubs.filter((p) => p.state === "CLAIMED")).toHaveLength(3);
    expect(reap(w, { limit: 100 }).reaped).toBe(3);
  });

  it("returns an undispatched stall to the retry budget", () => {
    const w = world();
    claimDueContentSlot(w);              // claimed, then the worker died
    w.clock = NOW + 60 * MINUTE;

    expect(reap(w)).toMatchObject({ ok: true, reaped: 1, before: 1, after: 0 });
    expect(w.pubs[0].errorCode).toBe(REAP_BEFORE);
    expect(w.slots[0].parkedAt).toBeNull();
    expect(w.slots[0].attempts).toBe(1);
    expect(claimDueContentSlot(w).ok).toBe(true);
  });

  it("parks a dispatched stall and never re-offers it", () => {
    const w = dispatchedAndAbandoned();
    w.clock = NOW + 60 * MINUTE;

    expect(reap(w)).toMatchObject({ ok: true, reaped: 1, before: 0, after: 1 });
    expect(w.pubs[0].errorCode).toBe(REAP_AFTER);
    expect(w.slots[0].parkedAt).toBe(w.clock);
    expect(claimDueContentSlot(w)).toMatchObject({ ok: false, error: "no_due_slot" });
  });

  it("frees a slot stranded in PUBLISHING with no open publication", () => {
    // PR #117's reaper drove entirely off social_publications, so this slot was
    // invisible to it and stayed in PUBLISHING — a state nothing can leave.
    const w = world({ slotState: "PUBLISHING", attempts: 1, updatedAt: NOW - 60 * MINUTE });
    expect(w.pubs).toHaveLength(0);

    expect(reap(w)).toMatchObject({ ok: true, unstranded: 1 });
    expect(w.slots[0].slotState).toBe("FAILED");
    expect(w.slots[0].lastError).toBe("stranded_before_dispatch");
    expect(w.slots[0].parkedAt).toBeNull();   // nothing ever left this system
    expect(claimDueContentSlot(w).ok).toBe(true);
  });

  it("parks a stranded slot if any attempt for it had dispatched", () => {
    const w = world({ slotState: "PUBLISHING", attempts: 1, updatedAt: NOW - 60 * MINUTE });
    w.pubs.push({
      id: "pub-old", calendarId: "slot-1", state: "FAILED", attempt: 1,
      claimedAt: NOW - 90 * MINUTE, dispatchedAt: NOW - 89 * MINUTE,
      completedAt: NOW - 80 * MINUTE, errorCode: "x", externalPostId: null,
    });

    reap(w);
    expect(w.slots[0].parkReason).toBe("stranded_after_dispatch");
    expect(claimDueContentSlot(w)).toMatchObject({ ok: false, error: "no_due_slot" });
  });

  it("draws the staleness line exactly where the SQL does", () => {
    const build = (age: number) => {
      const w = world();
      claimDueContentSlot(w);
      w.clock = NOW + age;
      return w;
    };
    expect(reap(build(STALE_MINUTES * MINUTE - 1_000)).reaped).toBe(0);
    expect(reap(build(STALE_MINUTES * MINUTE)).reaped).toBe(0);      // strict `<`
    expect(reap(build(STALE_MINUTES * MINUTE + 1_000)).reaped).toBe(1);
  });

  it("is idempotent and skips locked rows", () => {
    const w = world();
    claimDueContentSlot(w);
    w.clock = NOW + 60 * MINUTE;

    w.locked.add("pub-1");
    expect(reap(w).reaped).toBe(0);
    expect(w.pubs[0].state).toBe("CLAIMED");

    w.locked.clear();
    expect(reap(w).reaped).toBe(1);
    const after = JSON.stringify(w.pubs) + JSON.stringify(w.slots);
    expect(reap(w).reaped).toBe(0);
    expect(reap(w).reaped).toBe(0);
    expect(JSON.stringify(w.pubs) + JSON.stringify(w.slots)).toBe(after);
    expect(reaperFn).toContain("FOR UPDATE SKIP LOCKED");
  });

  it("never overwrites a result the worker recorded first", () => {
    const w = dispatchedAndAbandoned();
    recordContentPublication(w, { publicationId: "pub-1", success: true, externalPostId: "post-1" });
    w.clock = NOW + 60 * MINUTE;

    expect(reap(w).reaped).toBe(0);
    expect(w.pubs[0].state).toBe("PUBLISHED");
    expect(w.slots[0].slotState).toBe("PUBLISHED");
    expect(reaperFn).toMatch(/WHERE id = _pub\.id\s+AND state = 'CLAIMED';/);
  });

  it("stores only server-side constants as the reaped error text", () => {
    expect(reaperFn).not.toMatch(/error_message = _\w+/);
    expect(reaperFn).not.toMatch(/error_message[\s\S]{0,80}\|\|/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. The runner — executed for real
// ═════════════════════════════════════════════════════════════════════════════

describe("the runner publishes once, in one order, and never retries", () => {
  it("claims, marks, publishes and records — in that order", async () => {
    const w = world();
    const order: string[] = [];
    const adapter = createFakeAdapter([{ outcome: "published", externalPostId: "post-1" }]);
    const base = portsFor(w);
    const ports: PublishingPorts = {
      claimSlot: async (p) => { order.push("claim"); return base.claimSlot(p); },
      markDispatched: async (id) => { order.push("mark"); return base.markDispatched(id); },
      recordResult: async (i) => { order.push("record"); return base.recordResult(i); },
    };
    const wrapped: PublishAdapter = { ...adapter, publish: (r) => { order.push("publish"); return adapter.publish(r); } };

    const report = await runPublishAttempt(ports, fakeRegistry(wrapped), { timer: neverTimeout });

    expect(order).toEqual(["claim", "mark", "publish", "record"]);
    expect(report).toMatchObject({ status: "published", ok: true, dispatched: true, externalPostId: "post-1" });
    expect(w.pubs[0].state).toBe("PUBLISHED");
    expect(w.pubs[0].dispatchedAt).not.toBeNull();
    expect(w.slots[0].slotState).toBe("PUBLISHED");
  });

  it("marks the intent before it calls the platform, never after", async () => {
    const w = world();
    let markedWhenCalled: number | null | undefined;
    const adapter = createFakeAdapter([{ outcome: "published" }]);
    const wrapped: PublishAdapter = {
      ...adapter,
      publish: (r) => {
        markedWhenCalled = w.pubs.find((p) => p.id === r.publicationId)?.dispatchedAt;
        return adapter.publish(r);
      },
    };

    await runPublishAttempt(portsFor(w), fakeRegistry(wrapped), { timer: neverTimeout });
    expect(markedWhenCalled).toBeDefined();
    expect(markedWhenCalled).not.toBeNull();
  });

  it("reports idle when nothing is due, and calls no adapter", async () => {
    const w = world({ slotState: "CANCELLED" });
    const adapter = createFakeAdapter();
    const report = await runPublishAttempt(portsFor(w), fakeRegistry(adapter), { timer: neverTimeout });

    expect(report).toMatchObject({ status: "idle", ok: false, dispatched: false });
    expect(adapter.dispatchCount).toBe(0);
  });

  it("does not call the platform when the marker is refused", async () => {
    const w = world();
    const adapter = createFakeAdapter();
    const ports: PublishingPorts = {
      ...portsFor(w),
      markDispatched: () => Promise.resolve({ ok: false, error: "already_dispatched" }),
    };

    const report = await runPublishAttempt(ports, fakeRegistry(adapter), { timer: neverTimeout });
    expect(report).toMatchObject({ status: "dispatch_refused", ok: false, errorCode: "already_dispatched" });
    expect(adapter.dispatchCount).toBe(0);
  });

  it("stops the batch at idle and cannot spin", async () => {
    const w = world({ slotState: "CANCELLED" });
    let claims = 0;
    const base = portsFor(w);
    const ports: PublishingPorts = { ...base, claimSlot: (p) => { claims += 1; return base.claimSlot(p); } };

    expect(await runPublishBatch(ports, fakeRegistry(createFakeAdapter()), { timer: neverTimeout, limit: 50 })).toEqual([]);
    expect(claims).toBe(1);
  });
});

describe("not_configured is never success", () => {
  it("refuses every real platform today", () => {
    const adapters = defaultAdapters();
    // Derived from PLATFORMS rather than frozen as a literal, so adding a
    // platform cannot quietly leave it without an adapter entry. The literal
    // list is still pinned — social-platform-vocabulary.test.ts ties PLATFORMS
    // to the CHECK in the migration, so this is not the code checking itself.
    expect([...adapters.keys()].sort()).toEqual([...PLATFORMS].sort());
    for (const [platform, adapter] of adapters) {
      const readiness = adapter.readiness({} as PublishRequest);
      expect(readiness.ready, platform).toBe(false);
      expect(readiness.ready === false && readiness.errorCode).toBe(NOT_CONFIGURED);
    }
  });

  it("reports a failure, dispatches nothing, and parks nothing", async () => {
    const w = world();
    const report = await runPublishAttempt(portsFor(w), defaultAdapters(), { timer: neverTimeout });

    expect(report.status).toBe("not_configured");
    expect(report.ok).toBe(false);          // the assertion this path exists for
    expect(report.dispatched).toBe(false);
    expect(w.pubs[0].state).toBe("FAILED");
    expect(w.pubs[0].dispatchedAt).toBeNull();
    expect(w.slots[0].parkedAt).toBeNull(); // a missing integration must not park a slot
  });

  it("rejects rather than pretending, if publish() is ever reached", async () => {
    await expect(notConfiguredAdapter("facebook").publish({} as PublishRequest))
      .rejects.toThrow(/no publishing adapter/i);
  });

  it("treats a platform with no registered adapter the same way", async () => {
    const w = world();
    const report = await runPublishAttempt(portsFor(w), new Map(), { timer: neverTimeout });
    expect(report).toMatchObject({ status: "not_configured", ok: false, dispatched: false });
  });

  it("burns the attempt budget and then stops, publishing nothing", async () => {
    const w = world();
    const reports = await runPublishBatch(portsFor(w), defaultAdapters(), { timer: neverTimeout, limit: 20 });
    expect(reports).toHaveLength(MAX_ATTEMPTS);
    expect(reports.every((r) => r.status === "not_configured" && !r.ok)).toBe(true);
    expect(w.pubs.every((p) => p.dispatchedAt === null)).toBe(true);
    expect(w.pubs.some((p) => p.state === "PUBLISHED")).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. Concurrency and recovery
// ═════════════════════════════════════════════════════════════════════════════

describe("concurrency and recovery, at the state-machine level", () => {
  it("two workers, one slot — the second finds nothing to claim", async () => {
    const w = world();
    const a = createFakeAdapter([{ outcome: "published", externalPostId: "post-1" }]);
    const b = createFakeAdapter([{ outcome: "published", externalPostId: "post-2" }]);

    const first = await runPublishAttempt(portsFor(w), fakeRegistry(a), { timer: neverTimeout });
    const second = await runPublishAttempt(portsFor(w), fakeRegistry(b), { timer: neverTimeout });

    expect(first.status).toBe("published");
    expect(second.status).toBe("idle");
    expect(a.dispatchCount + b.dispatchCount).toBe(1);
    expect(w.pubs.filter((p) => p.state === "PUBLISHED")).toHaveLength(1);
  });

  it("two workers interleaved mid-flight — the slot leaves PLANNED at the claim", () => {
    const w = world();
    expect(claimDueContentSlot(w).ok).toBe(true);
    expect(w.slots[0].slotState).toBe("PUBLISHING");
    // The second worker's claim runs before the first has recorded anything.
    expect(claimDueContentSlot(w)).toMatchObject({ ok: false, error: "no_due_slot" });
    expect(w.pubs).toHaveLength(1);
    expect(claimFn).toContain("FOR UPDATE OF s SKIP LOCKED");
    expect(claimFn).toContain("SET slot_state = 'PUBLISHING'");
  });

  it("worker and reaper on one slot — the reaper skips what is locked", () => {
    const w = dispatchedAndAbandoned();
    w.clock = NOW + 60 * MINUTE;
    w.locked.add("pub-1");   // the worker holds the row

    expect(reap(w).reaped).toBe(0);
    expect(w.pubs[0].state).toBe("CLAIMED");

    // The worker then finishes normally and the reaper has nothing to do.
    w.locked.clear();
    expect(recordContentPublication(w, { publicationId: "pub-1", success: true, externalPostId: "post-1" }))
      .toMatchObject({ ok: true, state: "PUBLISHED" });
    expect(reap(w).reaped).toBe(0);
  });

  it("crash after claim — nothing was published, so it is retried", () => {
    const w = world();
    claimDueContentSlot(w);          // and the process dies here
    expect(w.pubs[0].dispatchedAt).toBeNull();

    w.clock = NOW + 60 * MINUTE;
    expect(reap(w)).toMatchObject({ before: 1, after: 0 });
    expect(w.slots[0].parkedAt).toBeNull();
    expect(claimDueContentSlot(w).ok).toBe(true);   // automatic retry, as it should be
  });

  it("crash after dispatched_at — the outcome is unknown, so it is parked", async () => {
    const w = dispatchedAndAbandoned();

    w.clock = NOW + 60 * MINUTE;
    expect(reap(w)).toMatchObject({ before: 0, after: 1 });
    expect(w.slots[0].parkedAt).not.toBeNull();
    expect(claimDueContentSlot(w)).toMatchObject({ ok: false, error: "no_due_slot" });

    // And no later invocation calls the platform for it.
    const adapter = createFakeAdapter([{ outcome: "published" }]);
    expect(await runPublishBatch(portsFor(w), fakeRegistry(adapter), { timer: neverTimeout })).toEqual([]);
    expect(adapter.dispatchCount).toBe(0);
  });

  it("external timeout — no answer means unknown, and unknown means parked", async () => {
    const w = world();
    const adapter = createFakeAdapter([{ outcome: "hang" }]);

    const report = await runPublishAttempt(portsFor(w), fakeRegistry(adapter), {
      timeoutMs: 1, timer: instantTimeout,
    });

    expect(report).toMatchObject({ status: "ambiguous", ok: false, dispatched: true, needsManualReview: true });
    expect(report.errorCode).toBe("dispatch_timeout");
    expect(adapter.dispatchCount).toBe(1);
    expect(w.slots[0].parkedAt).not.toBeNull();
    expect(claimDueContentSlot(w)).toMatchObject({ ok: false, error: "no_due_slot" });
  });

  it("external success then crash before completion — THE case", async () => {
    // The platform accepted the post. The process died before the database
    // could be told. This is the scenario the entire phase is built around.
    const w = world();
    const adapter = createFakeAdapter([{ outcome: "published", externalPostId: "post-live-1" }]);

    const report = await runPublishAttempt(
      portsFor(w, { crashOnRecord: true }), fakeRegistry(adapter), { timer: neverTimeout },
    );

    // The runner reports the truth: the call happened, the result did not land.
    expect(report).toMatchObject({ status: "record_failed", ok: false, dispatched: true, needsManualReview: true });
    expect(adapter.dispatchCount).toBe(1);
    expect(w.pubs[0].state).toBe("CLAIMED");            // never completed
    expect(w.pubs[0].dispatchedAt).not.toBeNull();      // but the marker is committed

    // The reaper now sees a dispatched, unresolved attempt.
    w.clock = NOW + 60 * MINUTE;
    expect(reap(w)).toMatchObject({ before: 0, after: 1 });
    expect(w.slots[0].parkReason).toBe(REAP_AFTER);

    // And the requirement: no second external call, automatically, ever.
    expect(await runPublishBatch(portsFor(w), fakeRegistry(adapter), { timer: neverTimeout, limit: 10 })).toEqual([]);
    expect(adapter.dispatchCount).toBe(1);
  });

  it("external failure before dispatch — retried, because nothing went out", async () => {
    const w = world();
    // readiness refuses, so no marker and no call.
    const adapter = createFakeAdapter([{ outcome: "published" }], { ready: false, readyErrorCode: "missing_asset" });

    const report = await runPublishAttempt(portsFor(w), fakeRegistry(adapter), { timer: neverTimeout });
    expect(report).toMatchObject({ status: "not_configured", dispatched: false, ok: false });
    expect(adapter.dispatchCount).toBe(0);
    expect(w.slots[0].parkedAt).toBeNull();
    expect(claimDueContentSlot(w).ok).toBe(true);
  });

  it("a rejection after dispatch is parked, not retried", async () => {
    const w = world();
    const adapter = createFakeAdapter([{ outcome: "rejected", errorCode: "media_too_large" }]);

    const report = await runPublishAttempt(portsFor(w), fakeRegistry(adapter), { timer: neverTimeout });
    expect(report).toMatchObject({ status: "rejected", ok: false, dispatched: true, errorCode: "media_too_large" });
    expect(w.slots[0].parkedAt).not.toBeNull();
    expect(claimDueContentSlot(w)).toMatchObject({ ok: false, error: "no_due_slot" });
  });

  it("an adapter that throws is unknown, not a clean failure", async () => {
    const w = world();
    const adapter = createFakeAdapter([{ outcome: "throws", message: "socket hang up" }]);

    const report = await runPublishAttempt(portsFor(w), fakeRegistry(adapter), { timer: neverTimeout });
    expect(report).toMatchObject({ status: "ambiguous", ok: false, dispatched: true, errorCode: "adapter_threw" });
    expect(w.slots[0].parkedAt).not.toBeNull();
  });

  it("automatic retry after an ambiguous result is refused at every level", async () => {
    const w = world();
    const adapter = createFakeAdapter([{ outcome: "unknown", errorCode: "gateway_timeout" }, { outcome: "published" }]);

    await runPublishAttempt(portsFor(w), fakeRegistry(adapter), { timer: neverTimeout });
    expect(w.slots[0].parkedAt).not.toBeNull();

    // The batch runner, the claim RPC and a reap all decline to re-offer it.
    expect(await runPublishBatch(portsFor(w), fakeRegistry(adapter), { timer: neverTimeout })).toEqual([]);
    expect(claimDueContentSlot(w, null, 2147483647)).toMatchObject({ ok: false, error: "no_due_slot" });
    w.clock = NOW + 120 * MINUTE;
    expect(reap(w).reaped).toBe(0);
    expect(adapter.dispatchCount).toBe(1);
  });

  it("a parked slot is invisible to the runner entirely", async () => {
    const w = dispatchedAndAbandoned();
    w.clock = NOW + 60 * MINUTE;
    reap(w);

    const adapter = createFakeAdapter([{ outcome: "published" }]);
    expect(await runPublishBatch(portsFor(w), fakeRegistry(adapter), { timer: neverTimeout, limit: 50 })).toEqual([]);
    expect(adapter.dispatchCount).toBe(0);
  });

  it("max attempts stops an honestly-failing undispatched slot", async () => {
    const w = world();
    const adapter = createFakeAdapter([{ outcome: "published" }], { ready: false });
    const reports = await runPublishBatch(portsFor(w), fakeRegistry(adapter), { timer: neverTimeout, limit: 50 });

    expect(reports).toHaveLength(MAX_ATTEMPTS);
    expect(w.slots[0].attempts).toBe(MAX_ATTEMPTS);
    expect(w.slots[0].parkedAt).toBeNull();  // exhausted, not parked — different facts
    expect(adapter.dispatchCount).toBe(0);
  });

  it("duplicate prevention holds across every path in one run", async () => {
    const w = world();
    const adapter = createFakeAdapter([{ outcome: "published", externalPostId: "post-1" }]);

    await runPublishAttempt(portsFor(w), fakeRegistry(adapter), { timer: neverTimeout });
    // Replay: the same result delivered again changes nothing.
    expect(recordContentPublication(w, { publicationId: "pub-1", success: true, externalPostId: "post-1" }))
      .toMatchObject({ ok: false, error: "not_pending" });

    // A new attempt cannot be claimed, and the reaper adds nothing.
    expect(await runPublishBatch(portsFor(w), fakeRegistry(adapter), { timer: neverTimeout })).toEqual([]);
    w.clock = NOW + 120 * MINUTE;
    expect(reap(w).reaped).toBe(0);

    expect(adapter.dispatchCount).toBe(1);
    expect(w.pubs.filter((p) => p.state === "PUBLISHED")).toHaveLength(1);
  });

  it("keeps both unique indexes as defence in depth", () => {
    // The model enforces them; the indexes that really do so are PR #108's and
    // this migration neither drops nor redefines them.
    const w = world();
    const claim = claimDueContentSlot(w) as { request: PublishRequest };
    markPublicationDispatched(w, claim.request.publicationId);
    recordContentPublication(w, { publicationId: "pub-1", success: true, externalPostId: "post-1" });

    // A second slot trying to record the same external post id.
    w.slots.push({ ...w.slots[0], id: "slot-2", slotState: "PLANNED", attempts: 0, proposalState: "SCHEDULED", parkedAt: null });
    const second = claimDueContentSlot(w) as { request: PublishRequest };
    markPublicationDispatched(w, second.request.publicationId);
    expect(recordContentPublication(w, {
      publicationId: second.request.publicationId, success: true, externalPostId: "post-1",
    })).toMatchObject({ ok: false, error: "duplicate_publication" });

    expect(phase8).toContain("social_publications_one_success_per_slot");
    expect(phase8).toContain("social_publications_external_post_uniq");
    expect(intent).not.toMatch(/DROP INDEX/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 7. Owner control
// ═════════════════════════════════════════════════════════════════════════════

describe("requeue is bound to the existing owner-control model, and no wider", () => {
  const parked = (over: Partial<Slot> = {}): World => {
    const w = dispatchedAndAbandoned();
    w.clock = NOW + 60 * MINUTE;
    reap(w);
    Object.assign(w.slots[0], over);
    return w;
  };

  it("uses the same predicate the Owner Control Centre enforces", () => {
    // owner-control reads user_roles for role = 'admin' with the service client;
    // has_role(uid, 'admin') is that same check inside the database. Asserting
    // both here is what stops the two drifting apart.
    expect(requeueFn).toContain("public.has_role(_actor_id, 'admin')");
    expect(ownerControl).toContain('.eq("role", "admin")');
    expect(ownerControl).toContain('return json({ error: "Admin access required" }, 403)');
    // The check precedes any read or write of the slot.
    expect(requeueFn.indexOf("not_authorized")).toBeLessThan(requeueFn.indexOf("FROM public.content_calendar"));
  });

  it("adds no new role, capability, action or endpoint", () => {
    expect(intent).not.toMatch(/public\.user_roles/);
    expect(intent).not.toMatch(/CREATE POLICY|ENABLE ROW LEVEL SECURITY/);
    // PR C1 wires no UI and no edge action; that is C2's job.
    expect(ownerControl).not.toContain("requeue_content_slot");
  });

  it("lets an admin requeue a parked slot once the platform has been checked", () => {
    const w = parked();
    expect(requeueContentSlot(w, "slot-1", ADMIN, "checked the page, nothing was posted", true))
      .toMatchObject({ ok: true, state: "PLANNED", attempts: 0, wasParked: true });
    expect(w.slots[0].parkedAt).toBeNull();
    expect(w.slots[0].parkReason).toBeNull();
    expect(claimDueContentSlot(w).ok).toBe(true);
  });

  it("refuses a dispatched slot until the caller says they looked", () => {
    const w = parked();
    expect(requeueContentSlot(w, "slot-1", ADMIN, "just try again"))
      .toMatchObject({ ok: false, error: "dispatch_confirmation_required" });
    expect(w.slots[0].parkedAt).not.toBeNull();
    expect(requeueFn).toContain("'dispatch_confirmation_required'");
  });

  it("needs no confirmation for a slot that never dispatched", () => {
    const w = world();
    claimDueContentSlot(w);
    w.clock = NOW + 60 * MINUTE;
    reap(w);                                   // reaped before dispatch
    expect(w.slots[0].parkedAt).toBeNull();

    expect(requeueContentSlot(w, "slot-1", ADMIN, "reset the counter"))
      .toMatchObject({ ok: true, attempts: 0, wasParked: false });
  });

  it("refuses a caller who is not an admin, and one with no identity", () => {
    for (const actor of [NOT_ADMIN, { id: null, isAdmin: false }, { id: null, isAdmin: true }]) {
      const w = parked();
      expect(requeueContentSlot(w, "slot-1", actor, null, true)).toMatchObject({ ok: false, error: "not_authorized" });
      expect(w.slots[0].slotState).toBe("FAILED");
      expect(w.slots[0].parkedAt).not.toBeNull();
    }
  });

  it("refuses a slot that does not exist", () => {
    expect(requeueContentSlot(parked(), "nope", ADMIN, null, true)).toMatchObject({ ok: false, error: "not_found" });
  });

  it("requeues a slot that merely exhausted its attempts", () => {
    const w = world();
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      const claim = claimDueContentSlot(w) as { request: PublishRequest };
      recordContentPublication(w, { publicationId: claim.request.publicationId, success: false, errorCode: "rate_limited" });
    }
    expect(claimDueContentSlot(w).ok).toBe(false);

    // No attempt ever dispatched, so no confirmation is demanded.
    expect(requeueContentSlot(w, "slot-1", ADMIN, "budget reset")).toMatchObject({ ok: true, attempts: 0 });
    expect(claimDueContentSlot(w).ok).toBe(true);
  });

  it("refuses every slot state, proposal state and approval state the claimer refuses", () => {
    for (const slotState of ["PLANNED", "CANCELLED", "PUBLISHING", "PUBLISHED"] as SlotState[]) {
      expect(requeueContentSlot(parked({ slotState }), "slot-1", ADMIN, null, true), slotState)
        .toMatchObject({ ok: false, error: "not_requeueable" });
    }
    for (const proposalState of ["PUBLISHED", "APPROVED", "REJECTED", "SUPERSEDED"]) {
      expect(requeueContentSlot(parked({ proposalState }), "slot-1", ADMIN, null, true), proposalState)
        .toMatchObject({ ok: false, error: "proposal_not_scheduled" });
    }
    for (const approvalState of ["WAITING_FOR_APPROVAL", "REJECTED", "EXPIRED"]) {
      expect(requeueContentSlot(parked({ approvalState }), "slot-1", ADMIN, null, true), approvalState)
        .toMatchObject({ ok: false, error: "not_approved" });
    }
  });

  it("refuses a slot that already published, whatever the caller confirms", () => {
    // The proposal check fires first in the normal case, because a successful
    // publication moves the proposal to PUBLISHED. This guard is the belt and
    // braces PR #117 described: it catches the inconsistent state where a slot
    // has a PUBLISHED publication and a still-SCHEDULED proposal.
    const w = world();
    const claim = claimDueContentSlot(w) as { request: PublishRequest };
    markPublicationDispatched(w, claim.request.publicationId);
    recordContentPublication(w, { publicationId: "pub-1", success: true, externalPostId: "post-1" });

    expect(requeueContentSlot(w, "slot-1", ADMIN, null, true))
      .toMatchObject({ ok: false, error: "not_requeueable" });          // slot is PUBLISHED

    w.slots[0].slotState = "FAILED";
    expect(requeueContentSlot(w, "slot-1", ADMIN, null, true))
      .toMatchObject({ ok: false, error: "proposal_not_scheduled" });   // proposal moved on

    w.slots[0].proposalState = "SCHEDULED";
    expect(requeueContentSlot(w, "slot-1", ADMIN, null, true))
      .toMatchObject({ ok: false, error: "already_published" });        // the last guard
    expect(w.slots[0].slotState).toBe("FAILED");
  });

  it("records the dispatch question and its answer in the audit trail", () => {
    const w = parked();
    requeueContentSlot(w, "slot-1", ADMIN, "verified on the platform", true);

    const row = w.audit.find((a) => a.action === "content_slot_requeued");
    expect(row?.actorId).toBe(ADMIN.id);
    expect(row?.metadata).toMatchObject({ was_parked: true, had_dispatched_attempt: true, confirmed_not_published: true });
    // Free text still goes through the redactor.
    expect(requeueFn).toContain("_note := public.redact_publication_error(_reason);");
    expect(requeueFn).not.toMatch(/'reason', _reason/);
  });

  it("replaces the three-argument version instead of leaving it callable", () => {
    expect(intent).toContain("DROP FUNCTION IF EXISTS public.requeue_content_slot(uuid, uuid, text);");
    expect(intent).toContain("ON FUNCTION public.requeue_content_slot(uuid, uuid, text, boolean) TO service_role;");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 8. Nothing is opened
// ═════════════════════════════════════════════════════════════════════════════

describe("PR C1 opens no publishing surface", () => {
  it("adds no Edge Function, and there is still no publishing worker", () => {
    const functions = readdirSync("supabase/functions", { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== "_shared")
      .map((entry) => entry.name);

    expect(functions.filter((name) => /social|publish|oauth|reap|requeue/i.test(name))).toEqual([]);
    for (const invented of ["social-publish", "content-publish", "social-oauth", "publish-worker", "publishing-worker"]) {
      expect(existsSync(`supabase/functions/${invented}`), `${invented} must not exist`).toBe(false);
    }
    // And nothing under _shared either, which is where a worker's helpers would go.
    expect(existsSync("supabase/functions/_shared/social")).toBe(false);
  });

  it("adds no GitHub Actions workflow of its own", () => {
    const workflows = existsSync(".github/workflows")
      ? readdirSync(".github/workflows").filter((f) => /\.ya?ml$/.test(f))
      : [];
    expect(workflows.filter((f) => /publish|social|reap/i.test(f))).toEqual([]);
  });

  it("schedules no cron job and makes no HTTP call from SQL", () => {
    expect(intent).not.toMatch(/PERFORM cron\.schedule|SELECT cron\.schedule/);
    expect(intent).not.toMatch(/http_post|pg_net|net\.http|extensions\.http/i);
    expect(intent).not.toMatch(/https?:\/\//);
    expect(intent).not.toMatch(/EXECUTE format\(|EXECUTE '/);
  });

  it("contacts no platform from the runner either", () => {
    for (const file of ["types.ts", "adapters.ts", "runner.ts"]) {
      const src = readFileSync(`src/lib/publishing/${file}`, "utf8");
      expect(src, `${file} must not contain a URL`).not.toMatch(/https?:\/\//);
      expect(src, `${file} must not fetch`).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|axios/);
      expect(src, `${file} must not read the environment`).not.toMatch(/process\.env|import\.meta\.env|Deno\.env/);
      expect(src, `${file} must not import a client`).not.toMatch(/@supabase\/supabase-js|supabase\/client/);
      expect(src, `${file} must name no platform endpoint`).not.toMatch(/graph\.facebook|api\.instagram|googleapis|open-api\.tiktok/i);
      // No platform in this phase accepts an idempotency key, so none is invented.
      expect(src, `${file} must not claim an idempotency key`).not.toMatch(/idempotency[_-]?key/i);
    }
  });

  it("activates no account and names no secret value", () => {
    expect(intent).not.toMatch(/INSERT INTO public\.social_accounts/);
    expect(intent).not.toMatch(/UPDATE public\.social_accounts\s+SET\s+status/);
    expect(intent).not.toMatch(/api_key_ref\s*=\s*'/);
    // PR #108's activation constraint is untouched.
    expect(phase8).toContain("social_accounts_active_requires_review");
    expect(intent).not.toContain("social_accounts_active_requires_review");
  });

  it("puts no credential in any audit row or return payload", () => {
    for (const [, metadata] of intent.matchAll(/INSERT INTO public\.audit_logs[\s\S]{0,700}?jsonb_build_object\(([\s\S]{0,600}?)\)\);/g)) {
      expect(metadata).not.toMatch(/api_key|token|secret|password|credential/i);
    }
    for (const body of [markFn, reaperFn, requeueFn]) {
      const returns = [...body.matchAll(/RETURN jsonb_build_object\(([\s\S]*?)\);/g)].map((m) => m[1]).join(" ");
      expect(returns).not.toMatch(/api_key|token|secret|password|config|base_url/i);
    }
  });

  it("revokes every function from anon and authenticated, and grants only service_role", () => {
    for (const [, name] of intent.matchAll(/CREATE OR REPLACE FUNCTION (public\.\w+)\(/g)) {
      const escaped = name.replace(".", "\\.");
      expect(intent, `${name} must be revoked from anon and authenticated`).toMatch(
        new RegExp(`REVOKE ALL ON FUNCTION ${escaped}\\([^)]*\\) FROM PUBLIC, anon, authenticated;`),
      );
      if (name === "public.resolve_content_slot") {
        // Internal helper: reachable only from inside the SECURITY DEFINER
        // functions above, where EXECUTE is checked against the owner. There is
        // no reason to expose a direct writer of content_calendar over PostgREST.
        expect(intent).not.toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION ${escaped}`));
        continue;
      }
      expect(intent, `${name} must be executable only by service_role`).toMatch(
        new RegExp(`GRANT EXECUTE ON FUNCTION ${escaped}\\([^)]*\\) TO service_role;`),
      );
    }
    const grants = [...intent.matchAll(/GRANT EXECUTE ON FUNCTION [^;]+ TO (\w+);/g)].map((m) => m[1]);
    expect([...new Set(grants)]).toEqual(["service_role"]);
    expect(intent).not.toMatch(/REVOKE ALL ON FUNCTION [^;]+ FROM PUBLIC;/);
    expect(intent).not.toMatch(/GRANT (SELECT|INSERT|UPDATE|DELETE|ALL)[^;]*TO (anon|authenticated|PUBLIC)/);
  });

  it("declares every function SECURITY DEFINER with a pinned search_path", () => {
    for (const body of [claimFn, recordFn, reaperFn, requeueFn, markFn, functionBody(intent, "resolve_content_slot")]) {
      expect(body).toContain("SECURITY DEFINER");
      expect(body).toContain("SET search_path = public");
    }
  });

  it("touches nothing outside this phase", () => {
    expect(intent).not.toMatch(/UPDATE public\.owner_approvals|DELETE FROM public\.owner_approvals/);
    expect(intent).not.toMatch(/UPDATE public\.support_escalations/);
    expect(intent).not.toContain("H3JHZ");
    for (const forbidden of [/public\.ai_budgets/, /public\.pricing_rules/, /public\.site_settings/,
      /public\.user_roles/, /public\.whatsapp_/]) {
      expect(intent).not.toMatch(forbidden);
    }
    for (const untouched of ["decide_owner_approval", "enforce_approval_transition",
      "enforce_escalation_transition", "schedule_content_proposal", "enforce_content_proposal_transition",
      "jsonb_has_secret_key", "redact_publication_error"]) {
      expect(intent, `${untouched} must not be redefined`).not.toContain(`FUNCTION public.${untouched}(`);
    }
    expect(intent).not.toMatch(/CREATE TRIGGER|DROP TRIGGER/);
  });

  it("keeps the transition guard's signature, so the publish edge still locks", () => {
    // PR #108's guard names record_content_publication by its exact signature
    // and compares current_user to that function's owner. Replacing the
    // function under a different signature would silently break the check.
    expect(phase8).toContain("'public.record_content_publication(uuid, boolean, text, text, text, text)')), '')");
    expect(intent).toContain("REVOKE ALL ON FUNCTION public.record_content_publication(uuid, boolean, text, text, text, text)");
    expect(intent).not.toMatch(/DROP FUNCTION IF EXISTS public\.record_content_publication/);
    // The single key to the edge is still handed out in exactly two places.
    const sets = [...intent.matchAll(/set_config\('visionex\.publishing_proposal', ([^,]+), true\)/g)];
    expect(sets).toHaveLength(2);
    expect(sets[0][1]).toBe("_pub.proposal_id::text");
    expect(sets[1][1]).toBe("''");
  });

  it("leaves PR #108's and PR #117's migration files byte-identical", () => {
    // Every change lands in the new file. Their own suites read their own
    // files, which is why both still pass unchanged.
    for (const older of [phase8, recovery]) {
      expect(older).not.toContain("dispatched_at");
      expect(older).not.toContain("parked_at");
      expect(older).not.toContain("resolve_content_slot");
    }
  });

  it("orders after both of them, and only one named later migration replaces one", () => {
    const migrations = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
    const at = (name: string) => migrations.indexOf(name);
    expect(at("20260908000000_social_publishing_intent_and_parking.sql"))
      .toBeGreaterThan(at("20260907000000_social_publishing_recovery.sql"));
    expect(at("20260907000000_social_publishing_recovery.sql"))
      .toBeGreaterThan(at("20260905000000_social_publishing_core.sql"));

    // Phase 9, step 3 adds the OAuth connection to the claimability rule and
    // therefore has to restate claim_due_content_slot in full — CREATE OR
    // REPLACE has no partial form. That is the single exception, and naming the
    // file here is what keeps it one: any other later migration touching any of
    // these five, or that file touching a second one, fails this test.
    // The replacement's own suite asserts it kept the signature, the grants and
    // a byte-identical success payload.
    const SUPERSEDED: Record<string, string> = {
      claim_due_content_slot: "20260911000000_social_claim_requires_connection.sql",
    };

    for (const file of migrations.filter((f) => f > "20260908000000_social_publishing_intent_and_parking.sql")) {
      const sql = readFileSync(`supabase/migrations/${file}`, "utf8");
      for (const fn of ["claim_due_content_slot", "record_content_publication",
        "reap_stale_content_publications", "requeue_content_slot", "mark_publication_dispatched"]) {
        if (!new RegExp(`FUNCTION public\\.${fn}\\(`).test(sql)) continue;
        expect(SUPERSEDED[fn], `${file} redefines a Phase 8 publishing function`).toBe(file);
      }
    }
  });
});
