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
    const WRITE = /UPDATE public\.content_proposals[\s\S]{0,200}state\s*=\s*'PUBLISHED'/;
    const writers = migrations.filter((f) =>
      WRITE.test(readFileSync(`supabase/migrations/${f}`, "utf8")));

    // Two files, because PL/pgSQL has no partial CREATE OR REPLACE: PR C1 had
    // to restate record_content_publication in full to add the dispatched_at
    // rule, and restating it necessarily restates this write.
    expect(writers).toEqual([
      "20260905000000_social_publishing_core.sql",
      "20260908000000_social_publishing_intent_and_parking.sql",
    ]);

    // Stronger than a file list on its own: in every file that writes it, the
    // write must sit inside record_content_publication() and nowhere before it.
    // A future migration that redefines the recorder stays in scope; one that
    // writes PUBLISHED from anywhere else fails here whatever its name is.
    for (const file of writers) {
      const sql = readFileSync(`supabase/migrations/${file}`, "utf8");
      const recorderAt = sql.indexOf("FUNCTION public.record_content_publication(");
      expect(recorderAt, `${file} must define the recorder`).toBeGreaterThan(-1);
      expect(sql.slice(0, recorderAt), `${file} writes PUBLISHED before the recorder`).not.toMatch(WRITE);
      expect(sql.slice(recorderAt), `${file} writes PUBLISHED outside the recorder`).toMatch(WRITE);
    }

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

  it("refuses credential-shaped keys at any depth in the settings blob", () => {
    // `config ?| ARRAY[…]` only ever looked at top-level keys, so a credential
    // one level down was stored and then handed to the worker verbatim. The
    // constraint now calls a function that walks the whole document.
    expect(phase8).toContain("CHECK (NOT public.jsonb_has_secret_key(config))");
    expect(phase8).not.toMatch(/config \?\| ARRAY/);

    const walker = functionBody(phase8, "jsonb_has_secret_key");
    // Objects and arrays both: a secret parked in a list of objects is the case
    // the top-level check missed most easily.
    expect(walker).toContain("jsonb_typeof(_node) = 'object'");
    expect(walker).toContain("jsonb_typeof(_node) = 'array'");
    expect(walker).toContain("FROM jsonb_each(_node)");
    expect(walker).toContain("FROM jsonb_array_elements(_node)");
    // Keys are normalised before matching, so apiKey and API-KEY are one key.
    expect(walker).toContain("regexp_replace(lower(_key), '[^a-z0-9]', '', 'g')");
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

describe("what the two value filters actually classify", () => {
  // There is no live Postgres in this suite, so these tests take the patterns
  // the migration declares — read out of the SQL, never retyped here — and run
  // real candidate values through them. What that establishes is the
  // classification: which values are kept, which are replaced, which configs
  // are refused. It does not execute PostgreSQL. The statements that apply
  // these patterns are covered by the structural assertions elsewhere in this
  // file, and the walk below mirrors the one the plpgsql function performs.

  function declaredPattern(source: RegExp, label: string): RegExp {
    const match = phase8.match(source);
    expect(match, `${label} must be declared in the migration`).not.toBeNull();
    return new RegExp(match![1]);
  }

  const errorCodeShape = declaredPattern(
    /WHEN _error_code ~ '([^']+)'\s*AND _error_code !~ '[^']+' THEN _error_code/,
    "the error_code shape",
  );
  const errorCodeSecretRun = declaredPattern(
    /WHEN _error_code ~ '[^']+'\s*AND _error_code !~ '([^']+)' THEN _error_code/,
    "the error_code long-run rule",
  );
  const secretKeyShape = declaredPattern(
    /regexp_replace\(lower\(_key\), '\[\^a-z0-9\]', '', 'g'\)\s*~\s*'([^']+)'/,
    "the secret-key pattern",
  );

  /** The CASE in record_content_publication, over both rules it declares. */
  const classify = (code: string | null): string =>
    code === null
      ? "publish_failed"
      : errorCodeShape.test(code) && !errorCodeSecretRun.test(code)
        ? code
        : "unknown_error";

  /** The stack walk in jsonb_has_secret_key, over the pattern it declares. */
  const hasSecretKey = (doc: unknown): boolean => {
    const stack: unknown[] = [doc];
    while (stack.length > 0) {
      const node = stack.pop();
      if (Array.isArray(node)) {
        stack.push(...node);
      } else if (node !== null && typeof node === "object") {
        for (const [key, value] of Object.entries(node)) {
          if (secretKeyShape.test(key.toLowerCase().replace(/[^a-z0-9]/g, ""))) return true;
          stack.push(value);
        }
      }
    }
    return false;
  };

  describe("error_code", () => {
    it("keeps a real machine code exactly as it was given", () => {
      for (const code of ["rate_limited", "invalid_media", "token_expired", "e42", "publish_failed"]) {
        expect(classify(code)).toBe(code);
      }
    });

    it("replaces a code carrying a bearer token", () => {
      const bearer =
        "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N";
      expect(classify(bearer)).toBe("unknown_error");
      // Replaced wholesale, not truncated: no fragment survives.
      expect(classify(bearer)).not.toContain("eyJ");
      expect(classify(bearer)).not.toContain("Bearer");
    });

    it("replaces a code carrying an API key", () => {
      // The shapes a provider client actually leaks into an error field: a
      // mixed-case opaque run, a hyphen-separated key, an assignment fragment,
      // a dotted three-part value.
      //
      // None of them imitate a real vendor's prefix. A fixture that does trips
      // secret scanning for no benefit — and the brand is not what makes these
      // unstorable anyway. The uppercase, the punctuation and the unbroken run
      // are, and each of those is what the rule actually tests.
      for (const key of [
        "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789",
        "key-0000-1111-2222-NotARealCredential",
        "api_key=Zm9vYmFyLW5vdC1hLXJlYWwta2V5",
        "header.payloadpayloadpayload.signature",
      ]) {
        expect(classify(key), `${key} must not be stored`).toBe("unknown_error");
      }
    });

    it("gives a missing code the neutral default", () => {
      expect(classify(null)).toBe("publish_failed");
    });

    it("replaces an unlabelled secret that fits the shape", () => {
      // The case the shape alone let through: 32 characters of lowercase hex
      // satisfy ^[a-z0-9_]{1,40}$ and are still a credential.
      for (const hex of [
        "a1b2c3d4e5f60718293a4b5c6d7e8f90",
        "0123456789abcdef0123456789abcdef",
        "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
      ]) {
        expect(classify(hex), `${hex} must not be stored`).toBe("unknown_error");
      }
    });

    it("draws the long-run line at 32 characters, as the redactor does", () => {
      const run = "ab12".repeat(8); // exactly 32
      expect(run).toHaveLength(32);
      expect(classify(run)).toBe("unknown_error");
      expect(classify(run.slice(0, 31))).toBe(run.slice(0, 31));

      // The same threshold redact_publication_error() uses for an unlabelled
      // credential, which is where this rule comes from.
      const redact = phase8.slice(
        phase8.indexOf("FUNCTION public.redact_publication_error"),
        phase8.indexOf("-- ── Claim a due slot"),
      );
      expect(redact).toContain("{32,}");
    });

    it("keeps a long snake_case code, because an underscore breaks the run", () => {
      // The run class excludes the underscore on purpose, so tightening the
      // rule did not start rejecting legitimate descriptive codes.
      const code = "content_moderation_rejected_by_platform";
      expect(code.length).toBeLessThanOrEqual(40);
      expect(classify(code)).toBe(code);
    });

    it("accepts a short random code rather than refusing what it cannot explain", () => {
      // A short opaque value is still a usable code: the rule rejects length of
      // an unbroken run, not unfamiliarity.
      for (const code of ["x7f2q9", "e42", "a1b2c3", "err0", "q9z8y7x6w5"]) {
        expect(classify(code), `${code} must be accepted`).toBe(code);
      }
    });

    it("only ever produces a value the column will hold", () => {
      expect(phase8).toContain(
        "OR (error_code ~ '^[a-z0-9_]{1,40}$' AND error_code !~ '[a-z0-9]{32,}')",
      );
      for (const input of [
        null, "rate_limited", "Bearer eyJhbGciOiJ", "key-live-000",
        "a1b2c3d4e5f60718293a4b5c6d7e8f90", "ab12".repeat(8),
      ]) {
        const stored = classify(input);
        expect(errorCodeShape.test(stored), `${input} produced an unstorable code`).toBe(true);
        expect(errorCodeSecretRun.test(stored), `${input} produced a credential-shaped code`).toBe(false);
      }
    });

    it("does not weaken the redaction of error_message", () => {
      // error_message is free text and still goes through the redactor; this
      // fix changed the sibling column only.
      expect(record).toContain("_reason := public.redact_publication_error(_error_message);");
      expect(record).toContain("error_message = _reason");
      expect(record).toContain("last_error = _reason");
      expect(phase8).toContain("FUNCTION public.redact_publication_error");
    });
  });

  describe("config", () => {
    it("accepts ordinary non-secret settings", () => {
      expect(
        hasSecretKey({
          page_id: "123456789",
          timezone: "Asia/Riyadh",
          default_hashtags: ["visionex", "accessibility"],
          crosspost: { instagram: true, threads: false },
          retry: { max: 3, backoff_seconds: [30, 120, 600] },
        }),
      ).toBe(false);
      expect(hasSecretKey({})).toBe(false);
    });

    it("refuses access_token nested inside an object", () => {
      expect(hasSecretKey({ auth: { access_token: "not-a-real-token" } })).toBe(true);
      expect(hasSecretKey({ a: { b: { c: { refresh_token: "fake" } } } })).toBe(true);
    });

    it("refuses client_secret nested inside an array of objects", () => {
      expect(hasSecretKey({ accounts: [{ handle: "@visionex" }, { client_secret: "fake" }] })).toBe(true);
      expect(hasSecretKey({ pages: [[{ deep: { client_secret_key: "fake" } }]] })).toBe(true);
    });

    it("refuses every key the review called out, however it is spelled", () => {
      for (const key of [
        "token", "access_token", "refresh_token", "client_secret", "client_secret_key",
        "api_key", "authorization", "password", "secret", "private_key",
        "accessToken", "API-KEY", "AppSecret", "Private Key",
      ]) {
        expect(hasSecretKey({ outer: { [key]: "fake" } }), `${key} must be refused`).toBe(true);
      }
    });

    it("catches exactly what the old top-level check let through", () => {
      // The regression itself: `?|` sees only top-level keys, and this document
      // has no top-level key that looks like a credential.
      const nested = { auth: { access_token: "fake" } };
      expect(Object.keys(nested)).toEqual(["auth"]);
      expect(hasSecretKey(nested)).toBe(true);
    });
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

  it("revokes from anon and authenticated by name, not only from PUBLIC", () => {
    // `REVOKE … FROM PUBLIC` is NOT sufficient on this project. Supabase grants
    // EXECUTE on new public-schema functions to anon/authenticated directly via
    // ALTER DEFAULT PRIVILEGES, and revoking PUBLIC leaves a direct grant in
    // place — verified against production, where a Phase 7 function protected
    // that way answers an anonymous PostgREST call with 200.
    //
    // For a SECURITY DEFINER function that means an anonymous caller executing
    // it as the owner, which is exactly what the transition guard's owner check
    // assumes cannot happen. The library and bazaar migrations already use the
    // three-role form; this asserts it for every function the phase declares,
    // so a future function cannot be added without the isolation.
    for (const [, name, , returns] of phase8.matchAll(
      /CREATE OR REPLACE FUNCTION (public\.\w+)\(([\s\S]*?)\)\s*RETURNS (\w+)/g,
    )) {
      if (returns === "trigger") {
        // A trigger function is not callable as an RPC — PostgreSQL refuses to
        // invoke it outside a trigger — so it carries no grant at all.
        expect(phase8, `${name} must not be granted to anyone`).not.toMatch(
          new RegExp(`GRANT EXECUTE ON FUNCTION ${name.replace(".", "\\.")}`),
        );
        continue;
      }
      expect(phase8, `${name} must be revoked from anon and authenticated`).toMatch(
        new RegExp(`REVOKE ALL ON FUNCTION ${name.replace(".", "\\.")}\\([^)]*\\) FROM PUBLIC, anon, authenticated;`),
      );
      expect(phase8, `${name} must be executable only by service_role`).toMatch(
        new RegExp(`GRANT EXECUTE ON FUNCTION ${name.replace(".", "\\.")}\\([^)]*\\) TO service_role;`),
      );
    }
  });

  it("grants execute to nobody but service_role", () => {
    const grants = [...phase8.matchAll(/GRANT EXECUTE ON FUNCTION [^;]+ TO (\w+);/g)].map((m) => m[1]);
    expect(grants).toHaveLength(4);
    expect([...new Set(grants)]).toEqual(["service_role"]);
    // No table privilege is handed out either — RLS plus the definer functions
    // are the whole access story.
    expect(phase8).not.toMatch(/GRANT (SELECT|INSERT|UPDATE|DELETE|ALL)[^;]*TO (anon|authenticated|PUBLIC)/);
  });

  it("leaves no function of this phase protected by the weaker form", () => {
    // The exact defect this replaced: a `FROM PUBLIC;` with nothing after it.
    expect(phase8).not.toMatch(/REVOKE ALL ON FUNCTION [^;]+ FROM PUBLIC;/);
  });

  it("declares the two write functions SECURITY DEFINER with a pinned search_path", () => {
    for (const body of [claim, record]) {
      expect(body).toContain("SECURITY DEFINER");
      expect(body).toContain("SET search_path = public");
    }
  });

  it("creates no publishing Edge Function", () => {
    // Deliberately not a count. Pinning the total made every unrelated pull
    // request that adds a function fail here, which says nothing about this
    // phase. What PR A must not do is ship a publishing surface, so that is
    // what is asserted: no function directory belongs to this phase's subject.
    //
    // Phase 9 added `social-oauth`, which obtains OAuth grants and cannot
    // publish — social-oauth-connect.test.ts pins that it calls no content API
    // and none of the three queue functions. It is allowed through by name
    // rather than by widening the pattern, so a `social-publish` appearing
    // beside it still fails here.
    const functions = readdirSync("supabase/functions", { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== "_shared")
      .map((entry) => entry.name);

    expect(
      functions.filter((name) => name !== "social-oauth" && /social|publish|oauth/i.test(name)),
    ).toEqual([]);
    for (const invented of ["social-publish", "content-publish", "publish-worker"]) {
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
