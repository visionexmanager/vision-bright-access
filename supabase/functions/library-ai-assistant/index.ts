/**
 * library-ai-assistant — every one-shot structured-JSON AI capability for
 * the Reading Assistant (Phase 6.5 extended Phase 5's 10 modes to ~16;
 * Phase 8 adds reading-level styling, key-lessons, rewrite/expand/shorten,
 * and caching+history for translate/explain-paragraph).
 * "Suggest similar books" is deliberately NOT here — routed to real DB data
 * (fetchSimilarBooks) on the frontend, not an LLM call.
 *
 * Security (Phase 6.5): whole-book modes NO LONGER concatenate every
 * accessible chapter up to a flat character cutoff — that silently
 * truncated large books and violated the "never send the whole book to the
 * model" requirement. They now retrieve a handful of semantically relevant
 * chunks via retrieveChunks() (_shared/libraryRag.ts), which calls
 * match_library_chapter_chunks() through the CALLING USER's own JWT-scoped
 * client — that RPC re-checks is_free_preview/can_access_library_book_content
 * itself, so a non-purchaser's client can never retrieve chunks from a
 * paid book's non-preview chapters. Chapter-scoped modes still read one
 * chapter directly UNLESS it exceeds DIRECT_READ_CHAR_THRESHOLD (handles a
 * PDF import's single "Full text" mega-chapter), in which case they also
 * fall back to chunk retrieval, scoped to that one chapter.
 *
 * Auth: user-jwt required. Rate-limited (40/day) via check_ai_rate_limit —
 * previously silently absent, closing a real gap from Phase 5.
 *
 * Input: JSON {
 *   mode, book_id?, chapter_id?, text?, question?, targetLanguage?,
 *   scope? ("page"|"chapter"|"book"), length? ("quick"|"medium"|"detailed"),
 *   image? (data URL, for image-description mode),
 *   readingMode? (Phase 8 — beginner/student/professional/child/
 *   simple_language/academic, defaults to "student")
 * }
 * Returns: JSON { ok, mode, result }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { structuredCompletion, ProviderError } from "../_shared/aiProvider.ts";
import { ensureBookIndexed, retrieveChunks, formatChunksAsContext, citationsFromChunks, DIRECT_READ_CHAR_THRESHOLD } from "../_shared/libraryRag.ts";

const MAX_DIRECT_CHARS = DIRECT_READ_CHAR_THRESHOLD;

type AiReadingMode = "beginner" | "student" | "professional" | "child" | "simple_language" | "academic";

/** Phase 8 — appended to every mode's system prompt so the model's
 *  vocabulary/tone/depth matches the reader's chosen level, without any
 *  per-mode special-casing. */
const MODE_STYLE_INSTRUCTIONS: Record<AiReadingMode, string> = {
  beginner: "Use very simple vocabulary and short sentences, as if explaining to someone completely new to this subject.",
  student: "Use clear, moderately detailed language suitable for a student studying this material.",
  professional: "Use precise, efficient, professional language suitable for an expert audience — avoid over-explaining basics.",
  child: "Use very simple words, short sentences, and a warm, friendly tone suitable for a child aged 8-12. Avoid any mature or frightening content.",
  simple_language: "Use the simplest possible words and very short sentences, avoiding jargon entirely — suitable for a non-native speaker or someone who finds reading difficult.",
  academic: "Use formal, precise academic language and terminology appropriate for scholarly analysis.",
};

function resolveReadingMode(value: string | undefined): AiReadingMode {
  return value && value in MODE_STYLE_INSTRUCTIONS ? (value as AiReadingMode) : "student";
}

/** Phase 8 — sha-256 of normalized cache-key parts, for
 *  library_ai_content_cache dedup (translate-paragraph/explain-paragraph). */
async function hashCacheKey(parts: string[]): Promise<string> {
  const data = new TextEncoder().encode(parts.join("|"));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

interface RequestBody {
  mode: string;
  book_id?: string;
  chapter_id?: string;
  text?: string;
  question?: string;
  targetLanguage?: string;
  scope?: "page" | "chapter" | "book";
  length?: "quick" | "medium" | "detailed";
  image?: string;
  /** explain-paragraph only — selects which transformation to apply to the
   *  selected text (Explain Selection's quick-action list). Defaults to
   *  "explain" when omitted, matching the mode's original behavior. */
  instruction?: "explain" | "simplify" | "rephrase" | "example" | "extract-ideas" | "rewrite" | "expand" | "shorten";
  /** Phase 8 — reading-level style applied to every mode's system prompt. */
  readingMode?: string;
}

const EXPLAIN_INSTRUCTIONS: Record<string, string> = {
  explain: "Explain this passage clearly and simply",
  simplify: "Rewrite this passage using simpler words and shorter sentences, preserving its meaning",
  rephrase: "Rephrase this passage in different words, preserving its meaning",
  example: "Give one concrete, illustrative example related to this passage",
  "extract-ideas": "Extract the key ideas from this passage as a short bulleted list within the explanation field",
  rewrite: "Rewrite this passage in fresh wording and a different sentence structure, preserving its full meaning",
  expand: "Expand this passage with more supporting detail and context, staying faithful to its meaning",
  shorten: "Shorten this passage to its essential meaning, as concisely as possible",
};

// Modes that retrieve content from a book via RAG (whole-book scope unless chapter_id given).
const BOOK_RAG_MODES = new Set(["summarize-book", "key-ideas", "key-lessons", "flashcards", "quiz", "mind-map", "answer-question", "timeline", "character-explorer", "concepts-explorer"]);
// Modes scoped to exactly one chapter, read directly unless too long.
const CHAPTER_MODES = new Set(["summarize-chapter"]);
// Modes given raw text directly in the request body.
const TEXT_MODES = new Set(["explain-paragraph", "explain-word", "translate-paragraph"]);
// Modes with bespoke handling (not a plain content-mode).
const SPECIAL_MODES = new Set(["smart-summary", "image-description", "reading-coach-tips"]);

/** Synthetic retrieval queries for whole-book modes that don't have a
 *  natural user-supplied question — picks the chunks most representative
 *  of what that mode needs. */
const SYNTHETIC_QUERIES: Record<string, string> = {
  "summarize-book": "the book's main themes, arguments, and overall content",
  "key-ideas": "the most important ideas and arguments in this book",
  "key-lessons": "the book's practical lessons, takeaways, and advice for the reader",
  "flashcards": "key facts, definitions, and concepts worth studying",
  "quiz": "important facts, concepts, and ideas that test comprehension",
  "mind-map": "the book's overall structure, themes, and main topics",
  "timeline": "chronological events, dates, and the sequence of what happens",
  "character-explorer": "characters, their relationships, and how they develop",
  "concepts-explorer": "key concepts, terms, definitions, and theories",
};

const MODE_SCHEMAS: Record<string, { schema: Record<string, unknown>; toolName: string; system: string }> = {
  "summarize-book": {
    toolName: "summarize_book",
    system: "You summarize books faithfully for a reading app, using ONLY the provided excerpts, without adding information not present in them. Respond in the same language as the excerpts unless told otherwise.",
    schema: { type: "object", properties: { summary: { type: "string", description: "A clear 4-8 sentence summary." } }, required: ["summary"], additionalProperties: false },
  },
  "summarize-chapter": {
    toolName: "summarize_chapter",
    system: "You summarize book chapters faithfully, without adding information not present in the text. Respond in the same language as the text unless told otherwise.",
    schema: { type: "object", properties: { summary: { type: "string", description: "A clear 3-5 sentence summary of this chapter." } }, required: ["summary"], additionalProperties: false },
  },
  "key-ideas": {
    toolName: "extract_key_ideas",
    system: "You extract the most important ideas from a book's excerpts, faithfully, without inventing content not present. Respond in the same language as the excerpts unless told otherwise.",
    schema: { type: "object", properties: { key_ideas: { type: "array", items: { type: "string" }, maxItems: 8, description: "The most important ideas, one per entry." } }, required: ["key_ideas"], additionalProperties: false },
  },
  "key-lessons": {
    toolName: "extract_key_lessons",
    system: "You extract practical, actionable lessons and takeaways a reader can apply from a book's excerpts, faithfully, without inventing content not present — frame each as advice or a takeaway, not just a restated idea. Respond in the same language as the excerpts unless told otherwise.",
    schema: { type: "object", properties: { lessons: { type: "array", items: { type: "string" }, maxItems: 8, description: "Practical, actionable lessons/takeaways, one per entry." } }, required: ["lessons"], additionalProperties: false },
  },
  "flashcards": {
    toolName: "generate_flashcards",
    system: "You generate study flashcards (front/back pairs) from a book's excerpts, faithfully, testing genuine comprehension of the material. Respond in the same language as the excerpts unless told otherwise.",
    schema: {
      type: "object",
      properties: {
        flashcards: {
          type: "array", maxItems: 10,
          items: { type: "object", properties: { front: { type: "string" }, back: { type: "string" } }, required: ["front", "back"], additionalProperties: false },
        },
      },
      required: ["flashcards"], additionalProperties: false,
    },
  },
  "quiz": {
    toolName: "generate_quiz",
    system: "You generate a quiz from a book's excerpts, testing genuine comprehension, using a mix of question types when the material supports it: multiple-choice (4 options, one correct), true/false, fill-in-the-blank, and short-answer. For non-multiple-choice questions, leave options empty and provide the expected answer in explanation prefixed with 'Answer: '. Respond in the same language as the excerpts unless told otherwise.",
    schema: {
      type: "object",
      properties: {
        questions: {
          type: "array", maxItems: 8,
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["multiple-choice", "true-false", "fill-blank", "short-answer"] },
              question: { type: "string" },
              options: { type: "array", items: { type: "string" }, maxItems: 4, description: "4 options for multiple-choice, [\"True\",\"False\"] for true-false, empty otherwise" },
              correct_index: { type: "number", description: "0-based index into options for multiple-choice/true-false, -1 otherwise" },
              expected_answer: { type: "string", description: "expected answer text for fill-blank/short-answer, empty otherwise" },
              explanation: { type: "string" },
            },
            required: ["type", "question", "options", "correct_index", "expected_answer", "explanation"], additionalProperties: false,
          },
        },
      },
      required: ["questions"], additionalProperties: false,
    },
  },
  "mind-map": {
    toolName: "generate_mind_map",
    system: "You produce a 2-level mind map (central topic, main branches, and sub-points under each branch) summarizing a book's structure and ideas, faithfully, from the given excerpts. Respond in the same language as the excerpts unless told otherwise.",
    schema: {
      type: "object",
      properties: {
        central_topic: { type: "string" },
        branches: {
          type: "array", maxItems: 6,
          items: { type: "object", properties: { topic: { type: "string" }, subtopics: { type: "array", items: { type: "string" }, maxItems: 4 } }, required: ["topic", "subtopics"], additionalProperties: false },
        },
      },
      required: ["central_topic", "branches"], additionalProperties: false,
    },
  },
  "answer-question": {
    toolName: "answer_question",
    system: "You answer a reader's question about a book using ONLY the provided excerpts, evidence-based. If the excerpts don't contain the answer, say so honestly instead of inventing one. If the excerpts support more than one reasonable reading, describe the alternative interpretation in alternative_interpretation; otherwise leave it as an empty string. Suggest up to 3 natural follow-up questions the reader might ask next. Respond in the same language as the reader's question unless told otherwise.",
    schema: {
      type: "object",
      properties: {
        answer: { type: "string" },
        alternative_interpretation: { type: "string" },
        follow_up_questions: { type: "array", maxItems: 3, items: { type: "string" } },
      },
      required: ["answer", "alternative_interpretation", "follow_up_questions"],
      additionalProperties: false,
    },
  },
  "explain-paragraph": {
    toolName: "explain_paragraph",
    system: "You explain a passage from a book clearly and simply, for a reader who found it unclear. Respond in the same language as the passage unless told otherwise.",
    schema: { type: "object", properties: { explanation: { type: "string" } }, required: ["explanation"], additionalProperties: false },
  },
  "explain-word": {
    toolName: "explain_word",
    system: "You define a word or short phrase as used in its given context, plainly, with one example sentence, plus synonyms and antonyms as commonly used (empty arrays if none apply). Respond in the same language as the word/context unless told otherwise.",
    schema: {
      type: "object",
      properties: {
        definition: { type: "string" },
        example_usage: { type: "string" },
        synonyms: { type: "array", items: { type: "string" }, maxItems: 6 },
        antonyms: { type: "array", items: { type: "string" }, maxItems: 6 },
      },
      required: ["definition", "example_usage", "synonyms", "antonyms"], additionalProperties: false,
    },
  },
  "translate-paragraph": {
    toolName: "translate_paragraph",
    system: "You translate a passage faithfully, preserving tone, meaning, and formatting (paragraph breaks, lists) as much as possible, into the requested target language.",
    schema: { type: "object", properties: { translated_text: { type: "string" } }, required: ["translated_text"], additionalProperties: false },
  },
  "timeline": {
    toolName: "generate_timeline",
    system: "You extract a chronological timeline of events from a book's excerpts, ONLY if the book has a genuine chronological/historical/narrative sequence of events. If the excerpts show no meaningful timeline (e.g. a cookbook, reference manual, or purely conceptual text), set applicable to false and return an empty events array — never invent a timeline. Respond in the same language as the excerpts unless told otherwise.",
    schema: {
      type: "object",
      properties: {
        applicable: { type: "boolean" },
        events: {
          type: "array", maxItems: 15,
          items: {
            type: "object",
            properties: {
              order: { type: "number" },
              date_or_period: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
              chapter_reference: { type: "string" },
            },
            required: ["order", "date_or_period", "title", "description", "chapter_reference"], additionalProperties: false,
          },
        },
      },
      required: ["applicable", "events"], additionalProperties: false,
    },
  },
  "character-explorer": {
    toolName: "explore_characters",
    system: "You extract characters, their relationships, where they appear, and how they develop from a book's excerpts, ONLY if the book is a narrative/fiction work with characters. If not applicable (e.g. non-fiction with no characters), set applicable to false and return an empty characters array. Respond in the same language as the excerpts unless told otherwise.",
    schema: {
      type: "object",
      properties: {
        applicable: { type: "boolean" },
        characters: {
          type: "array", maxItems: 12,
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              relationships: {
                type: "array", maxItems: 6,
                items: { type: "object", properties: { with: { type: "string" }, type: { type: "string" } }, required: ["with", "type"], additionalProperties: false },
              },
              appears_in: { type: "array", items: { type: "string" }, maxItems: 8 },
              development: { type: "string" },
            },
            required: ["name", "description", "relationships", "appears_in", "development"], additionalProperties: false,
          },
        },
      },
      required: ["applicable", "characters"], additionalProperties: false,
    },
  },
  "concepts-explorer": {
    toolName: "explore_concepts",
    system: "You extract key concepts, terms, definitions, and theories discussed in a book's excerpts, faithfully — only what's actually present, never invented. Respond in the same language as the excerpts unless told otherwise.",
    schema: {
      type: "object",
      properties: {
        concepts: {
          type: "array", maxItems: 15,
          items: {
            type: "object",
            properties: { term: { type: "string" }, definition: { type: "string" }, category: { type: "string" } },
            required: ["term", "definition", "category"], additionalProperties: false,
          },
        },
      },
      required: ["concepts"], additionalProperties: false,
    },
  },
  "smart-summary": {
    toolName: "smart_summary",
    system: "You write a summary of the given book excerpts at the requested length, using ONLY information present in them. Respond in the same language as the excerpts unless told otherwise.",
    schema: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"], additionalProperties: false },
  },
  "image-description": {
    toolName: "describe_image",
    system: "You describe images from a book for a blind or low-vision reader using a screen reader — be thorough and concrete. If the image is a diagram, chart, table, or mathematical equation, ALSO provide a simplified plain-language explanation of its structure/meaning in simplified_explanation, phrased so it reads naturally aloud without needing to see the image.",
    schema: {
      type: "object",
      properties: {
        description: { type: "string" },
        image_type: { type: "string", description: "e.g. photo, diagram, chart, table, equation, illustration" },
        simplified_explanation: { type: "string", description: "empty string if not a diagram/chart/table/equation" },
      },
      required: ["description", "image_type", "simplified_explanation"], additionalProperties: false,
    },
  },
  "reading-coach-tips": {
    toolName: "reading_coach_tips",
    system: "You are a reading coach. Given a reader's pace statistics for a book, offer 2-4 short, concrete, encouraging suggestions to help them read more consistently or comprehend better. Do not fabricate statistics beyond what's given.",
    schema: { type: "object", properties: { tips: { type: "array", items: { type: "string" }, maxItems: 4 } }, required: ["tips"], additionalProperties: false },
  },
};

const LENGTH_INSTRUCTIONS: Record<string, string> = {
  quick: "in 1-2 sentences (about a 30-second read)",
  medium: "in one clear paragraph",
  detailed: "in several paragraphs, covering the key points thoroughly",
};

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401, cors);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  // Deliberately no service-role client for CONTENT ACCESS — retrieval goes
  // through the calling user's own RLS/access-checked session, see header
  // note. A service-role client is used ONLY for rate-limit logging and for
  // ensureBookIndexed's writes (chunking never returns content to the
  // caller, so it can't leak anything even though it bypasses RLS).
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401, cors);

  const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: allowed } = await serviceClient.rpc("check_ai_rate_limit", { _user_id: user.id, _function_name: "library-ai-assistant" });
  if (allowed === false) return json({ error: "Daily limit reached (40 requests/day). Try again tomorrow." }, 429, cors);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }

  if (body.mode === "smart-summary") return handleSmartSummary(body, user.id, userClient, serviceClient, cors);
  if (body.mode === "image-description") return handleImageDescription(body, cors);
  if (body.mode === "reading-coach-tips") return handleReadingCoachTips(body, userClient, cors);

  const modeConfig = MODE_SCHEMAS[body.mode];
  if (!modeConfig) return json({ error: `Unsupported mode "${body.mode}"` }, 400, cors);

  try {
    let userText: string;
    let answerCitations: ReturnType<typeof citationsFromChunks> | null = null;

    if (BOOK_RAG_MODES.has(body.mode)) {
      if (!body.book_id) return json({ error: "book_id is required for this mode" }, 400, cors);

      const query = body.mode === "answer-question" ? (body.question ?? "") : SYNTHETIC_QUERIES[body.mode];
      if (body.mode === "answer-question" && !query.trim()) return json({ error: "question is required for answer-question" }, 400, cors);

      await ensureBookIndexed(serviceClient, body.book_id);
      const chunks = await retrieveChunks(userClient, body.book_id, query, { matchCount: 10, chapterId: body.chapter_id });
      if (chunks.length === 0) return json({ error: "No accessible content found for this book" }, 404, cors);

      userText = formatChunksAsContext(chunks);
      if (body.mode === "answer-question") {
        userText = `QUESTION: ${body.question}\n\nEXCERPTS:\n${userText}`;
        answerCitations = citationsFromChunks(chunks);
      }
    } else if (CHAPTER_MODES.has(body.mode)) {
      if (!body.chapter_id) return json({ error: "chapter_id is required for this mode" }, 400, cors);

      const { data: chapter, error: chapterErr } = await userClient
        .from("library_chapters").select("id, book_id, title, content_text").eq("id", body.chapter_id).maybeSingle();
      if (chapterErr) throw chapterErr;
      if (!chapter) return json({ error: "No accessible chapter content found" }, 404, cors);

      const text = chapter.content_text ?? "";
      if (text.length > 0 && text.length <= MAX_DIRECT_CHARS) {
        userText = chapter.title ? `## ${chapter.title}\n${text}` : text;
      } else if (text.length > MAX_DIRECT_CHARS) {
        // Very long single chapter (e.g. a PDF import's one "Full text" row)
        // — retrieve relevant chunks scoped to just this chapter instead of
        // sending the whole blob.
        await ensureBookIndexed(serviceClient, chapter.book_id);
        const chunks = await retrieveChunks(userClient, chapter.book_id, SYNTHETIC_QUERIES["summarize-book"], { matchCount: 10, chapterId: chapter.id });
        if (chunks.length === 0) return json({ error: "No accessible content found for this chapter" }, 404, cors);
        userText = formatChunksAsContext(chunks);
      } else {
        return json({ error: "No accessible chapter content found" }, 404, cors);
      }
    } else if (TEXT_MODES.has(body.mode)) {
      if (!body.text?.trim()) return json({ error: "text is required for this mode" }, 400, cors);
      userText = body.text.length > MAX_DIRECT_CHARS ? body.text.slice(0, MAX_DIRECT_CHARS) : body.text;
      if (body.mode === "translate-paragraph") {
        if (!body.targetLanguage) return json({ error: "targetLanguage is required for translate-paragraph" }, 400, cors);
        userText = `Translate the following into ${body.targetLanguage}:\n\n${userText}`;
      } else if (body.mode === "explain-paragraph") {
        const instruction = EXPLAIN_INSTRUCTIONS[body.instruction ?? "explain"] ?? EXPLAIN_INSTRUCTIONS.explain;
        userText = `${instruction}:\n\n${userText}`;
      }
    } else {
      return json({ error: `Unsupported mode "${body.mode}"` }, 400, cors);
    }

    const readingMode = resolveReadingMode(body.readingMode);
    const isCacheableTextMode = body.mode === "translate-paragraph" || body.mode === "explain-paragraph";

    // Phase 8 — translate-paragraph/explain-paragraph are deterministic
    // functions of (action, params, reading mode, input text), so check the
    // global content cache before spending a model call.
    let cacheHash: string | null = null;
    if (isCacheableTextMode) {
      cacheHash = await hashCacheKey([
        body.mode,
        body.mode === "translate-paragraph" ? (body.targetLanguage ?? "") : (body.instruction ?? "explain"),
        readingMode,
        userText,
      ]);
      const { data: cached } = await userClient
        .from("library_ai_content_cache")
        .select("result_text")
        .eq("content_hash", cacheHash)
        .maybeSingle();
      if (cached) {
        const cachedResult = body.mode === "translate-paragraph" ? { translated_text: cached.result_text } : { explanation: cached.result_text };
        await logAiActivity(userClient, user.id, body, cachedResult);
        return json({ ok: true, mode: body.mode, result: cachedResult }, 200, cors);
      }
    }

    const result = await structuredCompletion({
      provider: "openai",
      model: "gpt-4o-mini",
      system: `${modeConfig.system} ${MODE_STYLE_INSTRUCTIONS[readingMode]}`,
      userText,
      schema: modeConfig.schema,
      toolName: modeConfig.toolName,
      maxTokens: 2000,
    }) as Record<string, unknown>;

    if (isCacheableTextMode && cacheHash) {
      const resultText = body.mode === "translate-paragraph" ? (result.translated_text as string) : (result.explanation as string);
      try {
        await serviceClient.from("library_ai_content_cache").upsert(
          { content_hash: cacheHash, action: body.mode === "translate-paragraph" ? "translate" : (body.instruction ?? "explain"), result_text: resultText },
          { onConflict: "content_hash" }
        );
      } catch (cacheErr) {
        console.error("library-ai-assistant: content cache write failed:", cacheErr);
      }
    }
    if (isCacheableTextMode) await logAiActivity(userClient, user.id, body, result);

    const finalResult = answerCitations ? { ...result, citations: answerCitations } : result;
    return json({ ok: true, mode: body.mode, result: finalResult }, 200, cors);
  } catch (err) {
    return json({ error: errorMessage(err) }, 500, cors);
  }
});

/** Phase 8 — per-user history entry for translate-paragraph/explain-paragraph
 *  (summary logging happens separately inside handleSmartSummary). Requires
 *  a book_id, which the frontend now always sends for these two modes even
 *  when operating on an ad-hoc text selection rather than whole-book/chapter
 *  content — see HighlightSelectionPopover/TranslateTab. Silently no-ops if
 *  absent rather than failing the request over a missing history entry. */
// deno-lint-ignore no-explicit-any
async function logAiActivity(userClient: any, userId: string, body: RequestBody, result: Record<string, unknown>): Promise<void> {
  if (!body.book_id) return;
  try {
    const activityType = body.mode === "translate-paragraph" ? "translation" : "explain_selection";
    const resultText = body.mode === "translate-paragraph" ? String(result.translated_text ?? "") : String(result.explanation ?? "");
    await userClient.from("library_ai_activity_log").insert({
      user_id: userId,
      book_id: body.book_id,
      activity_type: activityType,
      title: body.mode === "translate-paragraph" ? `Translated to ${body.targetLanguage ?? ""}` : `Explained selection (${body.instruction ?? "explain"})`,
      snippet: resultText.slice(0, 140),
      metadata: body.mode === "translate-paragraph" ? { targetLanguage: body.targetLanguage } : { action: body.instruction ?? "explain" },
    });
  } catch (err) {
    console.error("library-ai-assistant: activity log write failed:", err);
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof ProviderError) return err.status === 429 ? "Rate limit exceeded. Please try again shortly." : err.message;
  const msg = err instanceof Error ? err.message : String(err);
  console.error("library-ai-assistant error:", msg);
  return msg;
}

/** Fire-and-forget per-user history entry for a generated/recalled summary —
 *  library_ai_summaries itself has no user_id (it's a shared cache), so a
 *  personal "my summaries" history needs this separate log. */
// deno-lint-ignore no-explicit-any
async function logSummaryActivity(userClient: any, userId: string, bookId: string, scope: string, length: string, summary: string): Promise<void> {
  try {
    await userClient.from("library_ai_activity_log").insert({
      user_id: userId,
      book_id: bookId,
      activity_type: "summary",
      title: `${length} summary (${scope})`,
      snippet: summary.slice(0, 140),
      metadata: { scope, length },
    });
  } catch (err) {
    console.error("library-ai-assistant: summary activity log write failed:", err);
  }
}

// deno-lint-ignore no-explicit-any
async function handleSmartSummary(body: RequestBody, userId: string, userClient: any, serviceClient: any, cors: Record<string, string>): Promise<Response> {
  if (!body.book_id) return json({ error: "book_id is required" }, 400, cors);
  const scope = body.scope ?? "book";
  const length = body.length ?? "medium";
  if (scope !== "book" && !body.chapter_id) return json({ error: "chapter_id is required for page/chapter scope" }, 400, cors);

  try {
    // Cache/memory check first — satisfies both "remembers past summaries"
    // and "cache repeated summaries" with one lookup.
    let cacheQuery = userClient
      .from("library_ai_summaries")
      .select("content")
      .eq("book_id", body.book_id)
      .eq("scope", scope)
      .eq("length", length);
    cacheQuery = scope === "book" ? cacheQuery.is("chapter_id", null) : cacheQuery.eq("chapter_id", body.chapter_id);
    const { data: cached } = await cacheQuery.maybeSingle();
    if (cached) {
      await logSummaryActivity(userClient, userId, body.book_id, scope, length, cached.content);
      return json({ ok: true, mode: "smart-summary", result: { summary: cached.content, cached: true } }, 200, cors);
    }

    let userText: string;
    if (scope === "book") {
      await ensureBookIndexed(serviceClient, body.book_id);
      const chunks = await retrieveChunks(userClient, body.book_id, SYNTHETIC_QUERIES["summarize-book"], { matchCount: 10 });
      if (chunks.length === 0) return json({ error: "No accessible content found for this book" }, 404, cors);
      userText = formatChunksAsContext(chunks);
    } else {
      // "page" scope has no page-level content store — approximated by the
      // containing chapter, documented scope simplification.
      const { data: chapter, error: chapterErr } = await userClient
        .from("library_chapters").select("id, book_id, title, content_text").eq("id", body.chapter_id).maybeSingle();
      if (chapterErr) throw chapterErr;
      if (!chapter) return json({ error: "No accessible chapter content found" }, 404, cors);
      const text = chapter.content_text ?? "";
      if (text.length > MAX_DIRECT_CHARS) {
        await ensureBookIndexed(serviceClient, chapter.book_id);
        const chunks = await retrieveChunks(userClient, chapter.book_id, SYNTHETIC_QUERIES["summarize-book"], { matchCount: 8, chapterId: chapter.id });
        if (chunks.length === 0) return json({ error: "No accessible content found for this chapter" }, 404, cors);
        userText = formatChunksAsContext(chunks);
      } else {
        if (!text) return json({ error: "No accessible chapter content found" }, 404, cors);
        userText = chapter.title ? `## ${chapter.title}\n${text}` : text;
      }
    }

    const readingMode = resolveReadingMode(body.readingMode);
    const lengthInstruction = LENGTH_INSTRUCTIONS[length] ?? LENGTH_INSTRUCTIONS.medium;
    const result = (await structuredCompletion({
      provider: "openai",
      model: "gpt-4o-mini",
      system: `${MODE_SCHEMAS["smart-summary"].system} ${MODE_STYLE_INSTRUCTIONS[readingMode]}`,
      userText: `Summarize the following ${lengthInstruction}:\n\n${userText}`,
      schema: MODE_SCHEMAS["smart-summary"].schema,
      toolName: MODE_SCHEMAS["smart-summary"].toolName,
      maxTokens: length === "detailed" ? 1500 : 500,
    })) as { summary: string };

    await serviceClient.from("library_ai_summaries").upsert(
      { book_id: body.book_id, chapter_id: scope === "book" ? null : body.chapter_id, scope, length, content: result.summary },
      { onConflict: "book_id,chapter_id,scope,length" }
    );
    await logSummaryActivity(userClient, userId, body.book_id, scope, length, result.summary);

    return json({ ok: true, mode: "smart-summary", result: { ...result, cached: false } }, 200, cors);
  } catch (err) {
    return json({ error: errorMessage(err) }, 500, cors);
  }
}

async function handleImageDescription(body: RequestBody, cors: Record<string, string>): Promise<Response> {
  if (!body.image) return json({ error: "image is required for image-description" }, 400, cors);
  try {
    const result = await structuredCompletion({
      provider: "openai",
      model: "gpt-4o-mini",
      system: MODE_SCHEMAS["image-description"].system,
      userText: "Describe this image from a book for a blind or low-vision reader.",
      image: body.image,
      schema: MODE_SCHEMAS["image-description"].schema,
      toolName: MODE_SCHEMAS["image-description"].toolName,
      maxTokens: 800,
    });
    return json({ ok: true, mode: "image-description", result }, 200, cors);
  } catch (err) {
    return json({ error: errorMessage(err) }, 500, cors);
  }
}

// deno-lint-ignore no-explicit-any
async function handleReadingCoachTips(body: RequestBody, userClient: any, cors: Record<string, string>): Promise<Response> {
  if (!body.book_id) return json({ error: "book_id is required" }, 400, cors);
  try {
    const { data: statsRows, error: statsErr } = await userClient.rpc("get_library_reading_coach_stats", { _book_id: body.book_id });
    if (statsErr) throw statsErr;
    const stats = (statsRows ?? [])[0];
    if (!stats) return json({ ok: true, mode: "reading-coach-tips", result: { tips: [] } }, 200, cors);

    const statsText = `Pages read: ${stats.current_page ?? "unknown"} of ${stats.total_pages ?? "unknown"}. Pace: ${stats.pages_per_day ?? "unknown"} pages/day. Estimated days to finish: ${stats.estimated_days_left ?? "unknown"}.`;

    const result = await structuredCompletion({
      provider: "openai",
      model: "gpt-4o-mini",
      system: MODE_SCHEMAS["reading-coach-tips"].system,
      userText: statsText,
      schema: MODE_SCHEMAS["reading-coach-tips"].schema,
      toolName: MODE_SCHEMAS["reading-coach-tips"].toolName,
      maxTokens: 400,
    });
    return json({ ok: true, mode: "reading-coach-tips", result }, 200, cors);
  } catch (err) {
    return json({ error: errorMessage(err) }, 500, cors);
  }
}
