/**
 * library-ai-writing-assistant — every AI Writing Assistant capability for
 * the author-facing Publishing Studio (Phase 9). A separate function from
 * library-ai-assistant (the reader-facing Reading Assistant), not an
 * extension of it — authorization is fundamentally different here: every
 * mode requires the caller to be a library author (or, when a specific
 * book_id is given, that book's owner/collaborator/admin), never the
 * reader-side "has this person purchased the book" check.
 *
 * Unlike the Reading Assistant, no mode here does RAG retrieval over a
 * book's existing content — this assistant GENERATES new material from
 * author-supplied text/prompts (grammar-fix a passage, expand an outline,
 * invent chapter titles, etc.), so there's no book content to retrieve.
 * book_id is optional and purely an authorization scope: when given, the
 * caller must own/collaborate on that book; when omitted (e.g. brainstorming
 * before a book exists yet), the caller just needs to be a library author.
 *
 * Auth: user-jwt required. Rate-limited (40/day) via check_ai_rate_limit.
 * Input: JSON { mode, book_id?, text?, targetLanguage?, instruction?,
 *               prompt?, genre?, theme? }
 * Returns: JSON { ok, mode, result }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { structuredCompletion, ProviderError } from "../_shared/aiProvider.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

interface RequestBody {
  mode: string;
  book_id?: string;
  text?: string;
  targetLanguage?: string;
  instruction?: string;
  prompt?: string;
  genre?: string;
  theme?: string;
}

const MODE_SCHEMAS: Record<string, { schema: Record<string, unknown>; toolName: string; system: string; maxTokens: number }> = {
  "grammar-correction": {
    toolName: "correct_grammar",
    system: "You correct grammar, spelling, and punctuation in the given passage without changing its meaning, tone, or style. List each real change you made.",
    schema: {
      type: "object",
      properties: {
        corrected_text: { type: "string" },
        changes: {
          type: "array", maxItems: 20,
          items: { type: "object", properties: { original: { type: "string" }, corrected: { type: "string" }, reason: { type: "string" } }, required: ["original", "corrected", "reason"], additionalProperties: false },
        },
      },
      required: ["corrected_text", "changes"], additionalProperties: false,
    },
    maxTokens: 2000,
  },
  "rewrite": {
    toolName: "rewrite_text",
    system: "You rewrite the given passage in fresh wording and a different sentence structure, preserving its full meaning and tone.",
    schema: { type: "object", properties: { result_text: { type: "string" } }, required: ["result_text"], additionalProperties: false },
    maxTokens: 1500,
  },
  "expand": {
    toolName: "expand_text",
    system: "You expand the given passage with more supporting detail, description, or context, staying faithful to its meaning and style.",
    schema: { type: "object", properties: { result_text: { type: "string" } }, required: ["result_text"], additionalProperties: false },
    maxTokens: 2000,
  },
  "shorten": {
    toolName: "shorten_text",
    system: "You shorten the given passage to its essential meaning, as concisely as possible, preserving the author's voice.",
    schema: { type: "object", properties: { result_text: { type: "string" } }, required: ["result_text"], additionalProperties: false },
    maxTokens: 1000,
  },
  "translate": {
    toolName: "translate_text",
    system: "You translate the given passage faithfully, preserving tone, meaning, and formatting, into the requested target language.",
    schema: { type: "object", properties: { translated_text: { type: "string" } }, required: ["translated_text"], additionalProperties: false },
    maxTokens: 2000,
  },
  "generate-chapters": {
    toolName: "generate_chapter_outline",
    system: "You generate a chapter-by-chapter outline for a book from the author's premise/outline text, each with a short title and one-sentence summary. Faithful to the given premise — do not invent an unrelated plot.",
    schema: {
      type: "object",
      properties: {
        chapters: { type: "array", maxItems: 30, items: { type: "object", properties: { title: { type: "string" }, summary: { type: "string" } }, required: ["title", "summary"], additionalProperties: false } },
      },
      required: ["chapters"], additionalProperties: false,
    },
    maxTokens: 2000,
  },
  "generate-titles": {
    toolName: "generate_titles",
    system: "You generate compelling, marketable book title candidates from the author's description/premise. Varied in style (evocative, direct, question-based, etc.).",
    schema: { type: "object", properties: { titles: { type: "array", items: { type: "string" }, maxItems: 10 } }, required: ["titles"], additionalProperties: false },
    maxTokens: 500,
  },
  "generate-descriptions": {
    toolName: "generate_descriptions",
    system: "You write two book-jacket descriptions from the author's premise/notes: a short one (1-2 sentences, for cards/previews) and a long one (a full back-cover-style blurb, 2-3 paragraphs). Marketable but honest to the given material.",
    schema: { type: "object", properties: { short_description: { type: "string" }, long_description: { type: "string" } }, required: ["short_description", "long_description"], additionalProperties: false },
    maxTokens: 800,
  },
  "generate-keywords": {
    toolName: "generate_keywords",
    system: "You generate SEO/discovery keywords and tags for a book from its description, the kind a reader would actually search for.",
    schema: { type: "object", properties: { keywords: { type: "array", items: { type: "string" }, maxItems: 15 } }, required: ["keywords"], additionalProperties: false },
    maxTokens: 400,
  },
  "generate-cover-ideas": {
    toolName: "generate_cover_ideas",
    system: "You generate cover-art concept prompts (suitable to hand to an image generator) for a book from its title/description/genre, each with a short rationale for why it fits. Describe visual composition, mood, and style concretely — never generate or reference an actual image yourself.",
    schema: {
      type: "object",
      properties: { prompts: { type: "array", maxItems: 5, items: { type: "object", properties: { prompt: { type: "string" }, rationale: { type: "string" } }, required: ["prompt", "rationale"], additionalProperties: false } } },
      required: ["prompts"], additionalProperties: false,
    },
    maxTokens: 800,
  },
  "writing-style-suggestions": {
    toolName: "suggest_writing_style",
    system: "You give concrete, actionable feedback on the given passage's writing style (pacing, voice, sentence variety, word choice) — specific observations, not generic advice.",
    schema: { type: "object", properties: { suggestions: { type: "array", items: { type: "string" }, maxItems: 8 } }, required: ["suggestions"], additionalProperties: false },
    maxTokens: 1000,
  },
  "character-builder": {
    toolName: "build_characters",
    system: "You invent well-rounded fictional characters from the author's prompt (genre/premise/existing characters), each with a name, story role, description, and a few defining personality traits.",
    schema: {
      type: "object",
      properties: {
        characters: {
          type: "array", maxItems: 8,
          items: { type: "object", properties: { name: { type: "string" }, role: { type: "string" }, description: { type: "string" }, traits: { type: "array", items: { type: "string" }, maxItems: 6 } }, required: ["name", "role", "description", "traits"], additionalProperties: false },
        },
      },
      required: ["characters"], additionalProperties: false,
    },
    maxTokens: 1200,
  },
  "story-ideas": {
    toolName: "generate_story_ideas",
    system: "You generate original story/book concept ideas for the given genre and optional theme, each with a title and a one-sentence logline.",
    schema: {
      type: "object",
      properties: { ideas: { type: "array", maxItems: 8, items: { type: "object", properties: { title: { type: "string" }, logline: { type: "string" } }, required: ["title", "logline"], additionalProperties: false } } },
      required: ["ideas"], additionalProperties: false,
    },
    maxTokens: 800,
  },
  "academic-assistant": {
    toolName: "academic_assistant",
    system: "You are an academic writing assistant. Answer the author's scholarly question or help with their academic text precisely, noting any caveats or areas needing a citation in notes.",
    schema: { type: "object", properties: { answer: { type: "string" }, notes: { type: "string" } }, required: ["answer", "notes"], additionalProperties: false },
    maxTokens: 1200,
  },
  "citation-suggestions": {
    toolName: "suggest_citations",
    system: "Given a source description (title/author/URL/quoted text), produce correctly formatted citations in both APA and MLA style. If information is missing, use standard placeholders (e.g. 'n.d.') rather than inventing facts.",
    schema: {
      type: "object",
      properties: { citations: { type: "array", maxItems: 4, items: { type: "object", properties: { style: { type: "string", enum: ["APA", "MLA"] }, text: { type: "string" } }, required: ["style", "text"], additionalProperties: false } } },
      required: ["citations"], additionalProperties: false,
    },
    maxTokens: 500,
  },
};

function buildUserText(body: RequestBody): string {
  switch (body.mode) {
    case "translate":
      return `Translate the following into ${body.targetLanguage}:\n\n${body.text ?? ""}`;
    case "generate-chapters":
    case "generate-titles":
    case "generate-descriptions":
    case "generate-keywords":
      return body.prompt ?? body.text ?? "";
    case "generate-cover-ideas":
      return body.prompt ?? "";
    case "character-builder":
      return body.prompt ?? "";
    case "story-ideas":
      return [body.genre ? `Genre: ${body.genre}` : "", body.theme ? `Theme: ${body.theme}` : "", body.prompt ?? ""].filter(Boolean).join("\n");
    case "academic-assistant":
    case "citation-suggestions":
      return body.text ?? body.prompt ?? "";
    default:
      return body.text ?? "";
  }
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401, cors);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401, cors);

  const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: allowed } = await serviceClient.rpc("check_ai_rate_limit", { _user_id: user.id, _function_name: "library-ai-writing-assistant" });
  if (allowed === false) return json({ error: "Daily limit reached (40 requests/day). Try again tomorrow." }, 429, cors);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }

  const modeConfig = MODE_SCHEMAS[body.mode];
  if (!modeConfig) return json({ error: `Unsupported mode "${body.mode}"` }, 400, cors);

  // Authorization: scoped to a specific book if given, otherwise just
  // "is this account a library author at all" (coarse cost-control gate —
  // this is an author tool, not a public text-generation endpoint).
  if (body.book_id) {
    const { data: canEdit } = await userClient.rpc("can_edit_library_book", { _book_id: body.book_id });
    const { data: isCollaborator } = await userClient.rpc("is_library_book_collaborator", { _book_id: body.book_id, _roles: null });
    if (!canEdit && !isCollaborator) return json({ error: "You don't have access to this book" }, 403, cors);
  } else {
    const { data: authorRow } = await userClient.from("library_authors").select("id").eq("user_id", user.id).maybeSingle();
    if (!authorRow) return json({ error: "An author profile is required to use the writing assistant" }, 403, cors);
  }

  try {
    const userText = buildUserText(body);
    if (!userText.trim()) return json({ error: "Some input text is required for this mode" }, 400, cors);
    if (body.mode === "translate" && !body.targetLanguage) return json({ error: "targetLanguage is required for translate" }, 400, cors);

    const result = await structuredCompletion({
      provider: "openai",
      model: "gpt-4o-mini",
      system: modeConfig.system,
      userText,
      schema: modeConfig.schema,
      toolName: modeConfig.toolName,
      maxTokens: modeConfig.maxTokens,
    });

    return json({ ok: true, mode: body.mode, result }, 200, cors);
  } catch (err) {
    return json({ error: errorMessage(err) }, 500, cors);
  }
});

function errorMessage(err: unknown): string {
  if (err instanceof ProviderError) return err.status === 429 ? "Rate limit exceeded. Please try again shortly." : err.message;
  const msg = err instanceof Error ? err.message : String(err);
  console.error("library-ai-writing-assistant error:", msg);
  return msg;
}
