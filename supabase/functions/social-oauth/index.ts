// Phase 9, step 3 — connect a real platform account, and nothing more.
//
// This function obtains OAuth grants and puts them in the store built in
// 20260910000000_social_oauth_token_store.sql. It does not publish. There is no
// call to a content API anywhere in this file, and no path from here to
// claim_due_content_slot().
//
// ── Why verify_jwt = false, and what replaces it ────────────────────────────
//
// The callback is a redirect the PLATFORM sends the operator's browser to.
// Facebook cannot attach a Supabase JWT to it, so gateway verification would
// reject every completed authorisation with a 401 before this function ran —
// the connection would look configured and never finish. Same reasoning, and
// the same exemption, as whatsapp-webhook.
//
// It does not leave anything open. There are two entry points and each proves
// its own caller:
//
//   POST  - the operator's own session. The Authorization header is verified
//           against auth.getUser(), and the admin role is read with the service
//           client so the caller cannot influence the answer.
//   GET   - the callback. Authenticated by the sealed `state`, which only this
//           function can produce: it is AES-GCM encrypted under a secret the
//           browser never sees, carries the admin's id and the account it was
//           started for, and expires in ten minutes. A callback with no state,
//           a forged state or an expired one is refused before the code is
//           exchanged.
//
// ── Secrets ─────────────────────────────────────────────────────────────────
//
// None are in this repository, and none are required for it to deploy. Each
// provider names its variables and reads them at call time; unset variables
// produce `not_configured` naming exactly which ones are missing. Add the
// secrets in Supabase and the platform starts working with no code change.

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  PLATFORMS,
  PROVIDERS,
  authorizeUrl,
  isPlatform,
  normaliseTokenResponse,
  openState,
  pkceChallenge,
  randomToken,
  readCredentials,
  sealState,
  type Platform,
  type ProviderConfig,
} from "../_shared/socialOauth.ts";
import {
  refreshThreadsToken,
  upgradeMetaGrant,
  type GrantFetch,
} from "../_shared/metaGrant.ts";

/** Where the operator is sent back to, and the only page this function links to. */
const CONNECTIONS_PATH = "/admin/social-connections";
const SITE_ORIGIN = "https://visionex.app";

const env = (name: string) => Deno.env.get(name);

/** The redirect this function is reachable at. Register it at every provider. */
function redirectUri(): string {
  return `${env("SUPABASE_URL")}/functions/v1/social-oauth`;
}

function serviceClient() {
  return createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!);
}

/**
 * The state secret. Falls back to the token encryption key so that adding one
 * secret rather than two is enough to switch the flow on — they protect the
 * same thing at different moments, and requiring a second variable would be a
 * setup step whose only effect is a confusing failure when it is forgotten.
 */
function stateSecret(): string | undefined {
  return env("SOCIAL_OAUTH_STATE_SECRET") ?? env("SOCIAL_TOKEN_ENCRYPTION_KEY");
}

// ── The callback's reply ─────────────────────────────────────────────────────
//
// A redirect back to the connection screen carrying a result code, never a
// token and never a provider's error text. The code names what happened; the
// screen turns it into a sentence in the operator's language.

function backToScreen(outcome: string, platform?: string, returnTo?: string): Response {
  // Only a same-origin path is honoured. An absolute URL arriving in the state
  // would make this function an open redirector that a platform's consent page
  // links to, which is a phishing primitive rather than a convenience.
  const path = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
    ? returnTo
    : CONNECTIONS_PATH;
  const url = new URL(path, SITE_ORIGIN);
  url.searchParams.set("connection", outcome);
  if (platform) url.searchParams.set("platform", platform);
  return new Response(null, { status: 303, headers: { Location: url.toString() } });
}

// ── Token exchange ───────────────────────────────────────────────────────────

async function exchange(
  provider: ProviderConfig,
  clientId: string,
  clientSecret: string,
  form: Record<string, string>,
): Promise<ReturnType<typeof normaliseTokenResponse>> {
  const body = new URLSearchParams({
    [provider.clientIdParam]: clientId,
    client_secret: clientSecret,
    ...form,
  });

  let response: Response;
  try {
    response = await fetch(provider.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    });
  } catch {
    // The network failed. The body is not read, so there is nothing to leak.
    return { ok: false, error: "token_exchange_rejected" };
  }

  const raw = await response.json().catch(() => null);
  // The status is deliberately not folded into the error: a provider that
  // answers 200 with an error body and one that answers 400 are the same
  // outcome here, and normaliseTokenResponse decides on the payload.
  return normaliseTokenResponse(raw);
}

/**
 * Records what the platform granted on the account row.
 *
 * publishing_permission_granted is set from the GRANTED scopes, never from the
 * requested ones. That flag is half of the constraint that lets an account go
 * `active`, so deriving it from what Visionex asked for would let an incomplete
 * app review satisfy the database's publishing gate.
 *
 * review_completed_at is deliberately left alone. A scope grant is evidence
 * that the platform allowed this, not a record that a human checked it, and
 * activation needs both.
 */
async function recordGrant(
  service: ReturnType<typeof serviceClient>,
  accountId: string,
  provider: ProviderConfig,
  grantedScopes: string[],
  externalAccountId?: string | null,
  displayName?: string | null,
) {
  const canPublish = grantedScopes.includes(provider.publishScope);
  const update: Record<string, unknown> = {
    capabilities: grantedScopes,
    publishing_permission_granted: canPublish,
    updated_at: new Date().toISOString(),
  };
  // For Meta this is now the PAGE id or the Instagram account id — the thing a
  // publish request is addressed to — rather than the id of the person who
  // authorised it. The publisher cannot build a request from the latter.
  if (externalAccountId) update.external_account_id = externalAccountId;
  // The platform's own name for the identity, as resolved during the upgrade.
  // Recorded on display_name rather than on handle: handle carries a uniqueness
  // constraint the operator's row was created under, and rewriting it here
  // could collide with another row mid-callback.
  if (displayName) update.display_name = displayName;
  await service.from("social_accounts").update(update).eq("id", accountId);
  return canPublish;
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const encryptionKey = env("SOCIAL_TOKEN_ENCRYPTION_KEY");
  const secret = stateSecret();

  // ── GET: the callback ─────────────────────────────────────────────────────
  if (req.method === "GET") {
    const params = new URL(req.url).searchParams;
    const sealed = params.get("state") ?? "";

    if (!secret || !encryptionKey) return backToScreen("not_configured");
    if (!sealed) return backToScreen("state_missing");

    const opened = await openState(sealed, secret);
    if (!opened.ok) return backToScreen(opened.error!);
    const { accountId, platform, verifier, returnTo } = opened.payload!;
    const provider = PROVIDERS[platform];

    // The operator declined on the platform's own consent screen, or the
    // platform refused. Either way there is no code, and this is not an error
    // worth alarming anyone about.
    if (params.get("error")) return backToScreen("declined", platform, returnTo);

    const code = params.get("code");
    if (!code) return backToScreen("code_missing", platform, returnTo);

    const credentials = readCredentials(provider, env);
    if (!credentials.configured) return backToScreen("not_configured", platform, returnTo);

    const token = await exchange(provider, credentials.clientId!, credentials.clientSecret!, {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      ...(provider.usesPkce && verifier ? { code_verifier: verifier } : {}),
    });
    if (!token.ok) return backToScreen(token.error!, platform, returnTo);

    const service = serviceClient();

    // ── The credential that gets stored is not always the one just issued ──
    //
    // For Meta's three platforms the authorisation-code exchange returns a
    // short-lived USER token, which cannot publish to a page and expires within
    // the hour. What must be stored is a page token (Facebook, Instagram) or a
    // long-lived Threads token, and reaching either takes further calls. See
    // _shared/metaGrant.ts for why each one is necessary.
    //
    // Storing the raw exchange result instead would produce the most expensive
    // failure this flow has: a connection screen that goes green, and a
    // publishing system that is refused by the platform an hour later for a
    // reason that reads like an incomplete app review.
    let accessToken = token.accessToken!;
    let externalAccountId = token.externalUserId ?? null;
    let expiresAt = token.expiresAt ?? null;
    let displayName: string | null = null;
    let grantedScopes = token.scopes ?? [];

    if (provider.needsGrantUpgrade) {
      // The handle the operator typed, needed to pick among several pages.
      const { data: account } = await service
        .from("social_accounts").select("handle").eq("id", accountId).maybeSingle();

      const upgraded = await upgradeMetaGrant(
        platform as "facebook" | "instagram" | "threads",
        credentials.clientId!,
        credentials.clientSecret!,
        accessToken,
        account?.handle ?? "",
        fetch as unknown as GrantFetch,
      );
      if (!upgraded.ok) return backToScreen(upgraded.error!, platform, returnTo);

      accessToken = upgraded.accessToken!;
      // Threads reports its user id on the authorisation response rather than
      // on the upgrade, so the earlier value stands when the upgrade has none.
      externalAccountId = upgraded.externalAccountId ?? externalAccountId;
      expiresAt = upgraded.expiresAt ?? null;
      displayName = upgraded.handle ?? null;
      // Read from /me/permissions, because Meta's token response carries no
      // `scope` at all. Taken only when it reported something: an empty answer
      // leaves the earlier value rather than erasing it, and neither path ever
      // falls back to the scopes Visionex asked for.
      if (upgraded.grantedScopes && upgraded.grantedScopes.length > 0) {
        grantedScopes = upgraded.grantedScopes;
      }
    }

    const { data: stored } = await service.rpc("store_social_account_token", {
      _account_id: accountId,
      _key: encryptionKey,
      _access_token: accessToken,
      _refresh_token: token.refreshToken ?? null,
      _expires_at: expiresAt,
      _scopes: grantedScopes,
      _external_user_id: externalAccountId,
      _token_type: token.tokenType ?? "bearer",
      _refresh_expires_at: token.refreshExpiresAt ?? null,
    });

    if (!stored || stored.ok !== true) {
      return backToScreen("store_failed", platform, returnTo);
    }

    const canPublish = await recordGrant(
      service, accountId, provider, grantedScopes, externalAccountId, displayName,
    );

    // "connected" and "connected_without_publishing" are different outcomes on
    // purpose. The second is the state an incomplete app review produces, and
    // reporting it as success is how a dashboard ends up green while every
    // publish attempt fails.
    return backToScreen(
      canPublish ? "connected" : "connected_without_publishing", platform, returnTo,
    );
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // ── POST: the operator's own session ──────────────────────────────────────
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const asCaller = createClient(env("SUPABASE_URL")!, env("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await asCaller.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const service = serviceClient();
    const { data: role } = await service
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) return json({ error: "Admin access required" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    // ── status: what is configured, what is connected ─────────────────────
    //
    // Merges two things the screen needs and cannot get from one place: the
    // per-account connection state from the database, and whether this
    // deployment even holds the credentials for each platform. The second is
    // knowable only here, because the browser must never see an env var.
    if (action === "status") {
      const { data: accounts } = await service.rpc("social_connection_status");

      const providers = PLATFORMS.map((platform) => {
        const provider = PROVIDERS[platform];
        const credentials = readCredentials(provider, env);
        return {
          platform,
          label: provider.label,
          configured: credentials.configured,
          // Variable NAMES, never values. This is the actionable half of a
          // refusal: it says which secret to add.
          missing_secrets: credentials.missing,
          blocked_reason: provider.blockedReason,
          requested_scopes: provider.scopes,
          publish_scope: provider.publishScope,
          // The screen cannot derive this. `can_refresh` on the account row
          // reports whether a refresh TOKEN is stored, which answers the wrong
          // question for both Meta strategies: Threads can be extended without
          // one, and Facebook can never be refreshed even though nothing is
          // visibly missing.
          refresh_strategy: provider.refreshStrategy,
        };
      });

      return json({
        ok: true,
        providers,
        accounts: accounts?.ok === true ? accounts.accounts : [],
        redirect_uri: redirectUri(),
        // The screen shows this so a missing key is diagnosable without reading
        // function logs. It reports presence, never the value.
        encryption_key_present: Boolean(encryptionKey),
        state_secret_present: Boolean(secret),
      });
    }

    // ── start: begin an authorisation ─────────────────────────────────────
    if (action === "start") {
      const platform = body.platform;
      if (!isPlatform(platform)) return json({ ok: false, error: "unknown_platform" }, 400);

      const provider = PROVIDERS[platform];
      if (provider.blockedReason) {
        return json({ ok: false, error: provider.blockedReason }, 409);
      }
      if (!secret || !encryptionKey) {
        return json({ ok: false, error: "encryption_key_missing" }, 409);
      }

      const credentials = readCredentials(provider, env);
      if (!credentials.configured) {
        return json({
          ok: false, error: "not_configured", missing_secrets: credentials.missing,
        }, 409);
      }

      const handle = typeof body.handle === "string" ? body.handle.trim() : "";
      if (!handle) return json({ ok: false, error: "handle_required" }, 400);

      // The account row is created here, as `unverified`, and that is the
      // honest state: it records which identity is being connected, and it
      // cannot publish. Phase 8 refuses `active` without a recorded review, and
      // nothing on this path sets one — so creating the row grants nothing.
      const { data: account, error: accountError } = await service
        .from("social_accounts")
        .upsert({ platform, handle, status: "unverified" }, { onConflict: "platform,handle" })
        .select("id")
        .single();

      if (accountError || !account) return json({ ok: false, error: "account_write_failed" }, 500);

      const verifier = provider.usesPkce ? randomToken(48) : undefined;
      const state = await sealState({
        accountId: account.id,
        platform,
        userId: user.id,
        iat: Math.floor(Date.now() / 1000),
        nonce: randomToken(12),
        verifier,
        returnTo: typeof body.return_to === "string" ? body.return_to : undefined,
      }, secret);

      const challenge = verifier ? await pkceChallenge(verifier) : undefined;

      // The URL is returned rather than redirected to: the caller is a fetch
      // from the admin screen, and a 303 to facebook.com would be followed by
      // fetch() rather than by the operator's browser window.
      return json({
        ok: true,
        account_id: account.id,
        authorize_url: authorizeUrl(
          provider, credentials.clientId!, redirectUri(), state, challenge,
        ),
      });
    }

    // ── refresh: rotate a grant that is about to expire ───────────────────
    if (action === "refresh") {
      const accountId = body.account_id;
      if (typeof accountId !== "string" || !accountId) {
        return json({ ok: false, error: "account_id_required" }, 400);
      }
      if (!encryptionKey) return json({ ok: false, error: "encryption_key_missing" }, 409);

      const { data: account } = await service
        .from("social_accounts").select("id, platform").eq("id", accountId).maybeSingle();
      if (!account || !isPlatform(account.platform)) {
        return json({ ok: false, error: "account_not_found" }, 404);
      }

      const provider = PROVIDERS[account.platform as Platform];
      const credentials = readCredentials(provider, env);
      if (!credentials.configured) {
        return json({
          ok: false, error: "not_configured", missing_secrets: credentials.missing,
        }, 409);
      }

      // Facebook and Instagram have nothing to refresh, and this is the honest
      // answer rather than a failure. The stored credential is a page token
      // that does not expire; Meta issues no refresh token to rotate it with.
      // The previous code asked for one anyway and reported `no_refresh_token`,
      // which describes a broken connection rather than a platform that works
      // this way — and sent operators looking for a fault that does not exist.
      if (provider.refreshStrategy === "none") {
        return json({ ok: false, error: "refresh_not_supported" }, 409);
      }

      // resolve_social_account_token refuses an expired access token but still
      // reports whether a refresh is possible, which is exactly the case this
      // action exists for. Tokens are read through the same function because it
      // is the only path that decrypts anything.
      const { data: current } = await service.rpc("resolve_social_account_token", {
        _account_id: accountId, _key: encryptionKey,
      });

      let token: ReturnType<typeof normaliseTokenResponse>;

      if (provider.refreshStrategy === "threads") {
        // Threads extends the ACCESS token; there is no refresh token in the
        // flow at all. An expired one cannot be extended — resolve refuses to
        // return it — and that case is a reconnect, which is what it says.
        const accessToken = current?.access_token;
        if (!accessToken) return json({ ok: false, error: "reconnect_required" }, 409);

        const extended = await refreshThreadsToken(accessToken, fetch as unknown as GrantFetch);
        if (!extended.ok) return json({ ok: false, error: extended.error }, 502);
        token = {
          ok: true,
          accessToken: extended.accessToken,
          expiresAt: extended.expiresAt,
          tokenType: "bearer",
          // Threads restates neither, and the store keeps the previous values
          // when they are absent rather than erasing them.
          scopes: [],
        };
      } else {
        const refreshToken = current?.refresh_token;
        if (!refreshToken) {
          return json({
            ok: false,
            // An expired grant with no refresh token is a reconnect, not a
            // refresh, and saying so is the difference between one click and a
            // support conversation.
            error: current?.can_refresh === false ? "reconnect_required" : "no_refresh_token",
          }, 409);
        }

        token = await exchange(provider, credentials.clientId!, credentials.clientSecret!, {
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        });
        if (!token.ok) return json({ ok: false, error: token.error }, 502);
      }

      const { data: stored } = await service.rpc("store_social_account_token", {
        _account_id: accountId,
        _key: encryptionKey,
        _access_token: token.accessToken,
        _refresh_token: token.refreshToken ?? null,
        _expires_at: token.expiresAt ?? null,
        // Empty rather than the requested list: a refresh that does not restate
        // the grant must not be read as a fresh grant of everything asked for.
        // The store keeps the previous scopes when this is empty.
        _scopes: token.scopes ?? [],
        _external_user_id: token.externalUserId ?? null,
        _token_type: token.tokenType ?? "bearer",
        _refresh_expires_at: token.refreshExpiresAt ?? null,
      });
      if (!stored || stored.ok !== true) return json({ ok: false, error: "store_failed" }, 500);

      return json({ ok: true, expires_at: token.expiresAt ?? null });
    }

    // ── record_review: attest that the platform allows this ───────────────
    //
    // The one thing an OAuth grant cannot establish. A granted scope says the
    // platform's API accepted the request; a review says a human opened the
    // Meta console and confirmed this app may publish as this identity. Phase 8
    // requires both, and until this action existed the second was unrecordable.
    if (action === "record_review") {
      const accountId = body.account_id;
      if (typeof accountId !== "string" || !accountId) {
        return json({ ok: false, error: "account_id_required" }, 400);
      }

      const { data: account } = await service
        .from("social_accounts").select("id, platform").eq("id", accountId).maybeSingle();
      if (!account || !isPlatform(account.platform)) {
        return json({ ok: false, error: "account_not_found" }, 404);
      }

      // Derived, never typed. api_key_ref names the app-level secret, and the
      // registry already knows which one each platform uses. Asking a human to
      // enter it would put a text field next to the words "secret" and "token"
      // on an admin screen, which is how a real credential ends up pasted into
      // a column that is only supposed to hold its name.
      const provider = PROVIDERS[account.platform as Platform];

      const { data: recorded } = await service.rpc("record_social_account_review", {
        _account_id: accountId,
        _actor: user.id,
        _api_key_ref: provider.clientSecretEnv,
        _reference: typeof body.reference === "string" ? body.reference.slice(0, 200) : null,
        _notes: typeof body.notes === "string" ? body.notes.slice(0, 2000) : null,
      });
      if (!recorded || recorded.ok !== true) {
        return json({ ok: false, error: recorded?.error ?? "review_failed" }, 400);
      }
      return json({ ok: true });
    }

    // ── set_status: switch publishing on or off ───────────────────────────
    if (action === "set_status") {
      const accountId = body.account_id;
      if (typeof accountId !== "string" || !accountId) {
        return json({ ok: false, error: "account_id_required" }, 400);
      }
      if (body.status !== "active" && body.status !== "disabled") {
        return json({ ok: false, error: "status_not_settable" }, 400);
      }

      const { data: changed } = await service.rpc("set_social_account_status", {
        _account_id: accountId,
        _actor: user.id,
        _status: body.status,
      });
      if (!changed || changed.ok !== true) {
        // The refusal codes are the checklist: review_not_recorded,
        // publishing_not_granted, api_key_ref_missing, not_connected. Each
        // names the next thing to fix rather than reporting a generic failure.
        return json({ ok: false, error: changed?.error ?? "status_change_failed" }, 409);
      }
      return json({ ok: true, status: changed.status });
    }

    // ── disconnect ────────────────────────────────────────────────────────
    if (action === "disconnect") {
      const accountId = body.account_id;
      if (typeof accountId !== "string" || !accountId) {
        return json({ ok: false, error: "account_id_required" }, 400);
      }
      const { data: revoked } = await service.rpc("revoke_social_account_token", {
        _account_id: accountId,
      });
      if (!revoked || revoked.ok !== true) {
        return json({ ok: false, error: revoked?.error ?? "revoke_failed" }, 400);
      }
      return json({ ok: true, had_token: revoked.had_token });
    }

    return json({ ok: false, error: "unknown_action" }, 400);
  } catch {
    // No error detail crosses this boundary. An exception raised mid-exchange
    // can carry a request body, and a request body here carries a client
    // secret.
    return json({ ok: false, error: "internal_error" }, 500);
  }
});
