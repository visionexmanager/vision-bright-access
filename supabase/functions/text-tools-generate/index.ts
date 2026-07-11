/**
 * text-tools-generate — AI Media Studio Text Tools Studio endpoint
 * Covers: Code Generator, Writing Assistant, Resume Builder, Presentation Generator.
 * (Logo/Icon Generator reuse image-generate directly; QR Generator is client-side only.)
 *
 * Provider: OpenAI via the shared structuredCompletion() layer.
 * Auth: user-jwt required
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { structuredCompletion, ProviderError } from "../_shared/aiProvider.ts";

type Tool = "code" | "writing" | "resume" | "presentation";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// Freeform tools (code / writing) — a single text block.
const FREEFORM_SCHEMA = {
  type: "object",
  properties: {
    content:  { type: "string", description: "The generated content (code or prose), complete and ready to use." },
    language: { type: "string", description: "For code: the programming language used. For writing: the detected output language." },
    notes:    { type: "string", description: "Brief notes about the output — assumptions made, how to use it, or a short explanation. Empty string if not needed." },
  },
  required: ["content", "language", "notes"],
  additionalProperties: false,
} as const;

// Structured document tools (resume / presentation) — sectioned content
// generic enough to render either a resume or slide deck as a PDF client-side.
const DOCUMENT_SCHEMA = {
  type: "object",
  properties: {
    title:    { type: "string", description: "Document title (e.g. the person's name for a resume, or the deck title for a presentation)." },
    subtitle: { type: "string", description: "Optional subtitle (e.g. target role, or presentation tagline). Empty string if not applicable." },
    sections: {
      type: "array",
      description: "For a resume: sections like Summary, Experience, Education, Skills. For a presentation: one entry per slide.",
      items: {
        type: "object",
        properties: {
          heading: { type: "string", description: "Section heading or slide title." },
          bullets: { type: "array", items: { type: "string" }, description: "Bullet points / lines of content for this section or slide." },
        },
        required: ["heading", "bullets"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "subtitle", "sections"],
  additionalProperties: false,
} as const;

function buildSystem(tool: Tool, language: string): string {
  const base = `Respond entirely in ${language}. Be precise, practical, and avoid filler.`;
  switch (tool) {
    case "code":
      return `You are an expert software engineer generating production-quality code for the VisionEx platform's Code Generator tool. Write complete, correct, idiomatic code for the requested task. Include necessary imports. Keep explanations in "notes" brief. ${base}`;
    case "writing":
      return `You are a skilled writing assistant for the VisionEx platform. Produce polished, well-structured prose for the requested writing task (essay, email, article, etc.), matching the requested tone. ${base}`;
    case "resume":
      return `You are a professional resume writer for the VisionEx platform's Resume Builder. Given the user's background, produce a complete, well-organized resume: a Summary section, Experience, Education, and Skills sections at minimum, each with concrete, achievement-oriented bullet points. Do not invent specific employers or dates the user didn't provide — use reasonable placeholders like "[Company Name]" when details are missing. ${base}`;
    case "presentation":
      return `You are a presentation designer for the VisionEx platform's Presentation Generator. Given a topic, produce a slide-by-slide outline: one section per slide, each with a short slide title and 3-5 concise bullet points suitable for on-screen display (not paragraphs). Include a title slide and a closing slide. ${base}`;
  }
}

interface RequestBody {
  tool:        Tool;
  prompt:      string;
  language?:   string;
  project_id?: string;
  options?:    Record<string, unknown>;
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

  const { tool, prompt, language = "en", project_id, options = {} } = body;

  const VALID_TOOLS: Tool[] = ["code", "writing", "resume", "presentation"];
  if (!VALID_TOOLS.includes(tool)) {
    return json({ error: `Unsupported tool "${tool}". Use one of: ${VALID_TOOLS.join(", ")}` }, 400, cors);
  }
  if (!prompt?.trim()) return json({ error: "prompt is required" }, 400, cors);
  if (prompt.length > 8000) return json({ error: "Prompt exceeds 8000 character limit" }, 400, cors);

  const { data: jobRow, error: jobErr } = await serviceClient
    .from("ams_text_tool_jobs")
    .insert({
      user_id:    user.id,
      project_id: project_id ?? null,
      tool,
      prompt:     prompt.trim(),
      language,
      options,
      status:     "processing",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (jobErr || !jobRow) {
    const detail = jobErr?.message ?? "unknown reason";
    const msg = detail.includes("does not exist")
      ? "Database table 'ams_text_tool_jobs' not found. Run Supabase migrations to set up the AI Media Studio schema."
      : `Failed to create generation job: ${detail}`;
    return json({ error: msg, code: "DB_ERROR" }, 500, cors);
  }
  const jobId: string = jobRow.id;

  const isDocument = tool === "resume" || tool === "presentation";

  try {
    const result = await structuredCompletion({
      provider: "openai",
      model:    "gpt-4o-mini",
      system:   buildSystem(tool, language),
      userText: prompt.trim(),
      schema:   (isDocument ? DOCUMENT_SCHEMA : FREEFORM_SCHEMA) as unknown as Record<string, unknown>,
      toolName: isDocument ? "document_output" : "freeform_output",
      maxTokens: isDocument ? 3000 : 2500,
    });

    await serviceClient.from("ams_text_tool_jobs").update({
      status:       "completed",
      result_json:  result,
      result_text:  isDocument ? null : (result as { content?: string })?.content ?? null,
      completed_at: new Date().toISOString(),
    }).eq("id", jobId);

    return json({ ok: true, job_id: jobId, tool, result }, 200, cors);

  } catch (err) {
    const msg = err instanceof ProviderError
      ? (err.status === 429 ? "Rate limit exceeded. Please try again shortly." : err.message)
      : (err instanceof Error ? err.message : String(err));
    console.error("Text tool generation failed:", msg);

    await serviceClient.from("ams_text_tool_jobs").update({
      status:        "failed",
      error_message: msg,
      completed_at:  new Date().toISOString(),
    }).eq("id", jobId);

    return json({ error: msg, job_id: jobId }, 500, cors);
  }
});
