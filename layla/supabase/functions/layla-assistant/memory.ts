// Cross-session memory kept in Layla's own Supabase project (never Visionex).
// Only a SHA-256 hash of the Alexa user id and a short summary are stored.

const MAX_MEMORY_CHARS = 500;
const REST_TIMEOUT_MS = 1_500;

export function sanitizeMemory(value: string): string {
  return value
    // deno-lint-ignore no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_MEMORY_CHARS);
}

/** Splits the model reply into the spoken text and an optional new memory. */
export function splitMemory(
  reply: string,
): { speech: string; memory: string | null } {
  const closed = reply.match(/\[\[\s*ذاكرة\s*:([\s\S]*?)\]\]/);
  if (closed) {
    const speech = reply.replace(closed[0], "").trim();
    const memory = sanitizeMemory(closed[1]);
    return { speech, memory: memory || null };
  }
  // An unclosed marker (reply cut off) is dropped and never spoken.
  const open = reply.search(/\[\[\s*ذاكرة/);
  if (open >= 0) return { speech: reply.slice(0, open).trim(), memory: null };
  return { speech: reply.trim(), memory: null };
}

const FORGET_PATTERN =
  /(انسي|إنسي|امسحي|امسح|احذفي|احذف)\s+(كل\s*(شي|شيء|ما)|الذاكرة|كلشي|ذاكرتك|كل\s*اللي)/;

export function isForgetRequest(text: string): boolean {
  return FORGET_PATTERN.test(text);
}

export async function hashUser(userId: string): Promise<string> {
  const bytes = new TextEncoder().encode(`layla:${userId}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function restConfig(): { url: string; key: string } | null {
  const url = Deno.env.get("SUPABASE_URL")?.trim();
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  return url && key ? { url, key } : null;
}

function headers(key: string, extra: Record<string, string> = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export async function loadMemory(userHash: string): Promise<string> {
  const config = restConfig();
  if (!config) return "";
  try {
    const response = await fetch(
      `${config.url}/rest/v1/layla_memory?user_hash=eq.${userHash}&select=summary`,
      {
        headers: headers(config.key),
        signal: AbortSignal.timeout(REST_TIMEOUT_MS),
      },
    );
    if (!response.ok) return "";
    const rows = await response.json();
    return typeof rows?.[0]?.summary === "string"
      ? sanitizeMemory(rows[0].summary)
      : "";
  } catch {
    return "";
  }
}

export async function saveMemory(
  userHash: string,
  summary: string,
): Promise<void> {
  const config = restConfig();
  if (!config) return;
  try {
    await fetch(`${config.url}/rest/v1/layla_memory?on_conflict=user_hash`, {
      method: "POST",
      headers: headers(config.key, {
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify({
        user_hash: userHash,
        summary: sanitizeMemory(summary),
        updated_at: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(REST_TIMEOUT_MS * 2),
    });
  } catch (error) {
    console.error(
      "Layla memory save failed:",
      error instanceof Error ? error.name : "unknown",
    );
  }
}

export async function deleteMemory(userHash: string): Promise<void> {
  const config = restConfig();
  if (!config) return;
  try {
    await fetch(
      `${config.url}/rest/v1/layla_memory?user_hash=eq.${userHash}`,
      {
        method: "DELETE",
        headers: headers(config.key, { Prefer: "return=minimal" }),
        signal: AbortSignal.timeout(REST_TIMEOUT_MS * 2),
      },
    );
  } catch (error) {
    console.error(
      "Layla memory delete failed:",
      error instanceof Error ? error.name : "unknown",
    );
  }
}
