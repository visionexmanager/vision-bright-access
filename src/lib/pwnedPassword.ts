/**
 * Breached-password check against the HaveIBeenPwned range API.
 *
 * Supabase's own leaked-password protection is a Pro-plan feature (the
 * Management API answers 402 on the current plan), so this is the zero-cost
 * stand-in for the two places a user chooses a password.
 *
 * k-anonymity: only the first five hex characters of the SHA-1 digest leave the
 * browser; the password and the full hash never do. `Add-Padding` makes the
 * response size uninformative. The API needs no key.
 *
 * Fails open. If the service is unreachable, slow, or the browser has no
 * Web Crypto, the user is not blocked from signing up. This is a browser-side
 * guard: a direct call to the Auth API bypasses it, which only the server-side
 * setting can close.
 */

const RANGE_URL = "https://api.pwnedpasswords.com/range/";
const TIMEOUT_MS = 4000;

export async function sha1Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-1", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** True when the password appears in a known breach corpus. */
export async function isPasswordBreached(password: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (!password) return false;
  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetchImpl(`${RANGE_URL}${prefix}`, {
        headers: { "Add-Padding": "true" },
        signal: controller.signal,
      });
      if (!res.ok) return false;
      const body = await res.text();
      for (const line of body.split(/\r?\n/)) {
        const [candidate, count] = line.trim().split(":");
        if (candidate === suffix && Number(count) > 0) return true;
      }
      return false;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return false;
  }
}
