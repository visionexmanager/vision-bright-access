// Limits for callers without an account, and a log of what looks like abuse.
//
// Both are backed by 20261015000000 / 20261018000000:
//   check_ai_anon_rate_limit  a per-caller and a platform-wide daily ceiling
//   record_security_event     one row per kind, source, caller and hour, with
//                             a count — so a flood becomes a number, not rows
//
// A caller is an HMAC of the client address keyed with a server secret. The
// address itself is never stored or logged.
//
// Both fail open. A metering or logging fault must not take a public feature
// offline; the platform ceiling and the monitor exist for the case where that
// matters.

// deno-lint-ignore no-explicit-any
type ServiceClient = any;

/**
 * The client address as the platform reports it. Cloudflare's header is set by
 * the edge and cannot be supplied by the caller; x-forwarded-for can be
 * prefixed by one, which is why every limit also has a platform-wide ceiling.
 */
export function callerAddress(headers: Headers): string {
  const direct = headers.get("cf-connecting-ip") ?? headers.get("x-real-ip");
  if (direct?.trim()) return direct.trim();
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}

/** A keyed hash of an identifier. What is hashed is never stored. */
export async function callerHash(identifier: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(`ai-anon:${identifier}`));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hashKey(): string {
  const deno = (globalThis as { Deno?: { env?: { get(key: string): string | undefined } } }).Deno;
  return deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

/**
 * Whether this caller may make one more call to `functionName` today, and
 * records it. `identity` is a user id when there is one; otherwise the
 * address is used.
 */
export async function allowCaller(
  service: ServiceClient,
  req: Request,
  functionName: string,
  identity?: string | null,
): Promise<boolean> {
  try {
    const subject = identity ? `user:${identity}` : `ip:${callerAddress(req.headers)}`;
    const { data, error } = await service.rpc("check_ai_anon_rate_limit", {
      _caller_hash: await callerHash(subject, hashKey()),
      _function_name: functionName,
    });
    if (error) {
      console.error(`[${functionName}] caller limit check failed, allowing:`, error.message);
      return true;
    }
    return data !== false;
  } catch (e) {
    console.error(`[${functionName}] caller limit check threw, allowing:`, e instanceof Error ? e.message : String(e));
    return true;
  }
}

/**
 * Notes something that looks like abuse. Never pass message text, a phone
 * number, an address or a token in `detail` — counts and codes only.
 */
export async function recordSecurityEvent(
  service: ServiceClient,
  req: Request | null,
  kind: string,
  source: string,
  detail: Record<string, string | number | boolean> = {},
): Promise<void> {
  try {
    const subject = req ? await callerHash(`ip:${callerAddress(req.headers)}`, hashKey()) : null;
    const { error } = await service.rpc("record_security_event", {
      _kind: kind,
      _source: source,
      _subject_hash: subject,
      _detail: detail,
    });
    if (error) console.error(`[security] could not record ${kind}:`, error.message);
  } catch (e) {
    console.error(`[security] could not record ${kind}:`, e instanceof Error ? e.message : String(e));
  }
}
