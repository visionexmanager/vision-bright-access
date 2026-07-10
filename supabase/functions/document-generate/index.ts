/**
 * document-generate — AI Media Studio Document Studio endpoint
 * (PDF AI Assistant / Document Analyzer — OCR itself is handled by the
 * existing ocr-scan function and called directly from the frontend.)
 *
 * Provider: OpenAI / Anthropic via the shared structuredCompletion() layer.
 * Auth: user-jwt required
 * Input: JSON { mode: "analyze" | "summarize", input_text, filename?, language?, project_id? }
 * Returns: JSON { ok, job_id, result }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { structuredCompletion, ProviderError } from "../_shared/aiProvider.ts";

const MAX_CHARS = 60_000; // roughly the safe input budget for a single completion

const RESULT_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "A concise 2-4 sentence summary of the document." },
    key_points: {
      type: "array",
      description: "The most important points, facts, or sections from the document.",
      items: { type: "string" },
    },
    action_items: {
      type: "array",
      description: "Concrete next steps or action items implied by the document, if any. Empty array if none.",
      items: { type: "string" },
    },
    entities: {
      type: "array",
      description: "Notable named entities mentioned (people, organizations, dates, amounts).",
      items: { type: "string" },
    },
    word_count: { type: "number", description: "Approximate word count of the source text." },
  },
  required: ["summary", "key_points", "action_items", "entities", "word_count"],
  additionalProperties: false,
} as const;

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

interface RequestBody {
  mode:        "analyze" | "summarize";
  input_text:  string;
  filename?:   string;
  language?:   string;
  project_id?: string;
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401, cors);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient    = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const serviceClient = createClient(supabaseUrl, serviceKey);

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401, cors);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }

  const { mode, input_text, filename, language = "en", project_id } = body;

  if (mode !== "analyze" && mode !== "summarize") {
    return json({ error: `Unsupported mode "${mode}". Use "analyze" or "summarize".` }, 400, cors);
  }
  if (!input_text?.trim()) return json({ error: "input_text is required" }, 400, cors);
  const text = input_text.length > MAX_CHARS ? input_text.slice(0, MAX_CHARS) : input_text;

  const { data: jobRow, error: jobErr } = await serviceClient
    .from("ams_document_jobs")
    .insert({
      user_id:        user.id,
      project_id:     project_id ?? null,
      mode,
      input_filename: filename ?? null,
      input_text:     text,
      language,
      status:         "processing",
      started_at:     new Date().toISOString(),
    })
    .select("id")
    .single();

  if (jobErr || !jobRow) {
    const detail = jobErr?.message ?? "unknown reason";
    const msg = detail.includes("does not exist")
      ? "Database table 'ams_document_jobs' not found. Run Supabase migrations to set up the AI Media Studio schema."
      : `Failed to create document job: ${detail}`;
    return json({ error: msg, code: "DB_ERROR" }, 500, cors);
  }
  const jobId: string = jobRow.id;

  try {
    const system = mode === "summarize"
      ? `You are a precise document summarizer for the VisionEx platform, used by blind and low-vision users, so be clear and unambiguous. Summarize the document faithfully without adding information that isn't present. Respond entirely in ${language}.`
      : `You are a document analyst for the VisionEx platform. Extract key points, action items, and entities from the document precisely and faithfully — do not invent information not present in the text. Respond entirely in ${language}.`;

    const result = await structuredCompletion({
      provider: "openai",
      model:    "gpt-4o-mini",
      system,
      userText: text,
      schema:   RESULT_SCHEMA as unknown as Record<string, unknown>,
      toolName: "document_analysis",
      maxTokens: 1500,
    });

    await serviceClient.from("ams_document_jobs").update({
      status:       "completed",
      result_json:  result,
      result_text:  (result as { summary?: string })?.summary ?? null,
      completed_at: new Date().toISOString(),
    }).eq("id", jobId);

    return json({ ok: true, job_id: jobId, result }, 200, cors);

  } catch (err) {
    const msg = err instanceof ProviderError
      ? (err.status === 429 ? "Rate limit exceeded. Please try again shortly." : err.message)
      : (err instanceof Error ? err.message : String(err));
    console.error("Document analysis failed:", msg);

    await serviceClient.from("ams_document_jobs").update({
      status:        "failed",
      error_message: msg,
      completed_at:  new Date().toISOString(),
    }).eq("id", jobId);

    return json({ error: msg, job_id: jobId }, 500, cors);
  }
});
