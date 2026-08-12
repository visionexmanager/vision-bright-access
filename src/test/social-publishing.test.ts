import { readFileSync, readdirSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Phase 8, PR A — the database gate, before any adapter exists.
//
// There is no live Postgres in this suite, so these are structural assertions
// over the migration itself. That is the same method the Phase 7 suite uses,
// and it is the right one here: every claim this phase makes about publishing
// is a property of the SQL — a predicate inside a statement, a partial unique
// index, a trigger guard — rather than a behaviour of a caller. If the SQL
// stops saying it, the property is gone, and that is exactly what fails here.
//
// Nothing in PR A can publish. There is no adapter and no external call in the
// diff at all; the adapter layer is PR B.

const phase8 = readFileSync("supabase/migrations/20260905000000_social_publishing_core.sql", "utf8");
const phase7 = readFileSync("supabase/migrations/20260904000000_ai_content_engine.sql", "utf8");
const phase4 = readFileSync("supabase/migrations/20260902000000_owner_control_and_escalations.sql", "utf8");
const ownerControl = readFileSync("supabase/functions/owner-control/index.ts", "utf8");

/** The `_allowed := CASE OLD.state … END` arms of the proposal transition guard. */
function transitionArms(sql: string): Record<string, string[]> {
  const fn = sql.slice(
    sql.indexOf("FUNCTION public.enforce_content_proposal_transition"),
    sql.indexOf("DROP TRIGGER IF EXISTS content_proposals_transition"),
  );
  const arms: Record<string, string[]> = {};
  for (const [, state, list] of fn.matchAll(/WHEN '(\w+)'\s+THEN ARRAY\[([^\]]*)\]/g)) {
    arms[state] = list
      .split(",")
      .map((s) => s.trim().replace(/^'|'$/g, ""))
      .filter(Boolean);
  }
  return arms;
}

/** The body of one CREATE FUNCTION, up to the REVOKE that follows it. */
function functionBody(sql: string, name: string): string {
  const start = sql.indexOf(`FUNCTION public.${name}(`);
  expect(start, `${name} must exist`).toBeGreaterThan(-1);
  const end = sql.indexOf("REVOKE ALL ON FUNCTION", start);
  return sql.slice(start, end === -1 ? undefined : end);
}

const claim = functionBody(phase8, "claim_due_content_slot");
const record = functionBody(phase8, "record_content_publication");

describe("the publish edge exists and is unreachable from outside", () => {
  it("adds SCHEDULED -> PUBLISHED and nothing else", () => {
    const before = transitionArms(phase7);
    const after = transitionArms(phase8);

    // Phase 7 made SCHEDULED terminal. That is the only arm that may differ.
    expect(before.SCHEDULED).toEqual([]);
    expect(after.SCHEDULED).toEqual(["PUBLISHED"]);

    for (const state of ["PROPOSED", "EDITED", "APPROVED", "REJECTED", "SUPERSEDED", "PUBLISHED"]) {
      expect(after[state], `${state} must keep its Phase 7 transitions`).toEqual(before[state]);
    }
    // PUBLISHED stays terminal: publishing is not a state you leave.
    expect(after.PUBLISHED).toEqual([]);
  });

  it("refuses the new edge unless the transaction is inside the recorder", () => {
    const guard = phase8.slice(
      phase8.indexOf("FUNCTION public.enforce_content_proposal_transition"),
      phase8.indexOf("DROP TRIGGER IF EXISTS content_proposals_transition"),
    );
    expect(guard).toContain("current_setting('visionex.publishing_proposal', true)");
    expect(guard).toContain("<> OLD.id::text");
    expect(guard).toContain("may only reach PUBLISHED through record_content_publication()");
    // A refusal, not a silent no-op.
    expect(guard).toMatch(/RAISE EXCEPTION[\s\S]{0,400}insufficient_privilege/);
  });

  it("does not rely on a setting a caller could forge", () => {
    // The setting alone is an accident guard: anything that can run the UPDATE
    // can also run set_config(). The second condition is the one a service-role
    // session cannot satisfy — inside a SECURITY DEFINER function current_user
    // is the function's owner.
    const guard = phase8.slice(
      phase8.indexOf("FUNCTION public.enforce_content_proposal_transition"),
      phase8.indexOf("DROP TRIGGER IF EXISTS content_proposals_transition"),
    );
    expect(guard).toContain("current_user <> COALESCE((");
    expect(guard).toContain("SELECT pg_get_userbyid(p.proowner) FROM pg_proc p");
    expect(guard).toContain("to_regprocedure(");
    expect(guard).toContain("'public.record_content_publication(uuid, boolean, text, text, text, text)')), '')");
    // Both conditions are required: OR between them means either one refuses.
    expect(guard).toMatch(/COALESCE\(current_setting[\s\S]{0,120}OR\s+current_user <>/);
  });

  it("hands out the key in exactly one place, transaction-locally", () => {
    // set_config(..., true) is transaction-local: it cannot survive into the
    // next statement on a pooled connection.
    const sets = [...phase8.matchAll(/set_config\('visionex\.publishing_proposal', ([^,]+), true\)/g)];
    expect(sets).toHaveLength(2); // set for the update, then cleared
    expect(sets[0][1]).toBe("_pub.proposal_id::text");
    expect(sets[1][1]).toBe("''");

    // And only inside record_content_publication.
    expect(record).toContain("set_config('visionex.publishing_proposal'");
    expect(claim).not.toContain("visionex.publishing_proposal");
  });

  it("lets no other migration or edge function write PUBLISHED onto a proposal", () => {
    const migrations = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql"));
    const writers = migrations.filter((f) => {
      const sql = readFileSync(`supabase/migrations/${f}`, "utf8");
      return /UPDATE public\.content_proposals[\s\S]{0,200}state\s*=\s*'PUBLISHED'/.test(sql);
    });
    expect(writers).toEqual(["20260905000000_social_publishing_core.sql"]);

    const functions = readdirSync("supabase/functions", { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => `supabase/functions/${e.name}/index.ts`)
      .filter((p) => existsSync(p));
    for (const path of functions) {
      const src = readFileSync(path, "utf8");
      const updates = [...src.matchAll(/from\("content_proposals"\)[\s\S]{0,200}?\.update\(\{([^}]*)\}/g)];
      expect(updates, `${path} writes content_proposals directly`).toHaveLength(0);
    }
  });
});

describe("a slot is claimable only when the owner approved it", () => {
  it("requires the proposal to be scheduled, which requires approval", () => {
    expect(claim).toContain("p.state = 'SCHEDULED'");
    // Phase 7's scheduler is the only way into SCHEDULED, and it refuses
    // anything not APPROVED. Untouched here, asserted so it stays true.
    const schedule = phase7.slice(phase7.indexOf("FUNCTION public.schedule_content_proposal"));
    expect(schedule).toContain("IF _proposal.state <> 'APPROVED' THEN");
  });

  it("requires the owner approval row itself to have been decided", () => {
    expect(claim).toContain("o.action_type = 'content_publish'");
    expect(claim).toContain("o.state IN ('APPROVED', 'PROCESSING', 'COMPLETED')");
    // WAITING_FOR_APPROVAL, REJECTED and EXPIRED are all absent from that list.
    expect(claim).not.toContain("'WAITING_FOR_APPROVAL'");
    expect(claim).not.toContain("'REJECTED'");
  });

  it("refuses a slot that is not due yet", () => {
    expect(claim).toContain("s.scheduled_for <= now()");
  });

  it("checks all of it in the statement, not in the caller", () => {
    // Every precondition sits inside the single UPDATE … WHERE id = (SELECT …).
    const statement = claim.slice(claim.indexOf("UPDATE public.content_calendar c"), claim.indexOf("RETURNING * INTO _slot"));
    for (const predicate of [
      "s.slot_state IN ('PLANNED', 'FAILED')",
      "s.scheduled_for <= now()",
      "p.state = 'SCHEDULED'",
      "o.state IN ('APPROVED', 'PROCESSING', 'COMPLETED')",
      "a.platform = s.platform AND a.status = 'active'",
    ]) {
      expect(statement, predicate).toContain(predicate);
    }
  });
});

describe("an account that is not active never reaches a publisher", () => {
  it("claims only when an active account exists for that platform", () => {
    expect(claim).toMatch(/EXISTS \(\s*SELECT 1 FROM public\.social_accounts a\s*WHERE a\.platform = s\.platform AND a\.status = 'active'\)/);
    // unverified and disabled are the other two states, and neither qualifies.
    expect(phase8).toContain("CHECK (status IN ('active', 'disabled', 'unverified'))");
  });

  it("fails closed if the account is disabled after the claim", () => {
    expect(claim).toContain("'no_active_account'");
    expect(claim).toContain("SET slot_state = 'FAILED', last_error = 'no_active_account'");
  });

  it("cannot be switched on without a recorded platform review", () => {
    const constraint = phase8.slice(
      phase8.indexOf("social_accounts_active_requires_review"),
      phase8.indexOf("social_accounts_api_key_ref_is_a_name"),
    );
    expect(constraint).toContain("status <> 'active'");
    expect(constraint).toContain("review_completed_at IS NOT NULL");
    expect(constraint).toContain("publishing_permission_granted");
    expect(constraint).toContain("api_key_ref IS NOT NULL");
  });

  it("ships no account at all, so nothing claims to be connected", () => {
    expect(phase8).not.toMatch(/INSERT INTO public\.social_accounts/);
    expect(phase8).toContain("No seed rows.");
  });

  it("has no platform to publish to for website or newsletter", () => {
    // They exist in the calendar vocabulary and have no external identity, so
    // they are simply never claimable — no special case, no dead branch.
    const accounts = phase8.slice(
      phase8.indexOf("CREATE TABLE IF NOT EXISTS public.social_accounts"),
      phase8.indexOf("CREATE INDEX IF NOT EXISTS social_accounts_publishable_idx"),
    );
    expect(accounts).not.toContain("'website'");
    expect(accounts).not.toContain("'newsletter'");
  });
});

describe("two workers, one publication", () => {
  it("claims with a row lock that a second worker skips", () => {
    expect(claim).toContain("FOR UPDATE OF s SKIP LOCKED");
    expect(claim).toContain("LIMIT 1");
  });

  it("moves the slot out of the claimable states in the same statement", () => {
    // The lock alone is not enough: the loser must also find nothing to claim
    // once the winner commits. PUBLISHING is in neither claimable state.
    expect(claim).toContain("SET slot_state = 'PUBLISHING'");
    expect(claim).toContain("s.slot_state IN ('PLANNED', 'FAILED')");
    expect(phase8).toContain("CHECK (slot_state IN ('PLANNED', 'CANCELLED', 'PUBLISHING', 'PUBLISHED', 'FAILED'))");
  });

  it("keeps at most one successful publication per slot, in the database", () => {
    expect(phase8).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS social_publications_one_success_per_slot\s+ON public\.social_publications \(calendar_id\)\s+WHERE state = 'PUBLISHED'/,
    );
  });

  it("records the same external post only once", () => {
    expect(phase8).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS social_publications_external_post_uniq\s+ON public\.social_publications \(platform, external_post_id\)\s+WHERE external_post_id IS NOT NULL/,
    );
    expect(record).toContain("EXCEPTION WHEN unique_violation THEN");
    expect(record).toContain("'duplicate_publication'");
  });
});

describe("retrying is safe and bounded", () => {
  it("returns a failed slot to a retryable state", () => {
    expect(record).toContain("SET slot_state = 'FAILED'");
    expect(claim).toContain("s.slot_state IN ('PLANNED', 'FAILED')");
  });

  it("counts every attempt and stops at the ceiling", () => {
    expect(claim).toContain("attempts   = c.attempts + 1");
    expect(claim).toContain("s.attempts < greatest(_max_attempts, 1)");
    expect(phase8).toContain("_max_attempts int DEFAULT 3");
  });

  it("numbers each attempt from the attempts already recorded", () => {
    expect(claim).toMatch(/SELECT count\(\*\) \+ 1 INTO _attempt\s+FROM public\.social_publications WHERE calendar_id = _slot\.id/);
  });

  it("refuses a redelivered result instead of recording it twice", () => {
    expect(record).toContain("IF _pub.state <> 'CLAIMED' THEN");
    expect(record).toContain("'not_pending'");
  });

  it("refuses a success that has nothing to point at", () => {
    expect(record).toContain("_external_post_id IS NULL OR btrim(_external_post_id) = ''");
    expect(record).toContain("'external_post_id_required'");
  });

  it("refuses to publish a proposal that is no longer scheduled", () => {
    expect(record).toContain("'proposal_not_scheduled'");
  });
});

describe("no credential is stored, returned, or logged", () => {
  it("stores the name of a secret, never a secret", () => {
    expect(phase8).toContain("api_key_ref   text");
    expect(phase8).toContain("CHECK (api_key_ref IS NULL OR api_key_ref ~ '^[A-Z][A-Z0-9_]{2,63}$')");
  });

  it("refuses credential-shaped keys in the settings blob", () => {
    const constraint = phase8.slice(phase8.indexOf("social_accounts_config_holds_no_secret"));
    for (const key of [
      "'token'", "'access_token'", "'refresh_token'", "'secret'",
      "'client_secret'", "'app_secret'", "'api_key'", "'password'", "'private_key'",
    ]) {
      expect(constraint.slice(0, 900), key).toContain(key);
    }
  });

  it("declares no column that could hold one", () => {
    const columns = [...phase8.matchAll(/^ {2}(\w+)\s{2,}/gm)].map((m) => m[1]);
    for (const column of columns) {
      expect(column, `${column} looks like a credential column`).not.toMatch(
        /^(access_token|refresh_token|token|secret|client_secret|app_secret|password|private_key)$/,
      );
    }
  });

  it("redacts provider error text before it is stored or returned", () => {
    expect(phase8).toContain("FUNCTION public.redact_publication_error");
    const redact = phase8.slice(
      phase8.indexOf("FUNCTION public.redact_publication_error"),
      phase8.indexOf("-- ── Claim a due slot"),
    );
    expect(redact).toMatch(/bearer\|token\|secret\|password/i);
    // Unlabelled but credential-shaped runs, and JWTs.
    expect(redact).toContain("[A-Za-z0-9_\\-]{32,}");
    expect(redact).toContain("eyJ");

    // Every path that stores error text goes through it.
    expect(record).toContain("public.redact_publication_error(_error_message)");
    expect(record).toMatch(/error_message = _reason/);
    expect(record).toMatch(/last_error = _reason/);
  });

  it("returns only the secret's name to the worker", () => {
    const payload = claim.slice(claim.lastIndexOf("RETURN jsonb_build_object"));
    expect(payload).toContain("'api_key_ref', _account.api_key_ref");
    expect(payload).not.toMatch(/token|secret|password/i);
  });

  it("puts no credential in the audit trail", () => {
    for (const [, metadata] of phase8.matchAll(/INSERT INTO public\.audit_logs[\s\S]{0,600}?jsonb_build_object\(([\s\S]{0,400}?)\)\);/g)) {
      expect(metadata).not.toMatch(/api_key|token|secret|password/i);
    }
  });
});

describe("security model matches Phase 7", () => {
  it("gives both tables admin read and no write policy", () => {
    for (const table of ["social_accounts", "social_publications"]) {
      expect(phase8).toMatch(new RegExp(`ALTER TABLE public\\.${table}\\s+ENABLE ROW LEVEL SECURITY`));
      expect(phase8).toMatch(new RegExp(`CREATE POLICY "Admins read [\\w ]+"\\s+ON public\\.${table} FOR SELECT TO authenticated`));
    }
    expect(phase8).not.toMatch(/FOR (INSERT|UPDATE|DELETE|ALL) TO authenticated/);
  });

  it("keeps every write function service-role only", () => {
    for (const signature of [
      "public.claim_due_content_slot(text, int)",
      "public.record_content_publication(uuid, boolean, text, text, text, text)",
      "public.redact_publication_error(text)",
    ]) {
      expect(phase8).toContain(`REVOKE ALL ON FUNCTION ${signature} FROM PUBLIC;`);
      expect(phase8).toContain(`GRANT EXECUTE ON FUNCTION ${signature} TO service_role;`);
    }
  });

  it("declares the two write functions SECURITY DEFINER with a pinned search_path", () => {
    for (const body of [claim, record]) {
      expect(body).toContain("SECURITY DEFINER");
      expect(body).toContain("SET search_path = public");
    }
  });

  it("creates no Edge Function", () => {
    const functions = readdirSync("supabase/functions", { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== "_shared")
      .map((entry) => entry.name);
    expect(functions).toHaveLength(92);
    for (const invented of ["social-publish", "content-publish", "social-oauth", "publish-worker"]) {
      expect(existsSync(`supabase/functions/${invented}`), `${invented} must not exist`).toBe(false);
    }
  });
});

describe("nothing outside this phase is touched", () => {
  it("changes no owner_approvals row and no escalation row", () => {
    // The approval engine decides; this phase only reads what it decided. That
    // is also why the manual test approval stays exactly as it is.
    expect(phase8).not.toMatch(/UPDATE public\.owner_approvals/);
    expect(phase8).not.toMatch(/DELETE FROM public\.owner_approvals/);
    expect(phase8).not.toMatch(/UPDATE public\.support_escalations/);
    expect(phase8).not.toMatch(/DELETE FROM public\.support_escalations/);
    expect(phase8).not.toContain("H3JHZ");
  });

  it("leaves decide_owner_approval and both Phase 4 triggers alone", () => {
    for (const untouched of [
      "decide_owner_approval",
      "enforce_approval_transition",
      "enforce_escalation_transition",
    ]) {
      expect(phase8, `${untouched} must not be redefined`).not.toContain(`FUNCTION public.${untouched}`);
    }
    // Still defined exactly where Phase 4 put them.
    expect(phase4).toContain("FUNCTION public.decide_owner_approval");
  });

  it("does not widen the approval action vocabulary", () => {
    expect(phase8).not.toMatch(/ALTER TABLE public\.owner_approvals/);
    for (const other of ["customer_escalation", "sourcing_approval", "refund", "discount"]) {
      expect(phase8, `${other} is not this phase's business`).not.toContain(other);
    }
  });

  it("leaves the Phase 7 guard in owner-control exactly as PR #100 left it", () => {
    expect(ownerControl).toContain("decideUnlessContentApproval");
    expect(ownerControl).toContain('.eq("action_type", "content_publish")');
  });

  it("does not touch ai_budgets, pricing, settings, roles or WhatsApp", () => {
    for (const forbidden of [
      /public\.ai_budgets/, /public\.pricing_rules/, /public\.site_settings/,
      /public\.user_roles/, /public\.whatsapp_/,
    ]) {
      expect(phase8).not.toMatch(forbidden);
    }
  });

  it("adds nothing to the Phase 7 migration file", () => {
    // Its own suite asserts PUBLISHED has no inbound edge *in that file*, and
    // that stays true: the edge is added here, by a separate migration, which
    // is what its comment said would happen.
    expect(phase7).toMatch(/WHEN 'SCHEDULED' THEN ARRAY\[\]::text\[\]/);
    expect(phase7).toContain("Publishing is a later migration adding that edge");
  });
});

describe("no external platform is contacted", () => {
  it("names no platform endpoint anywhere in the phase", () => {
    for (const endpoint of [
      /graph\.facebook\.com/i, /api\.instagram\.com/i, /open-api\.tiktok/i,
      /googleapis\.com/i, /https?:\/\//,
    ]) {
      expect(phase8, `${endpoint} must not appear`).not.toMatch(endpoint);
    }
  });

  it("carries no adapter, and no call to one", () => {
    expect(phase8).not.toMatch(/http_post|pg_net|net\.http|extensions\.http/i);
  });
});
