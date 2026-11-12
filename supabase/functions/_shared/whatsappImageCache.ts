// Remembering the description of a photograph that has been described before.
//
// Only a plain "describe this": no caption, no armed mode, no report. Anything
// the sender asked is a different question and is never answered from here.
// The key is the SHA-256 of the metadata-stripped bytes plus the language; the
// answer is the model's own description, bounded like any model output. What the
// table holds is described in 20261111000100_image_description_cache.sql.
//
// Every failure is silent and means "not cached": a cache must never be the
// reason a picture goes undescribed.

import { describeError } from "./whatsappSafety.ts";

export interface CacheRpc {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
}

/** Whether this request is the plain one the cache may answer. */
export function isCacheableDescription(params: {
  caption: string | null | undefined;
  mode: string | null | undefined;
  explainReport: boolean;
  hasBarcodeContext: boolean;
}): boolean {
  return !(params.caption ?? "").trim() && !params.mode && !params.explainReport && !params.hasBarcodeContext;
}

/** Lower-case hex SHA-256 of the picture. Hashes the view itself, never a sliced buffer. */
export async function imageHash(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function readCachedDescription(db: CacheRpc, hash: string, lang: string): Promise<string | null> {
  try {
    const { data, error } = await db.rpc("image_description_cache_get", { _hash: hash, _lang: lang });
    if (error || typeof data !== "string" || !data.trim()) return null;
    return data;
  } catch (e) {
    console.error("[whatsapp-image-cache] read failed:", describeError(e));
    return null;
  }
}

export async function storeDescription(db: CacheRpc, hash: string, lang: string, answer: string): Promise<void> {
  try {
    await db.rpc("image_description_cache_put", { _hash: hash, _lang: lang, _answer: answer });
  } catch (e) {
    console.error("[whatsapp-image-cache] write failed:", describeError(e));
  }
}
