// What a caller may hand to a paid provider, and what a provider failure may
// hand back to the caller (Phase 2F-3).
//
// Three findings from the Phase 2E audit, closed in one place so the functions
// that share them cannot drift apart:
//
//   • Unbounded input. Chat histories, prompt fields and base64 images went to
//     OpenAI at whatever size the caller chose. Every bound here is a ceiling
//     far above what the website sends, not a product limit.
//   • Caller-chosen URLs. `image_url.url` accepted any string, so a signed-in
//     user could make Visionex's OpenAI account fetch an address of their
//     choosing. The website only ever sends `data:` URLs, so that is all the
//     vision endpoints accept now.
//   • Provider text in user-facing errors. Vendor names, secret names and raw
//     provider messages reached non-admin callers. `publicMediaFailure` returns
//     one of a fixed set of sentences; the raw text goes to the function log.
//
// Pure — no imports, no Deno — so Vitest drives it directly.

/** OpenAI's own per-image ceiling; anything larger fails there anyway. */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const IMAGE_DATA_URL = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/;

export type ImageCheck =
  | { outcome: "ok"; dataUrl: string }
  | { outcome: "refused"; status: 400 | 413; error: string };

/**
 * Accept only an inline PNG, JPEG, WebP or GIF, at most `MAX_IMAGE_BYTES`
 * decoded. Never a URL: a URL here is fetched by the provider on Visionex's
 * account, from an address the caller picked.
 */
export function checkImageDataUrl(value: unknown): ImageCheck {
  if (typeof value !== "string" || value.length === 0) {
    return { outcome: "refused", status: 400, error: "An image is required." };
  }
  const match = IMAGE_DATA_URL.exec(value);
  if (!match) {
    return { outcome: "refused", status: 400, error: "Send a PNG, JPEG, WebP or GIF image." };
  }
  const b64 = match[2].replace(/\s/g, "");
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  const bytes = Math.floor((b64.length * 3) / 4) - padding;
  if (bytes > MAX_IMAGE_BYTES) {
    return { outcome: "refused", status: 413, error: "The image is too large. Please use one under 20 MB." };
  }
  return { outcome: "ok", dataUrl: value };
}

/**
 * Whether `value` is a public object the caller uploaded to `bucket` in this
 * project — `<SUPABASE_URL>/storage/v1/object/public/<bucket>/<userId>/…`,
 * which is exactly what the website's upload produces. Anything else would
 * have the provider fetch an address the caller chose, or another user's file.
 */
export function isOwnStorageUpload(
  value: unknown,
  supabaseUrl: string,
  bucket: string,
  userId: string,
): boolean {
  if (typeof value !== "string" || !supabaseUrl || !userId) return false;
  let url: URL;
  let base: URL;
  try {
    url = new URL(value.trim());
    base = new URL(supabaseUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.origin !== base.origin) return false;
  if (url.username || url.password || url.search || url.hash) return false;
  // `URL` has already resolved any `..` or `%2e%2e` segment, so a path that
  // climbs out of the caller's folder no longer starts with it.
  const prefix = `/storage/v1/object/public/${bucket}/${userId}/`;
  return url.pathname.startsWith(prefix) && url.pathname.length > prefix.length;
}

/** A string, trimmed and cut to `max` characters; anything else becomes "". */
export function boundedText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export const MAX_CHAT_MESSAGES = 40;
export const MAX_MESSAGE_CHARS = 8_000;
export const MAX_CHAT_TOTAL_CHARS = 60_000;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * The caller's conversation, reduced to what a conversation may contain.
 *
 * Only `user` and `assistant` turns survive — a caller-supplied `system` (or
 * `tool`, or `developer`) message would otherwise sit beside the server's own
 * system prompt with the same authority. Each turn is cut to
 * `MAX_MESSAGE_CHARS`, and the oldest turns are dropped until at most
 * `MAX_CHAT_MESSAGES` remain within `MAX_CHAT_TOTAL_CHARS`, so a long
 * conversation keeps working and simply forgets its beginning.
 */
export function boundedChatMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  const turns: ChatMessage[] = [];
  for (const item of value) {
    const role = (item as { role?: unknown } | null)?.role;
    const content = (item as { content?: unknown } | null)?.content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
    const text = content.slice(0, MAX_MESSAGE_CHARS);
    if (text.trim()) turns.push({ role, content: text });
  }
  const kept: ChatMessage[] = [];
  let total = 0;
  for (let i = turns.length - 1; i >= 0 && kept.length < MAX_CHAT_MESSAGES; i--) {
    total += turns[i].content.length;
    if (total > MAX_CHAT_TOTAL_CHARS) break;
    kept.unshift(turns[i]);
  }
  return kept;
}

const CONTENT_POLICY = /content[ _-]?polic|moderation|safety|nsfw|flagged/i;
const NOT_CONFIGURED = /not configured|API_KEY|API_TOKEN|no video provider/i;

/**
 * One of a fixed set of sentences for a failed image or video job. Never the
 * provider's text, a vendor name, a secret name or a status code: the raw
 * message is logged for the operator and nothing of it is returned. A
 * content-policy refusal is told apart because the fix is to change the
 * prompt rather than to retry.
 */
export function publicMediaFailure(raw: unknown, kind: "image" | "video", tag: string): string {
  const text = typeof raw === "string" ? raw : raw instanceof Error ? raw.message : "";
  console.error(`[${tag}] provider failure:`, text.slice(0, 300) || "(no detail)");
  if (CONTENT_POLICY.test(text)) {
    return "This request was declined by the content filter. Please change the prompt and try again.";
  }
  if (NOT_CONFIGURED.test(text)) {
    return `The ${kind} service is temporarily unavailable. Please try again later.`;
  }
  return `The ${kind} could not be created. Please try again later.`;
}
