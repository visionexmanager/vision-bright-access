// Phase 9, step 4 — turning an authorisation into a credential that can post.
//
// The callback shipped in #149 stored exactly what the authorization-code
// exchange returned. For every platform except Meta's that is the right thing.
// For Facebook, Instagram and Threads it is a credential that cannot publish
// and dies within the hour, and the difference is invisible until the first
// publish attempt:
//
//   Facebook   A user token is not a page token. `POST /{page-id}/feed` with a
//              user token is refused however complete the app review is. The
//              page token is a DIFFERENT string, issued per page, and reachable
//              only from /me/accounts.
//   Instagram  Publishing is addressed by the Instagram account id but
//              authorised by the PAGE token of the linked page. Two lookups,
//              neither of which the token response carries.
//   Threads    The authorisation-code exchange yields a short-lived token.
//              A second exchange makes it long-lived; without it the connection
//              works for about an hour and then reads as "revoked".
//
// Short-lived user tokens last roughly one to two hours. A connection screen
// that went green and stopped working over lunch is the failure this module
// exists to prevent.
//
// ── What is deliberately NOT here ───────────────────────────────────────────
//
// Nothing that publishes. Every endpoint below reads an identity or exchanges a
// token. `/me/accounts` enumerates the pages the operator administers; it is
// the OAuth flow finishing its own job, not a content API.
//
// No publishing edge of any platform appears in this file, and the test suite
// pins that by forbidding each one by name — which is why none of them is
// written out here even to say it is absent.
//
// ── Errors ──────────────────────────────────────────────────────────────────
//
// Same discipline as normaliseTokenResponse(): a provider error body quotes the
// failing request, and the failing request carries a client secret or a bearer
// token. No response body from any call below is ever returned, logged, or
// folded into a message. Callers get one of the fixed codes in
// META_GRANT_ERRORS and nothing else.

import { GRAPH_BASE } from "./meta.ts";

/** Injected so tests are deterministic and never reach the network. */
export type GrantFetch = (
  input: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

/** Threads is a separate product with its own host, not a Graph edge. */
export const THREADS_GRAPH = "https://graph.threads.net";

/**
 * Every code this module can produce. Callers map these to a sentence; none of
 * them carries anything the platform said.
 */
export const META_GRANT_ERRORS = [
  "long_lived_exchange_failed",
  "page_list_failed",
  "no_pages_available",
  "page_not_matched",
  "instagram_account_missing",
  "threads_exchange_failed",
  "threads_refresh_failed",
] as const;

export type MetaGrantError = typeof META_GRANT_ERRORS[number];

// ── Reading a response without ever keeping its text ─────────────────────────

async function readJson(
  call: () => Promise<{ ok: boolean; json(): Promise<unknown> }>,
): Promise<Record<string, unknown> | null> {
  try {
    const response = await call();
    const body = await response.json().catch(() => null);
    if (!body || typeof body !== "object") return null;
    const record = body as Record<string, unknown>;
    // Meta answers some failures with HTTP 200 and an `error` object, and some
    // with a non-2xx status. Both are failures and neither is inspected further.
    if (record.error !== undefined && record.error !== null) return null;
    if (!response.ok) return null;
    return record;
  } catch {
    return null;
  }
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/** `expires_in` seconds to an absolute instant, or undefined when absent. */
function expiryFrom(value: unknown, nowMs: number): string | undefined {
  const seconds = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  return new Date(nowMs + seconds * 1000).toISOString();
}

// ── Facebook and Instagram ───────────────────────────────────────────────────

export interface LongLivedToken {
  readonly ok: boolean;
  readonly accessToken?: string;
  readonly expiresAt?: string;
  readonly error?: MetaGrantError;
}

/**
 * Short-lived user token to long-lived user token.
 *
 * The credentials travel in the query string because this endpoint is specified
 * that way and does not accept them elsewhere. The URL is built per call, never
 * logged, and never returned — the only value that escapes this function is the
 * token itself, to a caller that immediately encrypts it.
 */
export async function exchangeLongLivedUser(
  clientId: string,
  clientSecret: string,
  shortLivedToken: string,
  fetchImpl: GrantFetch,
  nowMs = Date.now(),
): Promise<LongLivedToken> {
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("fb_exchange_token", shortLivedToken);

  const body = await readJson(() => fetchImpl(url.toString(), { method: "GET" }));
  const token = nonEmpty(body?.access_token);
  if (!token) return { ok: false, error: "long_lived_exchange_failed" };

  return { ok: true, accessToken: token, expiresAt: expiryFrom(body?.expires_in, nowMs) };
}

/**
 * The permissions this grant actually carries, as Meta reports them.
 *
 * Necessary because Meta's authorisation-code response omits `scope` entirely.
 * normaliseTokenResponse() correctly records an empty list rather than assuming
 * the requested scopes were granted — but for Meta that empty list is the ONLY
 * possible outcome, so publishing_permission_granted could never become true
 * and no Facebook or Instagram account could ever be activated.
 *
 * This is the endpoint that answers the question honestly. It reports what was
 * granted, never what was asked for, so the distinction the rest of the system
 * depends on is preserved rather than papered over: a declined permission comes
 * back `declined` here and is dropped.
 */
export async function listGrantedPermissions(
  userToken: string,
  fetchImpl: GrantFetch,
): Promise<string[]> {
  const url = new URL(`${GRAPH_BASE}/me/permissions`);
  const body = await readJson(() => fetchImpl(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${userToken}` },
  }));
  if (!body || !Array.isArray(body.data)) return [];

  const granted: string[] = [];
  for (const entry of body.data as unknown[]) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const name = nonEmpty(row.permission);
    // Meta lists declined and expired permissions alongside granted ones. Only
    // `granted` counts; treating the presence of a row as a grant would report
    // a permission the operator explicitly refused as though they had allowed
    // it, which is the exact misreading this whole path exists to prevent.
    if (name && row.status === "granted") granted.push(name);
  }
  return granted;
}

export interface ManagedPage {
  readonly id: string;
  readonly name?: string;
  readonly username?: string;
  /** The page access token. The whole reason this call exists. */
  readonly accessToken: string;
}

export interface PageList {
  readonly ok: boolean;
  readonly pages?: ManagedPage[];
  readonly error?: MetaGrantError;
}

/**
 * The pages this user administers, each with its own token.
 *
 * The user token goes in the Authorization header rather than the query string.
 * Meta accepts both; a header keeps a live credential out of anything that
 * records URLs, and unlike the exchange above there is no specification here
 * forcing the worse option.
 */
export async function listManagedPages(
  userToken: string,
  fetchImpl: GrantFetch,
): Promise<PageList> {
  const url = new URL(`${GRAPH_BASE}/me/accounts`);
  url.searchParams.set("fields", "id,name,username,access_token");
  url.searchParams.set("limit", "100");

  const body = await readJson(() => fetchImpl(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${userToken}` },
  }));
  if (!body || !Array.isArray(body.data)) return { ok: false, error: "page_list_failed" };

  const pages: ManagedPage[] = [];
  for (const entry of body.data as unknown[]) {
    if (!entry || typeof entry !== "object") continue;
    const page = entry as Record<string, unknown>;
    const id = nonEmpty(page.id);
    const accessToken = nonEmpty(page.access_token);
    // A page with no token is a page this grant cannot publish to. Keeping it
    // would let selectPage() match it and produce a connection that stores no
    // usable credential.
    if (!id || !accessToken) continue;
    pages.push({ id, accessToken, name: nonEmpty(page.name), username: nonEmpty(page.username) });
  }

  if (pages.length === 0) return { ok: false, error: "no_pages_available" };
  return { ok: true, pages };
}

/** Lower-cased, `@` and surrounding space removed. Comparison form only. */
export function normaliseHandle(handle: string): string {
  return handle.trim().replace(/^@+/, "").toLowerCase();
}

export interface PageChoice {
  readonly ok: boolean;
  readonly page?: ManagedPage;
  readonly error?: MetaGrantError;
}

/**
 * Which of the operator's pages this connection is for.
 *
 * Matched against the handle typed on the connection screen, by id, then
 * username, then name. When nothing matches and the account administers exactly
 * one page, that page is used — with one candidate there is nothing to get
 * wrong.
 *
 * With several pages and no match this REFUSES rather than taking the first.
 * Guessing here does not fail; it succeeds against the wrong page, and the way
 * that is discovered is a post appearing somewhere it was never meant to go.
 */
export function selectPage(pages: readonly ManagedPage[], handle: string): PageChoice {
  if (pages.length === 0) return { ok: false, error: "no_pages_available" };

  const wanted = normaliseHandle(handle);
  const match = pages.find((page) =>
    page.id === handle.trim()
    || (page.username !== undefined && normaliseHandle(page.username) === wanted)
    || (page.name !== undefined && normaliseHandle(page.name) === wanted));

  if (match) return { ok: true, page: match };
  if (pages.length === 1) return { ok: true, page: pages[0] };
  return { ok: false, error: "page_not_matched" };
}

export interface InstagramAccount {
  readonly ok: boolean;
  readonly id?: string;
  readonly username?: string;
  readonly error?: MetaGrantError;
}

/**
 * The Instagram professional account linked to a page.
 *
 * Absent for a personal Instagram account, and absent for a professional one
 * that has not been linked to this page. Both are configuration the operator
 * must fix in Meta rather than anything the code can work around, so the
 * refusal is named specifically enough to act on.
 */
export async function instagramAccountForPage(
  pageId: string,
  pageToken: string,
  fetchImpl: GrantFetch,
): Promise<InstagramAccount> {
  const url = new URL(`${GRAPH_BASE}/${pageId}`);
  url.searchParams.set("fields", "instagram_business_account{id,username}");

  const body = await readJson(() => fetchImpl(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${pageToken}` },
  }));

  const linked = body?.instagram_business_account;
  if (!linked || typeof linked !== "object") {
    return { ok: false, error: "instagram_account_missing" };
  }
  const account = linked as Record<string, unknown>;
  const id = nonEmpty(account.id);
  if (!id) return { ok: false, error: "instagram_account_missing" };

  return { ok: true, id, username: nonEmpty(account.username) };
}

// ── Threads ──────────────────────────────────────────────────────────────────

/**
 * Short-lived Threads token to long-lived (about 60 days).
 *
 * A different host, a different grant name and a different parameter set from
 * the Facebook exchange above. `th_exchange_token` is not `fb_exchange_token`,
 * and this endpoint takes no client id at all.
 */
export async function exchangeLongLivedThreads(
  clientSecret: string,
  shortLivedToken: string,
  fetchImpl: GrantFetch,
  nowMs = Date.now(),
): Promise<LongLivedToken> {
  const url = new URL(`${THREADS_GRAPH}/access_token`);
  url.searchParams.set("grant_type", "th_exchange_token");
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("access_token", shortLivedToken);

  const body = await readJson(() => fetchImpl(url.toString(), { method: "GET" }));
  const token = nonEmpty(body?.access_token);
  if (!token) return { ok: false, error: "threads_exchange_failed" };

  return { ok: true, accessToken: token, expiresAt: expiryFrom(body?.expires_in, nowMs) };
}

/**
 * Extend a long-lived Threads token.
 *
 * Not an OAuth refresh: there is no refresh token, and the credential presented
 * is the access token itself. Threads refuses a token younger than 24 hours and
 * one that has already expired, so this can fail for a perfectly healthy
 * connection — which is why the caller treats failure as "try again later or
 * reconnect", never as "the account is broken".
 */
export async function refreshThreadsToken(
  longLivedToken: string,
  fetchImpl: GrantFetch,
  nowMs = Date.now(),
): Promise<LongLivedToken> {
  const url = new URL(`${THREADS_GRAPH}/refresh_access_token`);
  url.searchParams.set("grant_type", "th_refresh_token");
  url.searchParams.set("access_token", longLivedToken);

  const body = await readJson(() => fetchImpl(url.toString(), { method: "GET" }));
  const token = nonEmpty(body?.access_token);
  if (!token) return { ok: false, error: "threads_refresh_failed" };

  return { ok: true, accessToken: token, expiresAt: expiryFrom(body?.expires_in, nowMs) };
}

// ── The whole upgrade, in one call ───────────────────────────────────────────

export interface UpgradedGrant {
  readonly ok: boolean;
  /** What should actually be stored: a page token, or a long-lived user token. */
  readonly accessToken?: string;
  /** Page id, Instagram account id, or Threads user id. Never a credential. */
  readonly externalAccountId?: string;
  /**
   * When the stored token dies, or null for one that does not.
   *
   * Null is the normal answer for Facebook and Instagram and is not a missing
   * value: a page token derived from a long-lived user token does not expire.
   * Recording an invented expiry would make the claim predicate treat a healthy
   * account as disconnected on a date nothing actually happens.
   */
  readonly expiresAt?: string | null;
  readonly handle?: string;
  /**
   * What Meta says it granted. Empty when the platform did not report it, never
   * filled in from the requested scopes — the gap between the two is the whole
   * question of whether an app review has completed.
   */
  readonly grantedScopes?: string[];
  readonly error?: MetaGrantError;
}

/**
 * Everything above, sequenced per platform.
 *
 * Returns the credential the publisher will need, not the one the authorisation
 * happened to produce. A caller that skips this stores a token that expires
 * within the hour and cannot post.
 */
export async function upgradeMetaGrant(
  platform: "facebook" | "instagram" | "threads",
  clientId: string,
  clientSecret: string,
  shortLivedToken: string,
  handle: string,
  fetchImpl: GrantFetch,
  nowMs = Date.now(),
): Promise<UpgradedGrant> {
  if (platform === "threads") {
    const long = await exchangeLongLivedThreads(clientSecret, shortLivedToken, fetchImpl, nowMs);
    if (!long.ok) return { ok: false, error: long.error };
    // The Threads user id arrives with the authorisation response, not here, so
    // the caller keeps whatever normaliseTokenResponse() already found.
    return { ok: true, accessToken: long.accessToken, expiresAt: long.expiresAt ?? null };
  }

  const long = await exchangeLongLivedUser(
    clientId, clientSecret, shortLivedToken, fetchImpl, nowMs,
  );
  if (!long.ok) return { ok: false, error: long.error };

  // Read against the USER token: permissions belong to the person's grant, not
  // to the page. Failure here is not fatal — an empty list simply leaves the
  // account reported as connected-without-publishing, which is a state the
  // system already handles and shows on the connection screen.
  const grantedScopes = await listGrantedPermissions(long.accessToken!, fetchImpl);

  const list = await listManagedPages(long.accessToken!, fetchImpl);
  if (!list.ok) return { ok: false, error: list.error };

  const choice = selectPage(list.pages!, handle);
  if (!choice.ok) return { ok: false, error: choice.error };
  const page = choice.page!;

  if (platform === "facebook") {
    return {
      ok: true,
      accessToken: page.accessToken,
      externalAccountId: page.id,
      // Deliberately null. See UpgradedGrant.expiresAt.
      expiresAt: null,
      handle: page.username ?? page.name,
      grantedScopes,
    };
  }

  const instagram = await instagramAccountForPage(page.id, page.accessToken, fetchImpl);
  if (!instagram.ok) return { ok: false, error: instagram.error };

  return {
    ok: true,
    // The PAGE token, not an Instagram one. Instagram publishing is authorised
    // by the linked page and addressed by the Instagram account id; storing an
    // id here with no page token would leave a row that looks connected and
    // cannot post.
    accessToken: page.accessToken,
    externalAccountId: instagram.id,
    expiresAt: null,
    handle: instagram.username,
    grantedScopes,
  };
}
