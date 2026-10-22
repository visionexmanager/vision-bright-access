// A scanned PDF, shown to a vision model as pictures.
//
// A PDF with no text layer is photographs of pages. Handed over as a file, the
// provider rasterises it at a size of its own choosing; here Visionex's own
// processor renders the first pages at a fixed, legible size (`/pdf-pages`) and
// the caller shows them to the model at high detail, the way a photograph is.
//
// This only ever ADDS a way to read: when the processor is not configured, is
// busy, is a build without poppler, or returns nothing usable, the result is
// "not available" and the caller carries on exactly as it did before.

import { describeError } from "./whatsappSafety.ts";
import { imageBody, processorConfig, type ProcessorConfig } from "./whatsappProcessor.ts";

/** The processor's own limit (12 MB, the nginx body ceiling in front of it). */
export const MAX_PDF_PAGES_UPLOAD_BYTES = 12 * 1024 * 1024;
/** Pages asked for. The processor clamps to 6 as well. */
export const PDF_PAGES_REQUESTED = 4;
/** Render plus transfer; the processor's own ceiling is 45 s for the render. */
export const PDF_PAGES_TIMEOUT_MS = 55_000;

export type PdfPagesResult =
  | { ok: true; pages: string[]; totalPages: number | null }
  | { ok: false; reason: "not_configured" | "too_large" | "busy" | "timeout" | "unreadable" | "bad_response" | "error" };

const JPEG_BASE64_PREFIX = "/9j/"; // base64 of FF D8 FF
const MAX_PAGE_B64_CHARS = 1_300_000; // ~950 KB of JPEG, the processor's per-page ceiling plus slack
const MAX_PAGES_ACCEPTED = 6;

/**
 * The processor's answer, validated page by page. Nothing is trusted: these
 * strings become `data:` URLs inside a request to a paid provider.
 */
export function readPdfPagesPayload(payload: unknown): PdfPagesResult {
  if (!payload || typeof payload !== "object") return { ok: false, reason: "bad_response" };
  const body = payload as Record<string, unknown>;
  if (body.ok !== true) {
    const reason = typeof body.reason === "string" ? body.reason : "";
    if (reason === "timeout") return { ok: false, reason: "timeout" };
    if (reason === "too_large") return { ok: false, reason: "too_large" };
    return { ok: false, reason: "unreadable" };
  }
  if (!Array.isArray(body.pages)) return { ok: false, reason: "bad_response" };

  const pages: string[] = [];
  for (const entry of body.pages.slice(0, MAX_PAGES_ACCEPTED)) {
    const b64 = (entry as { jpeg_base64?: unknown } | null)?.jpeg_base64;
    if (typeof b64 !== "string" || !b64.startsWith(JPEG_BASE64_PREFIX) || b64.length > MAX_PAGE_B64_CHARS) continue;
    if (!/^[A-Za-z0-9+/]+=*$/.test(b64)) continue;
    pages.push(`data:image/jpeg;base64,${b64}`);
  }
  if (pages.length === 0) return { ok: false, reason: "unreadable" };

  const total = typeof body.total_pages === "number" && Number.isInteger(body.total_pages) && body.total_pages > 0
    ? body.total_pages
    : null;
  return { ok: true, pages, totalPages: total };
}

/** Render the first pages of `bytes` on the processor. `fetchImpl` and `config` are injected by the tests. */
export async function renderPdfPages(params: {
  bytes: Uint8Array;
  pages?: number;
  config?: ProcessorConfig | null;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<PdfPagesResult> {
  const config = params.config === undefined ? processorConfig() : params.config;
  if (!config) return { ok: false, reason: "not_configured" };
  if (params.bytes.byteLength > MAX_PDF_PAGES_UPLOAD_BYTES) return { ok: false, reason: "too_large" };

  const doFetch = params.fetchImpl ?? fetch;
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), params.timeoutMs ?? PDF_PAGES_TIMEOUT_MS);
  try {
    const query = new URLSearchParams({ pages: String(params.pages ?? PDF_PAGES_REQUESTED) });
    const response = await doFetch(`${config.url}/pdf-pages?${query}`, {
      method: "POST",
      headers: { authorization: `Bearer ${config.token}`, "content-type": "application/pdf" },
      body: imageBody(params.bytes),
      signal: controller.signal,
    });
    if (response.status === 503) return { ok: false, reason: "busy" };
    // 404 is a deployment rolled back to an image without this route; it reads as "not available".
    if (!response.ok) return { ok: false, reason: "error" };
    return readPdfPagesPayload(await response.json());
  } catch (e) {
    const description = describeError(e);
    if (description.includes("abort") || description.includes("Abort")) return { ok: false, reason: "timeout" };
    // A code, never the message: it can quote a URL and a token header.
    console.error("[whatsapp-pdf-pages] render failed:", description);
    return { ok: false, reason: "error" };
  } finally {
    clearTimeout(deadline);
  }
}
