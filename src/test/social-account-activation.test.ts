import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Phase 9, step 5 — the step that lets a connected account publish at all.
//
// Structural assertions over the migration, the method the rest of this phase
// uses: what the SQL says is a property of the SQL, and no caller can be
// trusted to preserve it.
//
// The property this step exists to establish is a negative one that held for
// four migrations without anybody noticing: nothing in the repository could set
// review_completed_at, api_key_ref or status, so every account the connection
// flow ever created was permanently unable to publish, and the queue reported
// that as an empty calendar. The tests below pin both halves — that a path now
// exists, and that it did not become a way around the Phase 8 gate.

const read = (file: string) =>
  readFileSync(`supabase/migrations/${file}`, "utf8").replace(/\r\n/g, "\n");

const migration = read("20260912000000_social_account_activation.sql");
const core = read("20260905000000_social_publishing_core.sql");
const screen = readFileSync("src/pages/admin/AdminSocialConnections.tsx", "utf8");
const fn = readFileSync("supabase/functions/social-oauth/index.ts", "utf8");

/** One CREATE FUNCTION body, up to the REVOKE that follows it. */
function functionBody(sql: string, name: string): string {
  const start = sql.indexOf(`FUNCTION public.${name}(`);
  expect(start, `${name} must exist`).toBeGreaterThan(-1);
  const end = sql.indexOf("REVOKE ALL ON FUNCTION", start);
  return sql.slice(start, end === -1 ? undefined : end);
}

const review = functionBody(migration, "record_social_account_review");
const setStatus = functionBody(migration, "set_social_account_status");
const status = functionBody(migration, "social_connection_status");

describe("recording a review", () => {
  it("takes the actor as a parameter rather than reading auth.uid()", () => {
    // The caller is an Edge Function holding the service key, where auth.uid()
    // is null. Reading it would record every review as performed by nobody,
    // which defeats the only purpose of the column.
    expect(review).toContain("_actor       uuid");
    expect(review).toContain("reviewed_by         = _actor");
    expect(review).not.toContain("auth.uid()");
  });

  it("refuses an actor of NULL outright", () => {
    expect(review).toContain("'error', 'actor_required'");
  });

  it("constrains api_key_ref to an environment variable name", () => {
    // A pasted access token does not fit this shape, so it fails here rather
    // than being stored in a column that is only supposed to hold a name.
    expect(review).toContain("_api_key_ref !~ '^[A-Z][A-Z0-9_]{2,63}$'");
    expect(review).toContain("'error', 'api_key_ref_invalid'");
  });

  it("does not activate anything by itself", () => {
    // Evidence and decision stay separate. One function doing both would be a
    // single call that attests a review happened and starts publishing on it.
    expect(review).not.toMatch(/SET status|status\s*=\s*'active'/);
  });

  it("records who decided, in the audit trail", () => {
    expect(review).toContain("'social_account_review_recorded'");
    expect(review).toContain("INSERT INTO public.audit_logs");
  });
});

describe("switching an account on", () => {
  it("is the only path to active, and is service-role only", () => {
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.set_social_account_status(uuid, uuid, text)\n  FROM PUBLIC, anon, authenticated;",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.set_social_account_status(uuid, uuid, text) TO service_role;",
    );
  });

  it("checks every condition the Phase 8 constraint checks", () => {
    // Restating them here is not redundant: the constraint raises, and a raised
    // constraint reaches the operator as a generic failure. These return codes
    // that name the next thing to fix.
    for (const guard of [
      "review_not_recorded",
      "publishing_not_granted",
      "api_key_ref_missing",
    ]) {
      expect(setStatus, guard).toContain(`'error', '${guard}'`);
    }
    // And the Phase 8 constraint is still there, unweakened.
    expect(core).toContain("social_accounts_active_requires_review");
    expect(migration).not.toContain("DROP CONSTRAINT");
  });

  it("adds the one condition a CHECK cannot express", () => {
    // A live grant lives in another table, so no constraint on social_accounts
    // can see it. Without this an account could be activated while
    // disconnected, and the queue would then silently withhold its slots.
    expect(setStatus).toContain("public.social_account_has_live_grant(_account_id)");
    expect(setStatus).toContain("'error', 'not_connected'");
  });

  it("locks the row it decides on", () => {
    expect(setStatus).toContain("FOR UPDATE");
  });

  it("refuses to set a status that is not active or disabled", () => {
    // 'unverified' is a state an account is born in. Returning one to it would
    // erase the difference between "never reviewed" and "reviewed, switched
    // off".
    expect(setStatus).toContain("_status NOT IN ('active', 'disabled')");
    expect(setStatus).toContain("'error', 'status_not_settable'");
  });

  it("puts no precondition on disabling", () => {
    // Turning something off must never be the operation that fails.
    const activeBranch = setStatus.slice(
      setStatus.indexOf("IF _status = 'active' THEN"),
      setStatus.indexOf("UPDATE public.social_accounts"),
    );
    for (const guard of ["review_not_recorded", "publishing_not_granted", "not_connected"]) {
      expect(activeBranch, guard).toContain(guard);
    }
  });
});

describe("the screen can see what is still missing", () => {
  it("reports whether a secret is named, as a boolean and never the name", () => {
    expect(status).toContain("'api_key_ref_present', a.api_key_ref IS NOT NULL");
    // The name itself is not sent, and the screen does not ask for it.
    expect(status).not.toMatch(/'api_key_ref',\s*a\.api_key_ref\b/);
    expect(screen).toContain("api_key_ref_present");
  });

  it("keeps the connection vocabulary the earlier steps established", () => {
    for (const state of ["not_reviewed", "not_permitted", "not_connected", "expired"]) {
      expect(status, state).toContain(`'${state}'`);
    }
  });

  it("still refuses a caller who is not an admin", () => {
    expect(status).toContain("NOT public.has_role(auth.uid(), 'admin')");
    expect(status).toContain("'error', 'forbidden'");
  });
});

describe("no credential is anywhere in this step", () => {
  it("holds no token, key or secret literal", () => {
    expect(migration).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
    expect(migration).not.toMatch(/\b[A-Za-z0-9_-]{40,}\b/);
  });

  it("names no platform hostname", () => {
    for (const host of ["graph.facebook.com", "graph.threads.net", "googleapis.com"]) {
      expect(migration, host).not.toContain(host);
    }
  });

  it("never decrypts anything", () => {
    // Activation reads whether a grant exists, never what it is.
    expect(migration).not.toContain("pgp_sym_decrypt");
    expect(migration).not.toContain("access_token_cipher");
  });

  it("activates nothing on its own", () => {
    // A migration that switched an account on would be making exactly the
    // human decision these two functions exist to keep human.
    expect(migration).not.toMatch(/UPDATE public\.social_accounts\s+SET status = 'active'/);
    expect(migration).not.toContain("INSERT INTO public.social_accounts");
  });
});

describe("the admin surface reaches it correctly", () => {
  it("derives the secret name from the registry, never from the request body", () => {
    expect(fn).toContain("_api_key_ref: provider.clientSecretEnv");
    expect(fn).not.toMatch(/_api_key_ref:\s*body\./);
  });

  it("accepts only the two settable statuses from a browser", () => {
    expect(fn).toContain('body.status !== "active" && body.status !== "disabled"');
  });

  it("passes the authenticated user as the actor, not a value from the body", () => {
    const review = fn.slice(fn.indexOf('if (action === "record_review")'), fn.indexOf('if (action === "set_status")'));
    expect(review).toContain("_actor: user.id");
    expect(review).not.toMatch(/_actor:\s*body\./);
  });
});
