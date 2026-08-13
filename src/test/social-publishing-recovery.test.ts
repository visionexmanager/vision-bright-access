import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Phase 8, PR B — recovery: the reaper (H1) and the requeue path (M2).
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THESE TESTS DO NOT DO
//
// They do not execute PostgreSQL. There is no Postgres test infrastructure in
// this repository — no PGlite, no pg-mem, no testcontainers, no supabase/tests
// directory, and no Docker in CI — so no SQL in this phase has ever been run
// anywhere except by `supabase db push` against the live database.
//
// That means the following are NOT verified here and must not be claimed:
//   • that the PL/pgSQL compiles or behaves as written,
//   • that the CHECK constraints and unique indexes fire as intended,
//   • that FOR UPDATE SKIP LOCKED actually serialises concurrent callers.
//
// Concurrency safety in particular is argued from the locking semantics the SQL
// declares, and asserted only structurally below — a single-connection harness
// could not test it even if one existed. Proving it needs a real Postgres with
// parallel sessions.
//
// What these tests do establish: the invariants the migration declares are
// present and stay present, and the state machine the two functions implement
// behaves as intended when modelled — with the model's inputs (the timeout, the
// error code, the guard predicates) read out of the SQL rather than retyped, so
// the model cannot drift from the migration without failing here.
// ─────────────────────────────────────────────────────────────────────────────

const recovery = readFileSync("supabase/migrations/20260907000000_social_publishing_recovery.sql", "utf8");
const phase8 = readFileSync("supabase/migrations/20260905000000_social_publishing_core.sql", "utf8");

/** The body of one CREATE FUNCTION, up to the REVOKE that follows it. */
function functionBody(sql: string, name: string): string {
  const start = sql.indexOf(`FUNCTION public.${name}(`);
  expect(start, `${name} must exist`).toBeGreaterThan(-1);
  const end = sql.indexOf("REVOKE ALL ON FUNCTION", start);
  return sql.slice(start, end === -1 ? undefined : end);
}

const reaper = functionBody(recovery, "reap_stale_content_publications");
const requeue = functionBody(recovery, "requeue_content_slot");

/** A value the migration declares, read from the SQL so the model cannot drift. */
function declaredIn(sql: string, source: RegExp, label: string): string {
  const match = sql.match(source);
  expect(match, `${label} must be declared in the migration`).not.toBeNull();
  return match![1];
}
const declared = (source: RegExp, label: string) => declaredIn(recovery, source, label);

const STALE_MINUTES = Number(declared(/_stale_after interval DEFAULT interval '(\d+) minutes'/, "the stale-after default"));
const STALE_CODE = declared(/error_code\s+= '([a-z_]+)'/, "the reclaimed error code");

/** The value the reaper parks a slot at. Not a retry budget — see the migration. */
const PARKED = Number(declared(/attempts\s+= (\d+),/, "the parking value"));

/** PR #108's own ceiling default, read from PR #108's file. */
const CLAIM_CEILING_DEFAULT = Number(
  declaredIn(phase8, /_max_attempts int DEFAULT (\d+)/, "the claimer's ceiling default"),
);

const MINUTE = 60_000;

/**
 * claim_due_content_slot()'s claimability predicate, from PR #108:
 *   s.slot_state IN ('PLANNED', 'FAILED') AND s.attempts < greatest(_max_attempts, 1)
 * The caller supplies _max_attempts, which is the whole reason parking must not
 * be expressed in the same units.
 */
function isClaimable(slot: Pick<Slot, "slotState" | "attempts">, maxAttempts: number): boolean {
  return ["PLANNED", "FAILED"].includes(slot.slotState) && slot.attempts < Math.max(maxAttempts, 1);
}

// ── The model ────────────────────────────────────────────────────────────────
// Mirrors the two functions statement for statement, including each guarded
// UPDATE's WHERE clause, which is where the race protection lives.

type PubState = "CLAIMED" | "PUBLISHED" | "FAILED";
type SlotState = "PLANNED" | "CANCELLED" | "PUBLISHING" | "PUBLISHED" | "FAILED";

interface Publication {
  id: string;
  calendarId: string;
  state: PubState;
  claimedAt: number;
  platform: string;
  attempt: number;
  errorCode?: string;
  errorMessage?: string;
}

interface Slot {
  id: string;
  slotState: SlotState;
  attempts: number;
  lastError: string | null;
  platform: string;
  proposalState: string;
  approvalState: string | null;
  approvalAction: string | null;
}

interface AuditRow { action: string; actorId: string | null; metadata: Record<string, unknown> }

interface World { pubs: Publication[]; slots: Slot[]; audit: AuditRow[] }

/** reap_stale_content_publications(_stale_after) */
function reap(
  world: World,
  now: number,
  staleAfterMinutes = STALE_MINUTES,
  /** Rows another transaction holds; SKIP LOCKED passes over them. */
  locked: string[] = [],
): { ok: boolean; reaped?: number; error?: string } {
  if (staleAfterMinutes <= 0) return { ok: false, error: "invalid_interval" };
  const cutoff = now - staleAfterMinutes * MINUTE;
  let reaped = 0;

  for (const pub of world.pubs) {
    if (pub.state !== "CLAIMED" || !(pub.claimedAt < cutoff)) continue;
    if (locked.includes(pub.id)) continue; // FOR UPDATE SKIP LOCKED

    // Guarded UPDATE … WHERE id = _pub.id AND state = 'CLAIMED'
    if (pub.state !== "CLAIMED") continue;
    pub.state = "FAILED";
    pub.errorCode = STALE_CODE;
    pub.errorMessage = "Reclaimed after the worker stopped reporting.";

    // Guarded UPDATE … WHERE id = calendar_id AND slot_state = 'PUBLISHING'
    const slot = world.slots.find((s) => s.id === pub.calendarId);
    if (slot && slot.slotState === "PUBLISHING") {
      slot.slotState = "FAILED";
      slot.lastError = STALE_CODE;
      slot.attempts = PARKED;
    }

    world.audit.push({
      action: "content_publication_reclaimed",
      actorId: null,
      metadata: { platform: pub.platform, attempt: pub.attempt, stalled_seconds: Math.floor((now - pub.claimedAt) / 1000) },
    });
    reaped += 1;
  }
  return { ok: true, reaped };
}

/** requeue_content_slot(_calendar_id, _actor_id, _reason) */
function requeueSlot(
  world: World,
  calendarId: string,
  actor: { id: string | null; isAdmin: boolean },
  reason: string | null = null,
): { ok: boolean; state?: string; attempts?: number; error?: string } {
  if (actor.id === null || !actor.isAdmin) return { ok: false, error: "not_authorized" };

  const slot = world.slots.find((s) => s.id === calendarId);
  if (!slot) return { ok: false, error: "not_found" };
  if (slot.slotState !== "FAILED") return { ok: false, error: "not_requeueable" };
  if (slot.proposalState !== "SCHEDULED") return { ok: false, error: "proposal_not_scheduled" };
  if (slot.approvalAction !== "content_publish" ||
      !["APPROVED", "PROCESSING", "COMPLETED"].includes(slot.approvalState ?? "")) {
    return { ok: false, error: "not_approved" };
  }
  if (world.pubs.some((p) => p.calendarId === slot.id && p.state === "PUBLISHED")) {
    return { ok: false, error: "already_published" };
  }

  const previousAttempts = slot.attempts;
  slot.slotState = "PLANNED";
  slot.attempts = 0;
  slot.lastError = null;

  world.audit.push({
    action: "content_slot_requeued",
    actorId: actor.id,
    metadata: { platform: slot.platform, previous_attempts: previousAttempts, reason },
  });
  return { ok: true, state: "PLANNED", attempts: 0 };
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const ADMIN = { id: "11111111-1111-1111-1111-111111111111", isAdmin: true };
const NOT_ADMIN = { id: "22222222-2222-2222-2222-222222222222", isAdmin: false };
const NOW = Date.UTC(2026, 8, 7, 12, 0, 0);

function inFlight(overrides: Partial<Slot & Publication> = {}): World {
  const slot: Slot = {
    id: "slot-1", slotState: "PUBLISHING", attempts: 1, lastError: null, platform: "facebook",
    proposalState: "SCHEDULED", approvalState: "APPROVED", approvalAction: "content_publish",
    ...(overrides as Partial<Slot>),
  };
  const pub: Publication = {
    id: "pub-1", calendarId: "slot-1", state: "CLAIMED",
    claimedAt: NOW - 60 * MINUTE, platform: "facebook", attempt: 1,
    ...(overrides as Partial<Publication>),
  };
  return { pubs: [pub], slots: [slot], audit: [] };
}

// ═════════════════════════════════════════════════════════════════════════════

describe("H1 — a stalled publication is resolved, never republished", () => {
  it("marks a stale CLAIMED publication FAILED and parks its slot", () => {
    const w = inFlight();
    const out = reap(w, NOW);

    expect(out).toMatchObject({ ok: true, reaped: 1 });
    expect(w.pubs[0].state).toBe("FAILED");
    expect(w.pubs[0].errorCode).toBe(STALE_CODE);
    expect(w.slots[0].slotState).toBe("FAILED");
    expect(w.slots[0].lastError).toBe(STALE_CODE);
  });

  it("parks the slot beyond any ceiling a caller can express", () => {
    const w = inFlight({ attempts: 1 });
    reap(w, NOW);

    // claim_due_content_slot refuses when attempts >= the ceiling, so raising
    // attempts is what makes FAILED non-claimable without inventing a new state.
    // The value is int4's maximum, not the claimer's ceiling — see below.
    expect(w.slots[0].attempts).toBe(PARKED);
    expect(PARKED).toBe(2147483647);
    expect(phase8).toContain("AND s.attempts < greatest(_max_attempts, 1)");
  });

  it("never returns a slot to PLANNED and never writes PUBLISHED", () => {
    const w = inFlight();
    reap(w, NOW);
    expect(w.slots[0].slotState).not.toBe("PLANNED");
    expect(w.slots[0].slotState).not.toBe("PUBLISHED");
    // And the SQL contains no such statement at all.
    expect(reaper).not.toMatch(/slot_state\s*=\s*'PLANNED'/);
    expect(reaper).not.toMatch(/slot_state\s*=\s*'PUBLISHED'/);
    expect(reaper).not.toMatch(/state\s*=\s*'PUBLISHED'/);
  });

  it("leaves a publication that is not yet stale completely untouched", () => {
    const w = inFlight({ claimedAt: NOW - 1 * MINUTE });
    const before = JSON.stringify(w);
    const out = reap(w, NOW);

    expect(out).toMatchObject({ ok: true, reaped: 0 });
    expect(JSON.stringify(w)).toBe(before);
  });

  it("draws the line exactly at the declared timeout", () => {
    const justUnder = inFlight({ claimedAt: NOW - STALE_MINUTES * MINUTE + 1_000 });
    expect(reap(justUnder, NOW).reaped).toBe(0);

    const exactly = inFlight({ claimedAt: NOW - STALE_MINUTES * MINUTE });
    expect(exactly.pubs[0].claimedAt < NOW - STALE_MINUTES * MINUTE).toBe(false);
    expect(reap(exactly, NOW).reaped).toBe(0); // strict `<`, so the boundary is not stale

    const justOver = inFlight({ claimedAt: NOW - STALE_MINUTES * MINUTE - 1_000 });
    expect(reap(justOver, NOW).reaped).toBe(1);
  });

  it("honours a caller-supplied timeout instead of a buried constant", () => {
    const w = inFlight({ claimedAt: NOW - 10 * MINUTE });
    expect(reap(w, NOW, 15).reaped).toBe(0);
    expect(reap(w, NOW, 5).reaped).toBe(1);
    // The default is a parameter default, not a literal in the logic.
    expect(reaper).toMatch(/_stale_after\s+interval DEFAULT interval '\d+ minutes'/);
    expect(reaper).toContain("_cutoff := now() - _stale_after;");
  });

  it("refuses a non-positive interval rather than sweeping live claims", () => {
    const w = inFlight({ claimedAt: NOW - 1_000 });
    expect(reap(w, NOW, 0)).toMatchObject({ ok: false, error: "invalid_interval" });
    expect(w.pubs[0].state).toBe("CLAIMED");
    expect(reaper).toContain("'invalid_interval'");
  });

  it("is idempotent — a second sweep reaps nothing and writes nothing", () => {
    const w = inFlight();
    expect(reap(w, NOW).reaped).toBe(1);
    const afterFirst = JSON.stringify(w);

    expect(reap(w, NOW).reaped).toBe(0);
    expect(reap(w, NOW).reaped).toBe(0);
    expect(JSON.stringify(w)).toBe(afterFirst);
    expect(w.audit.filter((a) => a.action === "content_publication_reclaimed")).toHaveLength(1);
  });

  it("skips a row another transaction is holding", () => {
    const w = inFlight();
    // SKIP LOCKED: a locked row is one something is actively working on.
    expect(reap(w, NOW, STALE_MINUTES, ["pub-1"]).reaped).toBe(0);
    expect(w.pubs[0].state).toBe("CLAIMED");
  });

  it("does not overwrite a result the worker recorded first", () => {
    const w = inFlight();
    // The worker came back between the scan and the update.
    w.pubs[0].state = "PUBLISHED";
    w.slots[0].slotState = "PUBLISHED";

    expect(reap(w, NOW).reaped).toBe(0);
    expect(w.pubs[0].state).toBe("PUBLISHED");
    expect(w.slots[0].slotState).toBe("PUBLISHED");
  });

  it("does not drag a slot backwards once it has moved on", () => {
    const w = inFlight();
    w.slots[0].slotState = "PUBLISHED"; // another publication for it resolved

    reap(w, NOW);
    expect(w.pubs[0].state).toBe("FAILED");   // the stale row is still resolved
    expect(w.slots[0].slotState).toBe("PUBLISHED"); // but the slot is left alone
  });

  it("writes one audit row per reclaim, carrying no external input", () => {
    const w = inFlight();
    reap(w, NOW);

    const row = w.audit.find((a) => a.action === "content_publication_reclaimed");
    expect(row).toBeDefined();
    expect(row!.actorId).toBeNull();
    expect(Object.keys(row!.metadata).sort()).toEqual(["attempt", "platform", "stalled_seconds"]);
    expect(reaper).toContain("'content_publication_reclaimed'");
  });
});

describe("H1 — structural guarantees the model cannot prove", () => {
  it("takes a row lock and skips what is locked", () => {
    expect(reaper).toContain("FOR UPDATE SKIP LOCKED");
  });

  it("re-checks the state inside the lock before writing", () => {
    // The guard that stops the reaper overwriting a worker that came back.
    expect(reaper).toMatch(/WHERE id = _pub\.id\s+AND state = 'CLAIMED';/);
    expect(reaper).toContain("IF NOT FOUND THEN");
  });

  it("guards the calendar update on the slot still being PUBLISHING", () => {
    expect(reaper).toMatch(/WHERE id = _pub\.calendar_id\s+AND slot_state = 'PUBLISHING';/);
  });

  it("drives off the index PR #108 created for exactly this", () => {
    expect(phase8).toMatch(
      /CREATE INDEX IF NOT EXISTS social_publications_open_idx\s+ON public\.social_publications \(claimed_at\)\s+WHERE state = 'CLAIMED'/,
    );
    expect(reaper).toContain("WHERE state = 'CLAIMED'");
    expect(reaper).toContain("AND claimed_at < _cutoff");
  });

  it("uses a fixed error code and a server-side message", () => {
    expect(reaper).toContain("error_code    = 'reclaimed_stale'");
    // The stored message is a literal: no parameter, no provider text, no
    // concatenation, so nothing a caller controls can reach the column.
    expect(reaper).toMatch(/error_message = '[^']*'[,;]/);
    expect(reaper).not.toMatch(/error_message = [^']*\|\|/);
    expect(reaper).not.toMatch(/error_message = _\w+/);
  });
});

describe("a parked slot cannot be re-opened by any ceiling a caller passes", () => {
  // The defect this closes: parking used to raise attempts to the claimer's own
  // _max_attempts, which the caller supplies. A worker invoking
  // claim_due_content_slot('facebook', 5) would then have re-opened every slot
  // parked at 3 — and a parked slot may correspond to a post that is already
  // live. Parking is now expressed in units no ceiling can reach.

  it("stays unclaimable at every ceiling, up to int4's maximum", () => {
    const w = inFlight();
    reap(w, NOW);
    const parked = w.slots[0];

    expect(parked.slotState).toBe("FAILED"); // a claimable state on its own
    for (const ceiling of [1, 3, 5, 100, 2147483647]) {
      expect(isClaimable(parked, ceiling), `ceiling ${ceiling} must not re-open a parked slot`).toBe(false);
    }
  });

  it("would have been re-opened by the old ceiling-based parking", () => {
    // Same slot, parked the old way at the claimer's default ceiling.
    const oldStyle = { slotState: "FAILED" as SlotState, attempts: CLAIM_CEILING_DEFAULT };
    expect(isClaimable(oldStyle, CLAIM_CEILING_DEFAULT)).toBe(false); // fine at the default
    expect(isClaimable(oldStyle, CLAIM_CEILING_DEFAULT + 1)).toBe(true); // and gone at the next value up

    // The value actually used is immune to the same move.
    expect(isClaimable({ slotState: "FAILED", attempts: PARKED }, CLAIM_CEILING_DEFAULT + 1)).toBe(false);
  });

  it("does not couple the reaper to the claimer's ceiling at all", () => {
    // The reaper takes no attempts argument, so there is no second copy of the
    // ceiling to drift from PR #108's. Checked against the executable SQL, not
    // the prose: the comments name _max_attempts precisely to explain why the
    // parking value is deliberately not expressed in it.
    const code = (sql: string) => sql.replace(/^\s*--.*$/gm, "");

    expect(code(reaper)).not.toMatch(/_max_attempts/);
    expect(code(recovery)).not.toMatch(/_max_attempts/);
    expect(code(recovery)).not.toMatch(/int DEFAULT 3/);
    expect(recovery).toMatch(
      /CREATE OR REPLACE FUNCTION public\.reap_stale_content_publications\(\s*_stale_after interval[^)]*\)/,
    );
    // Its grant carries the one-argument signature, so no two-argument
    // overload can be left executable alongside it.
    expect(recovery).toContain("ON FUNCTION public.reap_stale_content_publications(interval) TO service_role;");
    expect(recovery).not.toMatch(/reap_stale_content_publications\(interval, int\)/);
  });

  it("leaves claim_due_content_slot entirely alone", () => {
    expect(recovery).not.toContain("FUNCTION public.claim_due_content_slot(");
    expect(recovery).not.toMatch(/CREATE OR REPLACE FUNCTION public\.claim_due_content_slot/);
    // PR #108 still owns the ceiling, unchanged.
    expect(phase8).toContain("_max_attempts int DEFAULT 3");
  });

  it("offers no automatic path that re-opens a parked slot", () => {
    // Nothing in this phase lowers attempts or moves a slot to PLANNED except
    // requeue_content_slot, which is admin-gated and audited.
    const lowering = [...recovery.matchAll(/attempts\s*=\s*(\d+)/g)].map((m) => m[1]);
    expect(lowering.sort()).toEqual(["0", String(PARKED)].sort());
    expect(reaper).not.toMatch(/slot_state\s*=\s*'PLANNED'/);
    expect(requeue).toContain("slot_state = 'PLANNED'");
  });

  it("still lets requeue bring it back from the parked value", () => {
    const w = inFlight();
    reap(w, NOW);
    expect(w.slots[0].attempts).toBe(PARKED);

    const out = requeueSlot(w, "slot-1", ADMIN, "checked the page");
    expect(out).toMatchObject({ ok: true, state: "PLANNED", attempts: 0 });
    expect(w.slots[0].attempts).toBe(0);
    // And it is claimable again, at the claimer's own default.
    expect(isClaimable(w.slots[0], CLAIM_CEILING_DEFAULT)).toBe(true);
  });
});

describe("M2 — requeue is the only way back, and only for a human", () => {
  function failedSlot(over: Partial<Slot> = {}): World {
    const w = inFlight({ slotState: "FAILED", attempts: PARKED } as Partial<Slot>);
    w.pubs[0].state = "FAILED";
    Object.assign(w.slots[0], over);
    return w;
  }

  it("returns a parked FAILED slot to PLANNED with attempts reset", () => {
    const w = failedSlot();
    expect(w.slots[0].attempts).toBe(PARKED);

    const out = requeueSlot(w, "slot-1", ADMIN, "checked the page, nothing was posted");
    expect(out).toMatchObject({ ok: true, state: "PLANNED", attempts: 0 });
    expect(w.slots[0].slotState).toBe("PLANNED");
    expect(w.slots[0].attempts).toBe(0);
    expect(w.slots[0].lastError).toBeNull();
  });

  it("resets attempts nowhere else in the schema", () => {
    // The claimer raises it, the reaper raises it, only requeue lowers it.
    expect(requeue).toContain("attempts   = 0");
    expect(reaper).not.toMatch(/attempts\s*=\s*0/);
    expect(phase8).not.toMatch(/attempts\s*=\s*0(?!\))/);

    const all = [...recovery.matchAll(/attempts\s*=\s*0/g)];
    expect(all).toHaveLength(1);
  });

  it("does not let a requeue bypass the attempt ceiling automatically", () => {
    const w = failedSlot();
    // Reaching PLANNED again costs an explicit, attributed call — there is no
    // statement anywhere that raises the ceiling itself.
    expect(recovery).not.toMatch(/_max_attempts\s*\+/);
    expect(recovery).not.toMatch(/greatest\(_max_attempts, 1\) \+/);
    requeueSlot(w, "slot-1", ADMIN);
    expect(w.slots[0].attempts).toBe(0);
  });

  it("creates no publication row, so it cannot duplicate an attempt", () => {
    const w = failedSlot();
    const before = w.pubs.length;
    requeueSlot(w, "slot-1", ADMIN);
    expect(w.pubs).toHaveLength(before);
    expect(requeue).not.toMatch(/INSERT INTO public\.social_publications/);
  });

  it("fails without effect when called a second time", () => {
    const w = failedSlot();
    expect(requeueSlot(w, "slot-1", ADMIN).ok).toBe(true);
    const afterFirst = JSON.stringify(w.slots[0]);

    const second = requeueSlot(w, "slot-1", ADMIN);
    expect(second).toMatchObject({ ok: false, error: "not_requeueable" });
    expect(JSON.stringify(w.slots[0])).toBe(afterFirst);
    expect(w.audit.filter((a) => a.action === "content_slot_requeued")).toHaveLength(1);
  });

  it("refuses every slot state that is not FAILED", () => {
    for (const state of ["PLANNED", "CANCELLED", "PUBLISHING", "PUBLISHED"] as SlotState[]) {
      const w = failedSlot({ slotState: state });
      expect(requeueSlot(w, "slot-1", ADMIN), state).toMatchObject({ ok: false, error: "not_requeueable" });
      expect(w.slots[0].slotState, state).toBe(state);
    }
  });

  it("refuses a slot whose proposal is no longer SCHEDULED", () => {
    for (const proposalState of ["PUBLISHED", "APPROVED", "REJECTED", "SUPERSEDED"]) {
      const w = failedSlot({ proposalState });
      expect(requeueSlot(w, "slot-1", ADMIN), proposalState)
        .toMatchObject({ ok: false, error: "proposal_not_scheduled" });
    }
  });

  it("refuses unless the owner approval still stands", () => {
    for (const approvalState of ["WAITING_FOR_APPROVAL", "REJECTED", "EXPIRED", "FAILED"]) {
      const w = failedSlot({ approvalState });
      expect(requeueSlot(w, "slot-1", ADMIN), approvalState)
        .toMatchObject({ ok: false, error: "not_approved" });
    }
    for (const approvalState of ["APPROVED", "PROCESSING", "COMPLETED"]) {
      const w = failedSlot({ approvalState });
      expect(requeueSlot(w, "slot-1", ADMIN), approvalState).toMatchObject({ ok: true });
    }
    // A missing approval row is refused too — the join is inner in the SQL.
    expect(requeueSlot(failedSlot({ approvalAction: null }), "slot-1", ADMIN))
      .toMatchObject({ ok: false, error: "not_approved" });
  });

  it("uses the same approval predicate the claimer uses", () => {
    for (const predicate of [
      "o.action_type = 'content_publish'",
      "o.state IN ('APPROVED', 'PROCESSING', 'COMPLETED')",
    ]) {
      expect(requeue, predicate).toContain(predicate);
      expect(phase8, predicate).toContain(predicate);
    }
  });

  it("refuses a slot that already published successfully", () => {
    const w = failedSlot();
    w.pubs.push({ id: "pub-2", calendarId: "slot-1", state: "PUBLISHED", claimedAt: NOW, platform: "facebook", attempt: 2 });

    expect(requeueSlot(w, "slot-1", ADMIN)).toMatchObject({ ok: false, error: "already_published" });
    expect(w.slots[0].slotState).toBe("FAILED");
  });

  it("refuses an unknown slot", () => {
    expect(requeueSlot(failedSlot(), "nope", ADMIN)).toMatchObject({ ok: false, error: "not_found" });
  });

  it("writes an attributed audit row for every requeue", () => {
    const w = failedSlot();
    requeueSlot(w, "slot-1", ADMIN, "verified on the platform");

    const row = w.audit.find((a) => a.action === "content_slot_requeued");
    expect(row).toBeDefined();
    expect(row!.actorId).toBe(ADMIN.id);
    expect(Object.keys(row!.metadata).sort()).toEqual(["platform", "previous_attempts", "reason"]);
    expect(requeue).toContain("'content_slot_requeued'");
  });
});

describe("authorization", () => {
  it("rejects a caller who is not an admin, and one with no identity", () => {
    for (const actor of [NOT_ADMIN, { id: null, isAdmin: false }, { id: null, isAdmin: true }]) {
      const w = inFlight({ slotState: "FAILED" } as Partial<Slot>);
      expect(requeueSlot(w, "slot-1", actor)).toMatchObject({ ok: false, error: "not_authorized" });
      expect(w.slots[0].slotState).toBe("FAILED");
    }
  });

  it("checks the actor inside the function, not only at the grant", () => {
    // So a service-role caller that never established who is asking is refused
    // even though its connection is allowed to reach the function.
    expect(requeue).toContain("public.has_role(_actor_id, 'admin')");
    expect(requeue).toContain("_actor_id IS NULL");
    expect(requeue).toContain("'not_authorized'");
    // The check comes before any read or write of the slot.
    expect(requeue.indexOf("not_authorized")).toBeLessThan(requeue.indexOf("FROM public.content_calendar"));
  });

  it("revokes both functions from anon and authenticated by name", () => {
    for (const [, name] of recovery.matchAll(/CREATE OR REPLACE FUNCTION (public\.\w+)\(/g)) {
      const escaped = name.replace(".", "\\.");
      expect(recovery, `${name} must be revoked from anon and authenticated`).toMatch(
        new RegExp(`REVOKE ALL ON FUNCTION ${escaped}\\([^)]*\\) FROM PUBLIC, anon, authenticated;`),
      );
      expect(recovery, `${name} must be executable only by service_role`).toMatch(
        new RegExp(`GRANT EXECUTE ON FUNCTION ${escaped}\\([^)]*\\) TO service_role;`),
      );
    }
  });

  it("grants execute to nobody but service_role", () => {
    const grants = [...recovery.matchAll(/GRANT EXECUTE ON FUNCTION [^;]+ TO (\w+);/g)].map((m) => m[1]);
    expect(grants).toHaveLength(2);
    expect([...new Set(grants)]).toEqual(["service_role"]);
    expect(recovery).not.toMatch(/GRANT (SELECT|INSERT|UPDATE|DELETE|ALL)[^;]*TO (anon|authenticated|PUBLIC)/);
    expect(recovery).not.toMatch(/REVOKE ALL ON FUNCTION [^;]+ FROM PUBLIC;/);
  });

  it("declares both functions SECURITY DEFINER with a pinned search_path", () => {
    for (const body of [reaper, requeue]) {
      expect(body).toContain("SECURITY DEFINER");
      expect(body).toContain("SET search_path = public");
    }
  });
});

describe("no secret can reach storage or a log through either path", () => {
  it("passes the only free-text input through the existing redactor", () => {
    expect(requeue).toContain("_note := public.redact_publication_error(_reason);");
    expect(requeue).toContain("'reason', _note");
    // The raw parameter is never stored.
    expect(requeue).not.toMatch(/'reason', _reason/);
  });

  it("puts no caller-controlled value in the reaper's audit metadata", () => {
    for (const [, metadata] of recovery.matchAll(/INSERT INTO public\.audit_logs[\s\S]{0,600}?jsonb_build_object\(([\s\S]{0,400}?)\)\);/g)) {
      expect(metadata).not.toMatch(/api_key|token|secret|password|credential/i);
    }
    const reaperAudit = reaper.slice(reaper.indexOf("INSERT INTO public.audit_logs"));
    expect(reaperAudit).not.toMatch(/_stale_after|_max_attempts/);
  });

  it("returns no account, credential or payload from either function", () => {
    for (const body of [reaper, requeue]) {
      const returns = [...body.matchAll(/RETURN jsonb_build_object\(([\s\S]*?)\);/g)].map((m) => m[1]).join(" ");
      expect(returns).not.toMatch(/api_key|token|secret|password|config|base_url/i);
    }
  });

  it("declares no column and no table of its own", () => {
    expect(recovery).not.toMatch(/CREATE TABLE/);
    expect(recovery).not.toMatch(/ADD COLUMN/);
    expect(recovery).not.toMatch(/CREATE POLICY/);
    expect(recovery).not.toMatch(/ENABLE ROW LEVEL SECURITY/);
  });
});

describe("nothing outside this phase is touched", () => {
  it("adds no new slot_state and no new publication state", () => {
    expect(recovery).not.toMatch(/slot_state IN \(/);
    expect(recovery).not.toContain("STALLED");
    expect(recovery).not.toMatch(/DROP CONSTRAINT/);
    // The Phase 8 vocabulary is used exactly as PR #108 defined it.
    expect(phase8).toContain("CHECK (slot_state IN ('PLANNED', 'CANCELLED', 'PUBLISHING', 'PUBLISHED', 'FAILED'))");
  });

  it("redefines nothing from PR #108, Phase 7 or Phase 4", () => {
    for (const untouched of [
      "claim_due_content_slot",
      "record_content_publication",
      "redact_publication_error",
      "jsonb_has_secret_key",
      "enforce_content_proposal_transition",
      "schedule_content_proposal",
      "decide_owner_approval",
      "enforce_approval_transition",
      "enforce_escalation_transition",
    ]) {
      expect(recovery, `${untouched} must not be redefined`).not.toContain(`FUNCTION public.${untouched}(`);
    }
    expect(recovery).not.toMatch(/CREATE TRIGGER|DROP TRIGGER/);
  });

  it("writes no proposal state and no approval row", () => {
    expect(recovery).not.toMatch(/UPDATE public\.content_proposals/);
    expect(recovery).not.toMatch(/UPDATE public\.owner_approvals/);
    expect(recovery).not.toMatch(/DELETE FROM/);
    expect(recovery).not.toContain("H3JHZ");
    for (const forbidden of [/public\.ai_budgets/, /public\.pricing_rules/, /public\.site_settings/,
      /public\.user_roles/, /public\.whatsapp_/]) {
      expect(recovery).not.toMatch(forbidden);
    }
  });

  it("leaves PR #108's own file untouched", () => {
    // Its assertions read that file alone, so this phase must not appear in it.
    expect(phase8).not.toContain("reap_stale_content_publications");
    expect(phase8).not.toContain("requeue_content_slot");
  });

  it("schedules no cron job and adds no Edge Function", () => {
    // pg_cron is available and used elsewhere, but nothing can stall while there
    // is no worker. The PR that adds the worker schedules this.
    expect(recovery).not.toMatch(/PERFORM cron\.schedule|SELECT cron\.schedule/);
    const functions = readdirSync("supabase/functions", { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== "_shared")
      .map((e) => e.name);
    expect(functions.filter((n) => /reap|requeue/i.test(n))).toEqual([]);
  });

  it("contacts no platform and contains no dynamic SQL", () => {
    for (const forbidden of [/https?:\/\//, /graph\.facebook/i, /googleapis/i,
      /http_post|pg_net|net\.http|extensions\.http/i, /EXECUTE format\(/, /EXECUTE '/]) {
      expect(recovery, `${forbidden} must not appear`).not.toMatch(forbidden);
    }
  });
});
