// How the Edge Function reaches Visionex's own processing service.
//
// ── Why this is its own module ──────────────────────────────────────────────
//
// There is one service on the VPS, one URL and one token, and there are now two
// capabilities behind them: reading the words in a picture and decoding the
// barcodes in one. Those are separate features with separate failure modes, but
// they are not separate deployments — and the moment two modules each read
// `MEDIA_PROCESSOR_URL` and each decide for themselves what a valid one looks
// like, one of them will accept a URL the other refuses. Then the feature is
// half on, which is the worst of the three possible states.
//
// So the configuration is read and validated exactly once, here, and both
// clients are handed the result.
//
// This module is pure: no `Deno` at import time, no fetch, no provider. The
// Vitest suite runs under Node and imports it directly.

/**
 * The environment is probed rather than referenced.
 *
 * `Deno` is undefined under Vitest, and a bare `Deno.env.get` at module scope
 * would throw at import time and take the whole test file with it — the same
 * reason `meta.ts` does this. Passing an explicit reader also lets the tests
 * drive every configuration state without touching a real environment.
 */
export type EnvReader = (name: string) => string | undefined;

export interface ProcessorConfig {
  url: string;
  token: string;
}

const denoEnv: EnvReader = (name) => {
  const deno = (globalThis as {
    Deno?: { env?: { get(key: string): string | undefined } };
  }).Deno;
  return deno?.env?.get(name);
};

/**
 * Configuration, or nothing at all.
 *
 * Returning null is a supported, quiet state — not an error. It is what every
 * deployment looks like until the secrets are set, and what a deployment that
 * wants local processing switched off looks like afterwards. Every caller
 * treats it the same way: use the provider that was being used before.
 *
 * Unsetting either variable is therefore the rollback for every capability
 * behind this service at once, and it takes effect on the next invocation with
 * no deploy and no revert.
 *
 * The URL must be HTTPS. The image is a photograph somebody sent privately, and
 * it is not going over a plaintext hop because a config value had a typo in the
 * scheme. A hostname is required for the same reason: an IP literal cannot be
 * checked against a certificate the way a name can.
 */
export function processorConfig(read: EnvReader = denoEnv): ProcessorConfig | null {
  const url = (read("MEDIA_PROCESSOR_URL") ?? "").trim();
  const token = (read("MEDIA_PROCESSOR_TOKEN") ?? "").trim();
  if (!url || !token) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  // Rejects `https://127.0.0.1/…` and `https://[::1]/…`: the Edge Function is
  // not on the box, so a loopback address here is always a misconfiguration,
  // and one that would otherwise fail slowly on every single photograph.
  if (!parsed.hostname || /^[\d.]+$/.test(parsed.hostname) || parsed.hostname.includes(":")) {
    return null;
  }

  return { url: parsed.toString().replace(/\/+$/, ""), token };
}

/** Whether the processing service is available at all. Read for telemetry. */
export const processorAvailable = (read: EnvReader = denoEnv): boolean => processorConfig(read) !== null;

/**
 * The upload ceiling, matching the service and the nginx `client_max_body_size`.
 *
 * Checked on this side as well so an oversized photograph is refused before it
 * is put on the wire, rather than after nginx has read eight megabytes of it
 * and closed the connection.
 */
export const MAX_PROCESSOR_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * The image bytes as a body this runtime will actually accept.
 *
 * An explicit `ArrayBuffer`, for two separate reasons.
 *
 * A `Uint8Array` is not assignable to `BodyInit` under the lib types CI
 * resolves — the npm and pnpm trees differ here and only the pnpm job sees it —
 * and declaring the buffer is the honest fix rather than a cast that silences
 * the checker without answering it.
 *
 * And it copies exactly this view's range. The bytes handed in are the output
 * of EXIF stripping; if that ever returns a subarray of the original, the
 * backing buffer still holds the metadata that was supposed to be gone. Sending
 * `.buffer` would send it. This cannot.
 */
export function imageBody(bytes: Uint8Array): ArrayBuffer {
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  return body;
}
