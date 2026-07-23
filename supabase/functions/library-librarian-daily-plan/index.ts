/**
 * library-librarian-daily-plan — the AI Personal Librarian's "Daily
 * Assistant": one persisted bundle per user per day covering reading plan,
 * study plan, listening plan, review plan, due flashcards, a few practice
 * questions, and a motivational summary.
 *
 * Reuses the exact same signal set as library-generate-reading-plan (active
 * goals, favorite genres/authors, reading streak, weak quiz topics) rather
 * than duplicating that logic differently, plus due flashcards from the new
 * get_library_due_flashcards_for_user() RPC — but unlike that function,
 * this one PERSISTS its output (one row per user per day, upserted) so the
 * Daily Assistant panel has something to show without re-calling the model
 * on every page view, and so Smart Summaries can look back at what was
 * planned vs. done.
 *
 * Idempotent per day: a second call the same day returns the already-stored
 * plan unless `force: true` is passed (used by the "regenerate" UI action).
 *
 * Auth: user-jwt required.
 * Input: JSON { force?: boolean }
 * Returns: JSON { ok, plan: <library_librarian_daily_plans row> }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { structuredCompletion, ProviderError } from "../_shared/aiProvider.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const PLAN_SCHEMA = {
  type: "object",
  properties: {
    reading_plan: {
      type: "object",
      properties: { summary: { type: "string" }, focus_items: { type: "array", maxItems: 4, items: { type: "string" } } },
      required: ["summary", "focus_items"], additionalProperties: false,
    },
    study_plan: {
      type: "object",
      properties: { summary: { type: "string" }, focus_items: { type: "array", maxItems: 4, items: { type: "string" } } },
      required: ["summary", "focus_items"], additionalProperties: false,
    },
    listening_plan: {
      type: "object",
      properties: { summary: { type: "string" } },
      required: ["summary"], additionalProperties: false,
    },
    review_plan: {
      type: "object",
      properties: { summary: { type: "string" } },
      required: ["summary"], additionalProperties: false,
    },
    practice_questions: {
      type: "array", maxItems: 5,
      items: { type: "object", properties: { question: { type: "string" }, topic: { type: "string" } }, required: ["question", "topic"], additionalProperties: false },
    },
    motivational_summary: { type: "string" },
  },
  required: ["reading_plan", "study_plan", "listening_plan", "review_plan", "practice_questions", "motivational_summary"],
  additionalProperties: false,
};

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

  let body: { force?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine — force defaults to false
  }

  const today = new Date().toISOString().slice(0, 10);

  if (!body.force) {
    const { data: existing } = await userClient
      .from("library_librarian_daily_plans").select("*").eq("user_id", user.id).eq("plan_date", today).maybeSingle();
    if (existing) return json({ ok: true, plan: existing }, 200, cors);
  }

  const { data: allowed } = await serviceClient.rpc("check_ai_rate_limit", { _user_id: user.id, _function_name: "library-librarian-daily-plan" });
  if (allowed === false) return json({ error: "Daily limit reached. Try again tomorrow." }, 429, cors);

  try {
    const [{ data: goals }, { data: profile }, { data: streak }, { data: weakTopics }, { data: dueCards }] = await Promise.all([
      userClient.from("library_reading_goals").select("goal_type, target, custom_label").eq("is_active", true),
      userClient.from("library_reader_profiles").select("favorite_genres, favorite_authors").eq("user_id", user.id).maybeSingle(),
      userClient.rpc("get_library_reading_streak", { _user_id: user.id }),
      userClient.rpc("get_library_weak_topics", {}),
      userClient.rpc("get_library_due_flashcards_for_user", { _limit: 20 }),
    ]);

    let genreNames: string[] = [];
    let authorNames: string[] = [];
    if (profile?.favorite_genres?.length) {
      const { data: cats } = await serviceClient.from("library_categories").select("name").in("id", profile.favorite_genres);
      genreNames = (cats ?? []).map((c: { name: string }) => c.name);
    }
    if (profile?.favorite_authors?.length) {
      const { data: auths } = await serviceClient.from("library_authors").select("name").in("id", profile.favorite_authors);
      authorNames = (auths ?? []).map((a: { name: string }) => a.name);
    }

    const dueCardIds = (dueCards ?? []).map((c: { id: string }) => c.id);

    const userText = [
      `Current reading streak: ${streak ?? 0} days.`,
      goals && goals.length > 0
        ? `Active goals: ${goals.map((g: { goal_type: string; target: number; custom_label: string | null }) => `${g.goal_type === "custom" ? g.custom_label : g.goal_type} (target ${g.target})`).join(", ")}.`
        : "No active goals set.",
      genreNames.length > 0 ? `Favorite genres: ${genreNames.join(", ")}.` : "",
      authorNames.length > 0 ? `Favorite authors: ${authorNames.join(", ")}.` : "",
      weakTopics && weakTopics.length > 0
        ? `Weak quiz topics: ${weakTopics.map((t: { topic: string; accuracy_percent: number }) => `${t.topic} (${t.accuracy_percent}% accuracy)`).join(", ")}.`
        : "No weak topics identified yet.",
      `Flashcards due for review today: ${dueCardIds.length}.`,
    ].filter(Boolean).join("\n");

    const result = await structuredCompletion({
      provider: "openai",
      model: "gpt-4o-mini",
      system: "You are a friendly, encouraging AI personal librarian building today's plan for a reader. Given their goals, favorite genres/authors, streak, weak quiz topics, and due-flashcard count, produce: a reading_plan (summary + up to 4 focus items), a study_plan (summary + up to 4 focus items addressing weak topics, empty focus_items if none), a listening_plan (one short summary sentence about audiobook listening for today), a review_plan (one short summary sentence mentioning the due-flashcard count if any), up to 5 short practice_questions testing the weak topics (empty array if no weak topics), and a short motivational_summary (1-2 sentences, warm and specific to their streak/progress, never generic). Respond in the same language implied by the input where possible, otherwise English.",
      userText,
      schema: PLAN_SCHEMA,
      toolName: "generate_daily_plan",
      maxTokens: 1200,
    }) as {
      reading_plan: { summary: string; focus_items: string[] };
      study_plan: { summary: string; focus_items: string[] };
      listening_plan: { summary: string };
      review_plan: { summary: string };
      practice_questions: { question: string; topic: string }[];
      motivational_summary: string;
    };

    const { data: saved, error: saveErr } = await serviceClient
      .from("library_librarian_daily_plans")
      .upsert({
        user_id: user.id,
        plan_date: today,
        reading_plan: result.reading_plan,
        study_plan: result.study_plan,
        listening_plan: result.listening_plan,
        review_plan: result.review_plan,
        due_flashcard_ids: dueCardIds,
        practice_questions: result.practice_questions,
        motivational_summary: result.motivational_summary,
        generated_at: new Date().toISOString(),
      }, { onConflict: "user_id,plan_date" })
      .select("*").single();
    if (saveErr) throw saveErr;

    return json({ ok: true, plan: saved }, 200, cors);
  } catch (err) {
    const msg = err instanceof ProviderError ? err.message : err instanceof Error ? err.message : String(err);
    console.error("library-librarian-daily-plan error:", msg);
    return json({ error: msg }, 500, cors);
  }
});
