// Phase 9, step 3 — the OAuth provider registry and the sealed state.
//
// No secret is written here. Every provider names the environment variables its
// credentials live in and reads them at call time; a provider whose variables
// are unset answers `configured: false` and the flow refuses before a single
// byte leaves the function. That is the whole point of the shape: this file is
// complete today, and the platforms switch on when the secrets are added, with
// no code change.
//
// What is deliberately NOT here: any token, any client id, any client secret,
// any account row, any hardcoded redirect for a specific Visionex account.

/** The platforms with an external identity, matching social_accounts_platform_check. */
export type Platform =
  | "facebook" | "instagram" | "threads" | "tiktok" | "youtube" | "x" | "linkedin";

export interface ProviderConfig {
  readonly platform: Platform;
  /** Human name for logs and the connection screen. Never a credential. */
  readonly label: string;
  readonly authorizeUrl: string;
  readonly tokenUrl: string;
  /**
   * The scopes Visionex asks for. What it actually GETS is read back from the
   * token response and stored — the two differ whenever an app review is
   * incomplete, and that difference is the most useful thing the connection
   * screen can show.
   */
  readonly scopes: readonly string[];
  /**
   * The one scope that means "this grant can post". Recorded separately from
   * the list above because the callback checks the GRANTED scopes for it: a
   * connection that came back without this scope is authenticated and unable to
   * publish, which is the exact state an incomplete app review produces.
   */
  readonly publishScope: string;
  /** How this provider joins its scope list. Google uses spaces; Meta uses commas. */
  readonly scopeSeparator: string;
  readonly clientIdEnv: string;
  readonly clientSecretEnv: string;
  /** TikTok names its public identifier `client_key`, not `client_id`. */
  readonly clientIdParam: string;
  /** X mandates PKCE; the others accept it or ignore it. */
  readonly usesPkce: boolean;
  /** Extra authorize-URL parameters this provider needs to return a refresh token. */
  readonly extraAuthorizeParams: Readonly<Record<string, string>>;
  /**
   * Set when Visionex cannot complete this connection yet for a reason outside
   * the code. Non-null means `start` refuses with this code, and the reason is
   * shown on the screen rather than being a silent failure later.
   */
  readonly blockedReason: string | null;
}

const META_TOKEN = "https://graph.facebook.com/v21.0/oauth/access_token";
const META_AUTHORIZE = "https://www.facebook.com/v21.0/dialog/oauth";

export const PROVIDERS: Readonly<Record<Platform, ProviderConfig>> = {
  // Facebook and Instagram are one Meta app with one credential pair. They stay
  // separate accounts because they are separate publishing identities with
  // different granted scopes, and merging them would make one review result
  // stand in for two.
  facebook: {
    platform: "facebook",
    label: "Facebook Page",
    authorizeUrl: META_AUTHORIZE,
    tokenUrl: META_TOKEN,
    scopes: ["pages_manage_posts", "pages_read_engagement", "business_management"],
    scopeSeparator: ",",
    publishScope: "pages_manage_posts",
    clientIdEnv: "META_APP_ID",
    clientSecretEnv: "META_APP_SECRET",
    clientIdParam: "client_id",
    usesPkce: false,
    extraAuthorizeParams: {},
    blockedReason: null,
  },
  instagram: {
    platform: "instagram",
    label: "Instagram Business",
    authorizeUrl: META_AUTHORIZE,
    tokenUrl: META_TOKEN,
    scopes: [
      "instagram_basic",
      "instagram_content_publish",
      "pages_show_list",
      "business_management",
    ],
    scopeSeparator: ",",
    publishScope: "instagram_content_publish",
    clientIdEnv: "META_APP_ID",
    clientSecretEnv: "META_APP_SECRET",
    clientIdParam: "client_id",
    usesPkce: false,
    extraAuthorizeParams: {},
    blockedReason: null,
  },
  // Threads is a separate app inside Meta with its own credentials and its own
  // host — reusing META_APP_ID here would fail at the authorize step with an
  // error that reads like a scope problem.
  threads: {
    platform: "threads",
    label: "Threads",
    authorizeUrl: "https://threads.net/oauth/authorize",
    tokenUrl: "https://graph.threads.net/oauth/access_token",
    scopes: ["threads_basic", "threads_content_publish"],
    scopeSeparator: ",",
    publishScope: "threads_content_publish",
    clientIdEnv: "THREADS_APP_ID",
    clientSecretEnv: "THREADS_APP_SECRET",
    clientIdParam: "client_id",
    usesPkce: false,
    extraAuthorizeParams: {},
    blockedReason: null,
  },
  tiktok: {
    platform: "tiktok",
    label: "TikTok",
    authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    scopes: ["user.info.basic", "video.publish", "video.upload"],
    scopeSeparator: ",",
    publishScope: "video.publish",
    clientIdEnv: "TIKTOK_CLIENT_KEY",
    clientSecretEnv: "TIKTOK_CLIENT_SECRET",
    // Not `client_id`. TikTok rejects the standard name outright.
    clientIdParam: "client_key",
    usesPkce: true,
    extraAuthorizeParams: {},
    blockedReason: null,
  },
  youtube: {
    platform: "youtube",
    label: "YouTube",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
    ],
    scopeSeparator: " ",
    publishScope: "https://www.googleapis.com/auth/youtube.upload",
    clientIdEnv: "GOOGLE_OAUTH_CLIENT_ID",
    clientSecretEnv: "GOOGLE_OAUTH_CLIENT_SECRET",
    clientIdParam: "client_id",
    usesPkce: false,
    // Google returns a refresh token only on a consent screen the user actually
    // saw, and only when asked for offline access. Without both, the connection
    // works until the first expiry and then silently dies.
    extraAuthorizeParams: { access_type: "offline", prompt: "consent" },
    blockedReason: null,
  },
  x: {
    platform: "x",
    label: "X",
    authorizeUrl: "https://x.com/i/oauth2/authorize",
    tokenUrl: "https://api.x.com/2/oauth2/token",
    // offline.access is what makes the grant survive the first expiry.
    scopes: ["tweet.write", "tweet.read", "users.read", "offline.access"],
    scopeSeparator: " ",
    publishScope: "tweet.write",
    clientIdEnv: "X_CLIENT_ID",
    clientSecretEnv: "X_CLIENT_SECRET",
    clientIdParam: "client_id",
    // Mandatory here, not optional.
    usesPkce: true,
    extraAuthorizeParams: {},
    blockedReason: null,
  },
  linkedin: {
    platform: "linkedin",
    label: "LinkedIn",
    authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: ["w_organization_social", "r_organization_social"],
    scopeSeparator: " ",
    publishScope: "w_organization_social",
    clientIdEnv: "LINKEDIN_CLIENT_ID",
    clientSecretEnv: "LINKEDIN_CLIENT_SECRET",
    clientIdParam: "client_id",
    usesPkce: false,
    extraAuthorizeParams: {},
    // The Visionex World LLC company page does not exist yet, and an
    // organization grant cannot be issued against a page that is not there.
    // Connecting before it exists would store a member token that looks like a
    // connection and cannot post as the organization. Clear this string once
    // the page is live; nothing else about this entry changes.
    blockedReason: "linkedin_company_page_missing",
  },
};

export const PLATFORMS = Object.keys(PROVIDERS) as Platform[];

export function isPlatform(value: unknown): value is Platform {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(PROVIDERS, value);
}

// ── Credentials, read at call time ───────────────────────────────────────────

export interface ProviderCredentials {
  readonly configured: boolean;
  readonly clientId?: string;
  readonly clientSecret?: string;
  /** Which variables are unset — the actionable half of "not configured". */
  readonly missing: string[];
}

export function readCredentials(
  provider: ProviderConfig,
  env: (name: string) => string | undefined,
): ProviderCredentials {
  const clientId = env(provider.clientIdEnv);
  const clientSecret = env(provider.clientSecretEnv);
  const missing: string[] = [];
  if (!clientId) missing.push(provider.clientIdEnv);
  if (!clientSecret) missing.push(provider.clientSecretEnv);
  if (missing.length > 0) return { configured: false, missing };
  return { configured: true, clientId, clientSecret, missing };
}

// ── PKCE ─────────────────────────────────────────────────────────────────────

const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/")
    .padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function randomToken(bytes = 32): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
  return base64Url(new Uint8Array(digest));
}

// ── The sealed state ─────────────────────────────────────────────────────────
//
// The `state` parameter travels to the platform and back through the operator's
// browser, so it is encrypted rather than merely signed. AES-GCM gives integrity
// as well, which is what a signature would have given, plus confidentiality —
// and confidentiality is required rather than nice to have, because the PKCE
// verifier rides inside it. A signed-but-readable state would put the verifier
// in a URL, in browser history and in the platform's referrer logs, which is
// precisely the exposure PKCE exists to prevent.
//
// Keeping the verifier in the state is what lets this flow work without a
// server-side session table. The cost is honest and worth stating: the state is
// not single-use, so a replayed callback within the TTL would re-run the code
// exchange. That is harmless in practice — an authorization code is single-use
// at every provider here, so the second exchange fails at the platform, not at
// Visionex — and the TTL below keeps the window short.

const STATE_TTL_SECONDS = 600;

export interface StatePayload {
  /** Which social_accounts row this grant will be stored on. */
  accountId: string;
  platform: Platform;
  /** The admin who started the flow. The callback carries no session of its own. */
  userId: string;
  /** Issued-at, seconds. */
  iat: number;
  nonce: string;
  /** PKCE verifier, for the providers that use it. */
  verifier?: string;
  /** Where to send the browser once the exchange is done. */
  returnTo?: string;
}

async function stateKey(secret: string): Promise<CryptoKey> {
  // The secret is a passphrase, not 32 raw bytes, so it is hashed to length
  // rather than being required to be exactly the right size.
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function sealState(payload: StatePayload, secret: string): Promise<string> {
  const key = await stateKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(JSON.stringify(payload)),
    ),
  );
  const packed = new Uint8Array(iv.length + cipher.length);
  packed.set(iv, 0);
  packed.set(cipher, iv.length);
  return base64Url(packed);
}

export interface OpenedState {
  readonly ok: boolean;
  readonly payload?: StatePayload;
  readonly error?: string;
}

export async function openState(
  sealed: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<OpenedState> {
  let payload: StatePayload;
  try {
    const packed = fromBase64Url(sealed);
    if (packed.length <= 12) return { ok: false, error: "state_malformed" };
    const key = await stateKey(secret);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: packed.slice(0, 12) },
      key,
      packed.slice(12),
    );
    payload = JSON.parse(new TextDecoder().decode(plain));
  } catch {
    // A wrong key, a truncated blob and a forged one are indistinguishable here
    // on purpose: the caller learns only that it did not open.
    return { ok: false, error: "state_invalid" };
  }

  if (!payload || !isPlatform(payload.platform) || !payload.accountId || !payload.userId) {
    return { ok: false, error: "state_incomplete" };
  }
  if (typeof payload.iat !== "number" || nowSeconds - payload.iat > STATE_TTL_SECONDS) {
    return { ok: false, error: "state_expired" };
  }
  // A clock that ran backwards is a rejected flow, not an accepted one.
  if (payload.iat - nowSeconds > 60) return { ok: false, error: "state_invalid" };

  return { ok: true, payload };
}

// ── Authorize URL ────────────────────────────────────────────────────────────

export function authorizeUrl(
  provider: ProviderConfig,
  clientId: string,
  redirectUri: string,
  state: string,
  challenge?: string,
): string {
  const url = new URL(provider.authorizeUrl);
  url.searchParams.set(provider.clientIdParam, clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", provider.scopes.join(provider.scopeSeparator));
  url.searchParams.set("state", state);
  for (const [name, value] of Object.entries(provider.extraAuthorizeParams)) {
    url.searchParams.set(name, value);
  }
  if (provider.usesPkce && challenge) {
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
  }
  return url.toString();
}

// ── Token responses ──────────────────────────────────────────────────────────

export interface NormalisedToken {
  readonly ok: boolean;
  readonly accessToken?: string;
  readonly refreshToken?: string;
  readonly tokenType?: string;
  /** What the platform said it granted — not what was asked for. */
  readonly scopes?: string[];
  readonly expiresAt?: string;
  readonly refreshExpiresAt?: string;
  readonly externalUserId?: string;
  readonly error?: string;
}

/**
 * One shape out of six providers' several. TikTok nests its payload under
 * `data` on some endpoints and not others; Meta returns `expires_in` sometimes
 * and never for a long-lived page token; Google returns `scope` space-joined
 * while Meta omits it entirely.
 *
 * Scopes are read from the response when present and left EMPTY when absent.
 * Falling back to the requested scopes would be the single most misleading
 * thing this function could do: the connection screen would report the
 * permissions Visionex asked for as though the platform had granted them, and
 * an incomplete app review would look like a finished one.
 */
export function normaliseTokenResponse(raw: unknown, nowMs = Date.now()): NormalisedToken {
  if (!raw || typeof raw !== "object") return { ok: false, error: "token_response_unreadable" };

  const outer = raw as Record<string, unknown>;
  const inner = (outer.data && typeof outer.data === "object")
    ? outer.data as Record<string, unknown>
    : outer;

  const errorCode = inner.error ?? outer.error ?? inner.error_code ?? outer.error_code;
  if (errorCode !== undefined && errorCode !== null && errorCode !== "") {
    return { ok: false, error: "token_exchange_rejected" };
  }

  const accessToken = inner.access_token;
  if (typeof accessToken !== "string" || accessToken.trim() === "") {
    return { ok: false, error: "token_response_missing_access_token" };
  }

  const seconds = (value: unknown): string | undefined => {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n) || n <= 0) return undefined;
    return new Date(nowMs + n * 1000).toISOString();
  };

  const scopeField = inner.scope ?? outer.scope;
  const scopes = typeof scopeField === "string" && scopeField.trim() !== ""
    ? scopeField.split(/[\s,]+/).filter(Boolean)
    : Array.isArray(inner.scope)
      ? (inner.scope as unknown[]).filter((s): s is string => typeof s === "string")
      : [];

  const refreshToken = typeof inner.refresh_token === "string" && inner.refresh_token.trim() !== ""
    ? inner.refresh_token
    : undefined;

  const externalUserId = [inner.open_id, inner.user_id, inner.id]
    .find((value): value is string => typeof value === "string" && value.trim() !== "");

  return {
    ok: true,
    accessToken,
    refreshToken,
    tokenType: typeof inner.token_type === "string" ? inner.token_type : "bearer",
    scopes,
    expiresAt: seconds(inner.expires_in),
    refreshExpiresAt: seconds(inner.refresh_expires_in),
    externalUserId,
  };
}

/**
 * Provider errors quote the failing request, and the failing request carries the
 * client secret. Nothing derived from a token endpoint's body is ever returned
 * or logged — the caller gets one of the fixed codes above and the body is
 * dropped. This mirrors what redact_publication_error() does in SQL, by the
 * blunter method of never carrying the text at all.
 */
export const SAFE_ERROR_CODES = [
  "token_response_unreadable",
  "token_exchange_rejected",
  "token_response_missing_access_token",
  "state_malformed",
  "state_invalid",
  "state_incomplete",
  "state_expired",
] as const;
