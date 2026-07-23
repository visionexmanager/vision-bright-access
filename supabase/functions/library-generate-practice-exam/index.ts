/**
 * library-generate-practice-exam — Learning Hub quizzes. Generates a
 * structured, persisted, multi-question-type quiz (library_quizzes +
 * library_quiz_questions) grounded in a book/chapter's real content, with
 * per-question topic tags (for weak-area analytics) and difficulty tags
 * (for adaptive-difficulty ordering client-side). Distinct from the
 * lightweight ephemeral "quiz" mode on library-ai-assistant, which returns
 * an unsaved batch with no matching/essay support and no topic tagging.
 *
 * Correct answers are written straight to the DB and never returned to the
 * caller here — taking the exam goes through get_library_quiz_for_attempt(),
 * grading through submit_library_quiz_attempt(), both of which withhold
 * correct_answer/explanation until after submission.
 *
 * Auth: user-jwt required, caller must be able to access the book's content.
 * Input: JSON {
 *   book_id, chapter_id?, title?, question_count? (default 8, max 15),
 *   is_timed? (default true), time_limit_minutes? (default 20),
 *   passing_score_percent? (default 70)
 * }
 * Returns: JSON { ok, quiz_id, question_count }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { structuredCompletion, ProviderError } from "../_shared/aiProvider.ts";
import { ensureBookIndexed, retrieveChunks, formatChunksAsContext } from "../_shared/libraryRag.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

interface RequestBody {
  book_id: string;
  chapter_id?: string;
  title?: string;
  question_count?: number;
  is_timed?: boolean;
  time_limit_minutes?: number;
  passing_score_percent?: number;
}

const EXAM_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      maxItems: 15,
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["multiple_choice", "true_false", "short_answer", "matching", "fill_blank", "essay"] },
          question_text: { type: "string" },
          options: { type: "array", items: { type: "string" }, maxItems: 4 },
          matching_pairs: {
            type: "array", maxItems: 5,
            items: { type: "object", properties: { left: { type: "string" }, right: { type: "string" } }, required: ["left", "right"], additionalProperties: false },
          },
          correct_index: { type: "number" },
          correct_bool: { type: "boolean" },
          correct_text: { type: "string" },
          topic: { type: "string" },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
          explanation: { type: "string" },
        },
        required: ["type", "question_text", "options", "matching_pairs", "correct_index", "correct_bool", "correct_text", "topic", "difficulty", "explanation"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

interface AiQuestion {
  type: string; question_text: string; options: string[];
  matching_pairs: { left: string; right: string }[];
  correct_index: number; correct_bool: boolean; correct_text: string;
  topic: string; difficulty: string; explanation: string;
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
  const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401, cors);

  const { data: allowed } = await serviceClient.rpc("check_ai_rate_limit", { _user_id: user.id, _function_name: "library-generate-practice-exam" });
  if (allowed === false) return json({ error: "Daily limit reached. Try again tomorrow." }, 429, cors);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }
  if (!body.book_id) return json({ error: "book_id is required" }, 400, cors);
  const questionCount = Math.min(Math.max(body.question_count ?? 8, 3), 15);

  const { data: canAccess } = await userClient.rpc("can_access_library_book_content", { _book_id: body.book_id });
  if (!canAccess) return json({ error: "You don't have access to this book" }, 403, cors);

  try {
    const { data: book, error: bookErr } = await userClient
      .from("library_books").select("title").eq("id", body.book_id).maybeSingle();
    if (bookErr) throw bookErr;
    if (!book) return json({ error: "Book not found" }, 404, cors);

    await ensureBookIndexed(serviceClient, body.book_id);
    const chunks = await retrieveChunks(
      userClient, body.book_id,
      "important facts, concepts, and ideas that test comprehension, organized by topic",
      { matchCount: 14, chapterId: body.chapter_id },
    );
    if (chunks.length === 0) {
      return json({ error: "This book has no indexable content yet" }, 400, cors);
    }
    const context = formatChunksAsContext(chunks);

    const result = await structuredCompletion({
      provider: "openai",
      model: "gpt-4o-mini",
      system: `You generate a practice exam from a book's excerpts, testing genuine comprehension, using a mix of question types: multiple-choice (4 options), true/false, fill-in-the-blank, short-answer, matching (2-5 pairs), and at most 2 essay questions. Tag each question with a short "topic" label (the concept it tests, e.g. "Chapter 3: Supply and Demand") so weak areas can be tracked per topic, and a difficulty (easy/medium/hard). For multiple_choice set correct_index (0-based). For true_false set correct_bool. For short_answer/fill_blank set correct_text. For matching set matching_pairs. For essay, leave correct_index/correct_bool/correct_text at reasonable defaults (0/false/'') since it needs human grading — but still fill "explanation" with a model answer. Generate exactly ${questionCount} questions if the material supports it. Respond in the same language as the excerpts unless told otherwise.`,
      userText: context,
      schema: EXAM_SCHEMA,
      toolName: "generate_practice_exam",
      maxTokens: 3500,
    }) as { questions: AiQuestion[] };

    if (!result.questions || result.questions.length === 0) {
      return json({ error: "Could not generate a practice exam from this content" }, 500, cors);
    }

    const { data: quiz, error: quizErr } = await userClient
      .from("library_quizzes")
      .insert({
        scope_type: body.chapter_id ? "chapter" : "book",
        book_id: body.book_id,
        chapter_id: body.chapter_id ?? null,
        title: body.title || `${book.title} — Practice Exam`,
        is_timed: body.is_timed ?? true,
        time_limit_minutes: body.time_limit_minutes ?? 20,
        passing_score_percent: body.passing_score_percent ?? 70,
        is_adaptive_difficulty: true,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (quizErr) throw quizErr;

    const rows = result.questions.map((q, i) => {
      let options: unknown = [];
      let correctAnswer: unknown = null;

      if (q.type === "multiple_choice") {
        options = q.options;
        correctAnswer = q.correct_index;
      } else if (q.type === "true_false") {
        correctAnswer = q.correct_bool;
      } else if (q.type === "matching") {
        options = q.matching_pairs;
        correctAnswer = Object.fromEntries(q.matching_pairs.map((p) => [p.left, p.right]));
      } else if (q.type === "short_answer" || q.type === "fill_blank") {
        correctAnswer = q.correct_text;
      } // essay: correctAnswer stays null

      return {
        quiz_id: quiz.id,
        question_type: q.type,
        question_text: q.question_text,
        options,
        correct_answer: correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty,
        topic: q.topic,
        order_index: i,
      };
    });

    const { error: questionsErr } = await serviceClient.from("library_quiz_questions").insert(rows);
    if (questionsErr) throw questionsErr;

    return json({ ok: true, quiz_id: quiz.id, question_count: rows.length }, 200, cors);
  } catch (err) {
    const msg = err instanceof ProviderError ? err.message : err instanceof Error ? err.message : String(err);
    console.error("library-generate-practice-exam error:", msg);
    return json({ error: msg }, 500, cors);
  }
});
