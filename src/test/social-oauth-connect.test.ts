import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { PLATFORMS } from "../../supabase/functions/_shared/publishing/types.ts";

// Phase 9, step 3 — the connection flow, before any platform is configured.
//
// Structural assertions, the same method as the rest of this phase. The edge
// function cannot be imported here (it is Deno, and it reaches the network), so
// what is pinned is the shape of the source: which hosts it may contact, which
// values may leave it, and where its authorisation lives.
//
// The most valuable assertions in this file are the negative ones. This diff
// adds a function that holds client secrets and mints access tokens, and the
// properties worth defending are the things it must never do.

const registry = readFileSync("supabase/functions/_shared/socialOauth.ts", "utf8");
const fn = readFileSync("supabase/functions/social-oauth/index.ts", "utf8");
const grant = readFileSync("supabase/functions/_shared/metaGrant.ts", "utf8");
const config = readFileSync("supabase/config.toml", "utf8");
const deploy = readFileSync("scripts/deploy-changed-supabase-functions.sh", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const dashboard = readFileSync("src/pages/admin/AdminDashboard.tsx", "utf8");
const screen = readFileSync("src/pages/admin/AdminSocialConnections.tsx", "utf8");
const english = readFileSync("src/i18n/en.ts", "utf8");

/** Every `platform: "…"` entry in the provider registry, in declaration order. */
const registered = [...registry.matchAll(/^ {4}platform: "([a-z]+)",$/gm)].map((m) => m[1]);

describe("the registry names secrets and holds none", () => {
  it("covers exactly the platforms the database accepts", () => {
    expect(registered.sort()).toEqual([...PLATFORMS].sort());
  });

  it("stores environment variable names, never credential values", () => {
    // Every credential field must be an identifier of the shape an environment
    // variable has. A pasted secret does not fit it, so this fails on the diff
    // that introduces one rather than after it has been pushed.
    const idents = [...registry.matchAll(/client(?:Id|Secret)Env: "([^"]*)"/g)].map((m) => m[1]);
    expect(idents.length).toBe(registered.length * 2);
    for (const ident of idents) {
      expect(ident, `${ident} must look like an env var name`).toMatch(/^[A-Z][A-Z0-9_]{2,63}$/);
    }
  });

  it("contains no token, key or secret literal anywhere", () => {
    for (const source of [registry, fn]) {
      expect(source).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);          // a JWT
      expect(source).not.toMatch(/\b[A-Za-z0-9_-]{40,}\b/);          // any long opaque run
      expect(source).not.toMatch(/(sk|pk|xoxb|ghp)_[A-Za-z0-9]{8,}/); // common key prefixes
    }
  });

  it("keeps TikTok's non-standard parameter name", () => {
    // TikTok rejects `client_id`. This is the kind of detail that is corrected
    // by a well-meaning cleanup and then fails only against the live platform.
    expect(registry).toMatch(/clientIdParam: "client_key"/);
  });

  it("requires PKCE where the platform requires it", () => {
    const xEntry = registry.slice(registry.indexOf('platform: "x",'));
    expect(xEntry.slice(0, xEntry.indexOf("},"))).toContain("usesPkce: true");
  });

  it("keeps LinkedIn blocked until the company page exists", () => {
    expect(registry).toContain('blockedReason: "linkedin_company_page_missing"');
    // And the flow must actually consult it, not merely record it.
    expect(fn).toContain("provider.blockedReason");
  });
});

describe("the function connects and cannot publish", () => {
  it("contacts no content API", () => {
    // The publishing endpoints, none of which belong in a connection flow. An
    // adapter that posts is a later change and a different file.
    //
    // This list named `graph.facebook.com/v26.0/me` until step 4. That was too
    // broad to survive contact with how Meta actually works: obtaining a page
    // token REQUIRES reading /me/accounts, and without it the flow stores a
    // user token that cannot post to a page. The `/me` prefix was standing in
    // for `/me/feed`, so the publishing edges are now named directly and the
    // identity read is allowed — it is the OAuth flow finishing its own job,
    // not a content API.
    for (const endpoint of [
      "/me/feed",
      "/media_publish",
      "/threads_publish",
      "open.tiktokapis.com/v2/post",
      "googleapis.com/upload",
      "api.x.com/2/tweets",
      "api.linkedin.com/rest/posts",
    ]) {
      expect(fn, endpoint).not.toContain(endpoint);
      expect(grant, endpoint).not.toContain(endpoint);
    }
  });

  it("never touches the publishing queue", () => {
    // Asserted against invocations rather than mentions: the file's own header
    // says it has no path to claim_due_content_slot(), and a test that forbids
    // the string forbids saying so.
    for (const rpc of [
      "claim_due_content_slot",
      "record_content_publication",
      "mark_publication_dispatched",
    ]) {
      expect(fn).not.toContain(`.rpc("${rpc}"`);
    }
  });

  it("only calls the three token-store functions and the status function", () => {
    const calls = [...fn.matchAll(/\.rpc\("([a-z_]+)"/g)].map((m) => m[1]);
    expect([...new Set(calls)].sort()).toEqual([
      // Added in step 5. Neither publishes; both are the administrative
      // decisions that stand between a connected account and a publishing one.
      "record_social_account_review",
      "resolve_social_account_token",
      "revoke_social_account_token",
      "set_social_account_status",
      "social_connection_status",
      "store_social_account_token",
    ]);
  });

  it("creates accounts as unverified, so a connection grants nothing", () => {
    expect(fn).toContain('status: "unverified"');
    // Still true, and now the load-bearing half of the claim: the CALLBACK
    // grants nothing. Step 5 added an activation path, but it is a separate
    // admin action behind its own database function, not something completing
    // an authorisation can reach.
    const callback = fn.slice(fn.indexOf('if (req.method === "GET")'), fn.indexOf('if (req.method !== "POST")'));
    expect(callback).not.toContain("review_completed_at");
    expect(callback).not.toContain("set_social_account_status");
    expect(callback).not.toMatch(/status:\s*"active"/);
  });

  it("keeps recording a review separate from activating an account", () => {
    // One button doing both would mean a single click that both attests a
    // review happened and starts publishing on the strength of that claim.
    expect(fn).toContain('if (action === "record_review")');
    expect(fn).toContain('if (action === "set_status")');
    // The review function must not switch anything on by itself.
    const review = fn.slice(fn.indexOf('if (action === "record_review")'), fn.indexOf('if (action === "set_status")'));
    expect(review).not.toContain("set_social_account_status");
    expect(review).not.toMatch(/status:\s*"active"/);
  });

  it("derives the secret name instead of accepting one from the browser", () => {
    // api_key_ref names an app-level secret. A free-text field for it on an
    // admin screen is how a real credential ends up pasted into a column that
    // is only ever supposed to hold its name.
    expect(fn).toContain("_api_key_ref: provider.clientSecretEnv");
    expect(screen).not.toMatch(/api_key_ref:\s/);
  });
});

describe("what may leave the function", () => {
  it("redirects back with a result code and never a token", () => {
    const callbackReply = fn.slice(fn.indexOf("function backToScreen"), fn.indexOf("async function exchange"));
    expect(callbackReply).toContain('url.searchParams.set("connection", outcome)');
    expect(callbackReply).not.toMatch(/access_token|accessToken|refresh_token/);
  });

  it("refuses a returnTo that is not a same-origin path", () => {
    // Without this the platform's consent page links to an open redirector.
    expect(fn).toContain('returnTo.startsWith("/")');
    expect(fn).toContain('!returnTo.startsWith("//")');
  });

  it("reports secret NAMES to the browser and never values", () => {
    const status = fn.slice(fn.indexOf('if (action === "status")'), fn.indexOf('if (action === "start")'));
    expect(status).toContain("missing_secrets: credentials.missing");
    expect(status).toContain("encryption_key_present: Boolean(encryptionKey)");
    // The values themselves must not be in the response object.
    expect(status).not.toContain("clientSecret");
    expect(status).not.toMatch(/clientId(?!Env|Param)/);
  });

  it("drops provider error bodies rather than forwarding them", () => {
    // A token endpoint's error text quotes the failing request, and the failing
    // request carries the client secret.
    expect(registry).toContain("SAFE_ERROR_CODES");
    expect(fn).not.toMatch(/JSON\.stringify\(raw\)|error:\s*raw/);
  });
});

describe("authorisation, with gateway verification off", () => {
  it("is exempted in BOTH lists, because only one of them reaches production", () => {
    expect(config).toContain("[functions.social-oauth]");
    expect(deploy).toContain("[social-oauth]=1");
  });

  it("verifies the caller's own session and admin role on every POST", () => {
    expect(fn).toContain("asCaller.auth.getUser()");
    expect(fn).toContain('.eq("role", "admin")');
    expect(fn).toContain('json({ error: "Admin access required" }, 403)');
  });

  it("authenticates the callback with the sealed state instead", () => {
    expect(fn).toContain("openState(sealed, secret)");
    // Refused before the authorization code is exchanged, not after.
    expect(fn.indexOf("if (!opened.ok)")).toBeLessThan(fn.indexOf("grant_type: \"authorization_code\""));
  });

  it("encrypts the state rather than signing it, and expires it", () => {
    // The PKCE verifier travels inside the state through the operator's
    // browser. A readable state would put it in browser history and in the
    // platform's referrer logs, which is the exposure PKCE exists to prevent.
    expect(registry).toContain('name: "AES-GCM"');
    expect(registry).toContain("STATE_TTL_SECONDS");
    expect(registry).toContain('error: "state_expired"');
  });
});

describe("granted, not requested", () => {
  it("derives the publishing flag from what the platform actually granted", () => {
    expect(fn).toContain("grantedScopes.includes(provider.publishScope)");
    expect(fn).toContain("publishing_permission_granted: canPublish");
  });

  it("does not fall back to the requested scopes when none are reported", () => {
    // The single most misleading thing this flow could do: report the
    // permissions Visionex asked for as though they had been granted, which
    // would make an incomplete app review look like a finished one.
    expect(registry).not.toMatch(/scopes\s*\|\|\s*provider\.scopes/);
    expect(registry).not.toMatch(/\?\?\s*provider\.scopes/);
  });

  it("tells a connection without publishing apart from a working one", () => {
    expect(fn).toContain("connected_without_publishing");
    expect(screen).toContain("connectedWithoutPublishing");
  });
});

describe("the screen is reachable and says what is wrong", () => {
  it("registers the route and links it from the admin dashboard", () => {
    // A registered route nobody links to is not a shipped screen.
    expect(app).toContain('path="/admin/social-connections"');
    expect(app).toContain("<AdminRoute><AdminSocialConnections /></AdminRoute>");
    expect(dashboard).toContain('link: "/admin/social-connections"');
  });

  it("translates every connection state it can render, badge and hint", () => {
    for (const state of [
      "connected", "expired", "not_permitted", "not_reviewed",
      "not_connected", "secrets_missing", "blocked",
    ]) {
      expect(english, `social.state.${state}`).toContain(`"social.state.${state}":`);
      expect(english, `social.state.${state}.hint`).toContain(`"social.state.${state}.hint":`);
    }
  });

  it("translates every outcome and action error it can show", () => {
    const outcomes = [...screen.matchAll(/key: "([A-Za-z]+)" \}/g)].map((m) => m[1]);
    expect(outcomes.length).toBeGreaterThan(0);
    for (const key of new Set(outcomes)) {
      expect(english, `social.outcome.${key}`).toContain(`"social.outcome.${key}":`);
    }

    const errors = [...screen.matchAll(/^ {2}"([a-z_]+)",$/gm)].map((m) => m[1]);
    expect(errors).toContain("linkedin_company_page_missing");
    for (const code of errors) {
      expect(english, `social.error.${code}`).toContain(`"social.error.${code}":`);
    }
    expect(english).toContain('"social.error.generic":');
  });

  it("never reads a token in the browser", () => {
    expect(screen).not.toContain("social_account_tokens");
    // Property READS, not the error codes `no_refresh_token` and
    // `token_response_missing_access_token`, which are the names of failures
    // and carry nothing. A blanket match on the substrings would forbid the
    // screen from naming the errors it exists to explain.
    expect(screen).not.toMatch(/\.access_token\b|\.refresh_token\b|accessToken|refreshToken/);
    // It reports what the platform granted, which is not a credential.
    expect(screen).toContain("granted_scopes");
  });
});
