import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Phase 9, step 2 — the token store, before any callback exists.
//
// Structural assertions over the migration, the same method the Phase 8 suite
// uses. What this step claims is a property of the SQL: which roles can reach
// a credential, which columns can hold one in the clear, and which paths refuse
// rather than return something unusable. None of that is a behaviour of a
// caller, and a caller cannot be trusted to preserve it.
//
// Nothing in this diff contacts a platform. There is no hostname, no client id
// and no token anywhere in it, and the last block here asserts exactly that.

const migration = readFileSync(
  "supabase/migrations/20260910000000_social_oauth_token_store.sql",
  "utf8",
);

/** One CREATE FUNCTION body, up to the REVOKE that follows it. */
function functionBody(name: string): string {
  const start = migration.indexOf(`FUNCTION public.${name}(`);
  expect(start, `${name} must exist`).toBeGreaterThan(-1);
  const end = migration.indexOf("REVOKE ALL ON FUNCTION", start);
  return migration.slice(start, end === -1 ? undefined : end);
}

/** The CREATE TABLE block for social_account_tokens. */
const tableBody = (() => {
  const start = migration.indexOf("CREATE TABLE IF NOT EXISTS public.social_account_tokens");
  expect(start).toBeGreaterThan(-1);
  return migration.slice(start, migration.indexOf(");", start));
})();

const store = functionBody("store_social_account_token");
const resolve = functionBody("resolve_social_account_token");
const revoke = functionBody("revoke_social_account_token");
const status = functionBody("social_connection_status");

describe("a token can only be stored as ciphertext", () => {
  it("gives the credential columns no text representation at all", () => {
    expect(tableBody).toMatch(/access_token_cipher\s+bytea NOT NULL/);
    expect(tableBody).toMatch(/refresh_token_cipher bytea/);

    // A `text` column named for a token is the shape a later "temporarily for
    // debugging" migration takes. Its absence is the guarantee, so assert the
    // absence rather than the presence of the bytea pair alone.
    expect(tableBody).not.toMatch(/access_token\s+text/);
    expect(tableBody).not.toMatch(/refresh_token\s+text/);
    expect(tableBody).not.toMatch(/token\s+text/);
  });

  it("encrypts on the way in and never stores the passphrase", () => {
    expect(store).toContain("pgp_sym_encrypt(_access_token, _key)");
    expect(store).toContain("pgp_sym_encrypt(_refresh_token, _key)");
    expect(tableBody).not.toContain("key");

    // Stronger than "the table has no key column": every single use of the
    // passphrase in this migration is either its declaration, the empty-key
    // guard, or an argument to a cipher call. It is never a stored value, a
    // returned value or a logged one — checked by enumeration rather than by a
    // hopeful negative match, because `_key` is a substring of several honest
    // identifiers and a loose pattern would pass for the wrong reason.
    const uses = [...migration.matchAll(/_key\b/g)].map((match) => {
      const from = migration.lastIndexOf("\n", match.index) + 1;
      const to = migration.indexOf("\n", match.index);
      return migration.slice(from, to === -1 ? undefined : to).trim();
    });

    expect(uses.length).toBeGreaterThan(0);
    for (const line of uses) {
      const declaration = /^_key\s+text/.test(line);
      const guard = line.includes("IF _key IS NULL OR btrim(_key) = ''");
      const cipher = /pgp_sym_(en|de)crypt\([^)]*_key\)/.test(line);
      expect(declaration || guard || cipher, `unexpected use of the passphrase: ${line}`).toBe(true);
    }
  });

  it("refuses an empty passphrase instead of encrypting under it", () => {
    // pgp_sym_encrypt(x, '') succeeds and produces a cipher anyone can open —
    // worse than no encryption, because it reads as encrypted forever after.
    for (const fn of [store, resolve]) {
      expect(fn).toContain("_key IS NULL OR btrim(_key) = ''");
      expect(fn).toContain("encryption_key_missing");
    }
  });

  it("refuses an empty cipher at the table, not only at the caller", () => {
    expect(migration).toContain("social_account_tokens_cipher_not_empty");
    expect(migration).toContain("octet_length(access_token_cipher) > 0");
  });
});

describe("a refresh does not destroy what it did not restate", () => {
  // Both of these were real: running the migration against Postgres showed a
  // refresh with no refresh token wiping the stored one, and a refresh with no
  // scope list wiping the recorded grant. Neither is visible until hours later,
  // when the access token expires and the account can no longer be refreshed —
  // failing in a way that reads like the platform revoking access.

  it("keeps the stored refresh token when the platform returns none", () => {
    // Several of these platforms issue a refresh token once, at first consent.
    expect(store).toContain(
      "refresh_token_cipher = coalesce(EXCLUDED.refresh_token_cipher, t.refresh_token_cipher)",
    );
    expect(store).not.toContain("refresh_token_cipher = EXCLUDED.refresh_token_cipher,");
  });

  it("keeps the recorded scopes when the platform restates none", () => {
    expect(store).toContain("coalesce(array_length(EXCLUDED.scopes, 1), 0) > 0");
    expect(store).toContain("ELSE t.scopes");
    expect(store).not.toContain("scopes               = EXCLUDED.scopes,");

    // NULL must stay distinguishable from an empty grant at the boundary too.
    expect(store).toContain("_scopes           text[] DEFAULT NULL");
  });

  it("reports what was stored rather than echoing what was passed", () => {
    // After a refresh that restated neither, the two differ, and the caller
    // deciding whether the connection is usable needs the stored value.
    expect(store).toContain("SELECT to_jsonb(scopes) INTO _stored_scopes");
    expect(store).toContain("'scopes', _stored_scopes");
  });
});

describe("no browser role can reach a token", () => {
  it("enables RLS on the token table and writes no policy for it", () => {
    expect(migration).toContain("ALTER TABLE public.social_account_tokens ENABLE ROW LEVEL SECURITY");

    // social_accounts grants admins SELECT; this table grants nobody anything.
    // With RLS on and no policy, every PostgREST role reads zero rows.
    expect(migration).not.toMatch(/CREATE POLICY[^;]*social_account_tokens/i);
    expect(migration).toContain(
      "REVOKE ALL ON TABLE public.social_account_tokens FROM PUBLIC, anon, authenticated",
    );
  });

  it("grants the three token functions to service_role and nothing else", () => {
    for (const name of [
      "store_social_account_token",
      "resolve_social_account_token",
      "revoke_social_account_token",
    ]) {
      const revokeLine = new RegExp(
        `REVOKE ALL ON FUNCTION public\\.${name}\\([^)]*\\) FROM PUBLIC, anon, authenticated`,
      );
      const grantLine = new RegExp(
        `GRANT EXECUTE ON FUNCTION public\\.${name}\\([^)]*\\) TO service_role;`,
      );
      expect(migration, `${name} must be revoked from browser roles`).toMatch(revokeLine);
      expect(migration, `${name} must be granted to service_role alone`).toMatch(grantLine);
    }
  });

  it("keeps resolve as the single path that yields plaintext", () => {
    const decrypting = ["store_social_account_token", "resolve_social_account_token",
      "revoke_social_account_token", "social_connection_status"]
      .filter((name) => functionBody(name).includes("pgp_sym_decrypt"));

    expect(decrypting).toEqual(["resolve_social_account_token"]);
  });
});

describe("resolve refuses rather than returning something unusable", () => {
  it("will not hand back an expired token", () => {
    // Returning it would send the publisher to the platform with a credential
    // the database already knew was dead, and the resulting failure would be
    // recorded as the platform's while costing the slot an attempt.
    expect(resolve).toContain("_row.expires_at <= now()");
    expect(resolve).toContain("token_expired");
  });

  it("distinguishes reconnect from refresh", () => {
    expect(resolve).toContain("can_refresh");
    expect(resolve).toContain("_row.refresh_token_cipher IS NOT NULL");
  });

  it("turns a wrong passphrase into a code, not an exception carrying cipher", () => {
    expect(resolve).toContain("EXCEPTION WHEN OTHERS");
    expect(resolve).toContain("decryption_failed");
  });

  it("answers not_connected for an account that never granted anything", () => {
    expect(resolve).toContain("not_connected");
  });
});

describe("what is written to the audit trail", () => {
  it("records the scopes and never the token", () => {
    expect(store).toContain("social_token_stored");
    expect(store).toContain("social_token_rotated");
    // to_jsonb(_scopes), not a coalesce to an empty array: the trail should say
    // "the platform did not restate the grant" rather than "it granted nothing".
    expect(store).toContain("'scopes', to_jsonb(_scopes)");

    // The metadata object must not carry the credential in any form. Only the
    // fact that a refresh token exists is recorded, never its value.
    expect(store).not.toMatch(/metadata[^;]*_access_token/);
    expect(store).not.toMatch(/jsonb_build_object\([^;]*'access_token'/);
    expect(store).toContain("'has_refresh_token', _refresh_token IS NOT NULL");
  });

  it("does not log every resolve", () => {
    // One line per publish attempt would record the shape of Visionex's
    // publishing activity; the useful event is already recorded by
    // record_content_publication().
    expect(resolve).not.toContain("audit_logs");
  });

  it("returns metadata about the token, never the token", () => {
    const returned = store.slice(store.lastIndexOf("RETURN jsonb_build_object"));
    expect(returned).toContain("'scopes'");
    expect(returned).toContain("'expires_at'");
    expect(returned).not.toContain("access_token");
  });
});

describe("revoking a grant takes the account out of active", () => {
  it("disables the account it just disconnected", () => {
    // An active account with no token is claimable and can only fail, burning
    // the slot's attempt budget on a connection known to be gone.
    expect(revoke).toContain("DELETE FROM public.social_account_tokens");
    expect(revoke).toMatch(/UPDATE public\.social_accounts[\s\S]*SET status = 'disabled'/);
    expect(revoke).toContain("AND status = 'active'");
  });

  it("records the revocation with the acting admin", () => {
    expect(revoke).toContain("social_token_revoked");
    expect(revoke).toContain("auth.uid()");
  });
});

describe("the status function answers without the token", () => {
  it("checks admin inside the body, since it is reachable by authenticated", () => {
    expect(status).toContain("public.has_role(auth.uid(), 'admin')");
    expect(status).toContain("'forbidden'");
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.social_connection_status() TO authenticated, service_role;",
    );
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.social_connection_status() FROM PUBLIC, anon;",
    );
  });

  it("never touches a cipher column except to ask whether one exists", () => {
    expect(status).not.toContain("access_token_cipher");
    // refresh_token_cipher appears only under IS NOT NULL — existence, not value.
    for (const [, use] of status.matchAll(/refresh_token_cipher(.{0,20})/g)) {
      expect(use.trimStart().startsWith("IS NOT NULL")).toBe(true);
    }
  });

  it("distinguishes all five connection states", () => {
    // A single green dot would hide which problem you have, and the fix for
    // each of these is different.
    for (const state of ["not_reviewed", "not_permitted", "not_connected", "expired", "connected"]) {
      expect(status, `${state} must be distinguishable`).toContain(`'${state}'`);
    }
  });
});

describe("nothing here connects to anything", () => {
  it("contains no hostname, no client id and no token", () => {
    expect(migration).not.toMatch(/https?:\/\//);
    expect(migration).not.toMatch(/graph\.facebook|tiktokapis|googleapis|api\.x\.com|linkedin\.com|threads\.net/i);
    expect(migration).not.toMatch(/client_id\s*=|client_secret\s*=/i);
  });

  it("creates no account row and no token row", () => {
    expect(migration).not.toMatch(/INSERT INTO public\.social_accounts\b/);
    expect(migration).not.toMatch(/INSERT INTO public\.social_account_tokens[^;]*VALUES[^;]*'[A-Za-z0-9_-]{20,}'/);
  });

  it("leaves the Phase 8 publishing path untouched", () => {
    // Integrating the claim path — so a slot is not claimed for an account
    // whose token has expired — is deliberately a separate change. This
    // migration redefines none of the publishing functions; naming one in a
    // comment is how the boundary is explained, so the assertion is about
    // definitions rather than mentions.
    for (const fn of [
      "claim_due_content_slot",
      "record_content_publication",
      "mark_publication_dispatched",
      "reap_stale_content_publications",
      "requeue_content_slot",
    ]) {
      expect(migration, `${fn} must not be redefined here`)
        .not.toMatch(new RegExp(`CREATE (OR REPLACE )?FUNCTION public\\.${fn}\\(`));
    }
    // And no trigger on the publishing tables changed hands either.
    expect(migration).not.toMatch(/CREATE (OR REPLACE )?TRIGGER/i);
  });
});
