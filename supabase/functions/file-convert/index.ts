/**
 * file-convert — the website's door to the local conversion service.
 *
 * ── Why a proxy and not a direct call ───────────────────────────────────────
 *
 * The processing service on the VPS is behind a bearer token, and a browser
 * cannot hold one: anything the page knows, every visitor knows. So the token
 * stays here, on the server side, and this function is the only thing on the
 * public internet that may spend the box's cores.
 *
 * That makes the interesting part of this file the gate rather than the
 * forwarding. A conversion is 90 s of four dedicated cores shared with the
 * website itself; an unauthenticated one is a free CPU-burning service for
 * whoever finds the URL.
 *
 * ── What it fixes ───────────────────────────────────────────────────────────
 *
 * `/services/file-studio` is linked from the navbar, the footer and the service
 * catalog, and its video, archive and most of its audio conversions have
 * answered "requires server processing. Available in Phase 12" since the day it
 * shipped. Phase 12 was never built. This is the server processing.
 *
 * ── What it deliberately does not do ────────────────────────────────────────
 *
 * No queue, no job row, no storage. This is a request the browser is waiting
 * on, and a browser waiting is not Meta redelivering — the reason the WhatsApp
 * path needed a queue does not apply here. The bytes go through and are kept
 * nowhere, which is the same choice the WhatsApp path makes for the same
 * reason: a converted file that rests on a server is a file that has to be
 * protected, expired and swept, and not keeping it is stronger than all three.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  convertMediaLocally,
  MAX_CONVERT_UPLOAD_BYTES,
  processorConfig,
} from "../_shared/whatsappProcessor.ts";

const json = (data: unknown, status: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

/**
 * The query, rebuilt from what the caller asked for.
 *
 * Not forwarded. A caller sends a target and a small set of named options, and
 * this constructs the query string from them — so a request cannot smuggle a
 * parameter the browser was never offered, whatever the service would have done
 * with it. The service holds the allowlist and refuses anything not on it; this
 * is the layer that decides what may even be attempted.
 */
const FORWARDED_OPTIONS = ["bitrate", "rate", "channels", "height", "fps", "quality", "volume"];
const FORWARDED_FLAGS = ["normalize", "mute"];

function buildQuery(body: Record<string, unknown>): string | null {
  const target = body.target;
  // A format name and nothing else. The service's own allowlist is the
  // authority on which names are real; this only decides the shape.
  if (typeof target !== "string" || !/^[a-z0-9]{2,5}$/.test(target)) return null;

  const params = new URLSearchParams({ to: target });
  for (const name of FORWARDED_OPTIONS) {
    const value = body[name];
    if (value === undefined || value === null) continue;
    if (typeof value !== "string" && typeof value !== "number") continue;
    params.set(name, String(value));
  }
  for (const name of FORWARDED_FLAGS) {
    if (body[name] === true) params.set(name, "1");
  }
  return params.toString();
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  // ── The gate ──────────────────────────────────────────────────────────────
  //
  // A real signed-in user, not an anon key. The same rule the voice endpoints
  // were moved to: a service that costs the box real work is not something to
  // leave open because it happens to be free of an API bill.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401, cors);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !anonKey) return json({ error: "Not configured" }, 503, cors);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401, cors);

  if (!processorConfig()) return json({ error: "Conversion is unavailable" }, 503, cors);

  // ── The request ───────────────────────────────────────────────────────────
  //
  // JSON with base64 rather than a multipart body, because that is what a
  // browser `fetch` composes without ceremony and this runtime parses without a
  // dependency. It costs a third in size on the way in, which is why the
  // ceiling below is checked against the decoded length rather than the
  // encoded one.
  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }

  const query = buildQuery(body);
  if (!query) return json({ error: "A target format is required" }, 400, cors);

  const encoded = body.file;
  if (typeof encoded !== "string" || !encoded) {
    return json({ error: "A file is required" }, 400, cors);
  }

  let bytes: Uint8Array;
  try {
    const binary = atob(encoded);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  } catch {
    return json({ error: "The file could not be read" }, 400, cors);
  }

  if (bytes.byteLength === 0) return json({ error: "The file is empty" }, 400, cors);
  if (bytes.byteLength > MAX_CONVERT_UPLOAD_BYTES) {
    return json({ error: "That file is too large to convert" }, 413, cors);
  }

  // ── The work ──────────────────────────────────────────────────────────────

  const result = await convertMediaLocally({ bytes, query });

  if (!result.ok || !result.bytes || !result.mime) {
    // The service's code, and nothing else. It is a label out of a fixed list —
    // `unsupported_target`, `timeout`, `busy` — so it can be shown to a caller
    // and turned into a sentence there, without any of it having come from the
    // file or from ffmpeg's own output.
    const code = result.code ?? "conversion_failed";
    const status = code === "busy" ? 503 : code === "timeout" ? 504 : 422;
    // A count and a label. Never the filename, never the bytes, never the user.
    console.error(`[file-convert] refused: ${code}`);
    return json({ error: "conversion_failed", code }, status, cors);
  }

  return new Response(result.bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      ...cors,
      "Content-Type": result.mime,
      "Content-Length": String(result.bytes.byteLength),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
