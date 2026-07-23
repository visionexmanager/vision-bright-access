/**
 * library-generate-reading-plan — AI-generated personalized reading/study
 * plan from the caller's own goals (library_reading_goals), favorite
 * genres/authors (library_reader_profiles), current reading streak, and
 * (Learning Hub) weak quiz topics (get_library_weak_topics) so the plan can
 * prioritize what to review, not just what to read next. Read-only (no DB
 * write) — returned to the caller for display; a user can already persist
 * any specific action (e.g. add a suggested book to a reading list), so
 * this doesn't need its own storage table.
 *
 * Auth: user-jwt required (plans for the calling user only).
 * Input: JSON {} (no body needed — reads the caller's own goals/profile)
 * Returns: JSON { ok, plan_summary, weekly_focus, book_suggestions, study_focus }
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
    plan_summary: { type: "string" },
    weekly_focus: { type: "array", maxItems: 4, items: { type: "string" } },
    book_suggestion_titles: { type: "array", maxItems: 5, items: { type: "string" } },
    study_focus: { type: "array", maxItems: 4, items: { type: "string" } },
  },
  required: ["plan_summary", "weekly_focus", "book_suggestion_titles", "study_focus"],
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

  const { data: allowed } = await serviceClient.rpc("check_ai_rate_limit", { _user_id: user.id, _function_name: "library-generate-reading-plan" });
  if (allowed === false) return json({ error: "Daily limit reached. Try again tomorrow." }, 429, cors);

  try {
    const [{ data: goals }, { data: profile }, { data: streak }, { data: weakTopics }] = await Promise.all([
      userClient.from("library_reading_goals").select("goal_type, target, custom_label").eq("is_active", true),
      userClient.from("library_reader_profiles").select("bio, favorite_genres, favorite_authors, languages").eq("user_id", user.id).maybeSingle(),
      userClient.rpc("get_library_reading_streak", { _user_id: user.id }),
      userClient.rpc("get_library_weak_topics", {}),
    ]);

    let genreNames: string[] = [];
    let authorNames: string[] = [];
    if (profile?.favorite_genres?.length) {
      const { data: cats } = await serviceClient.from("library_categories").select("name").in("id", profile.favorite_genres);
      genreNames = (cats ?? []).map((c) => c.name);
    }
    if (profile?.favorite_authors?.length) {
      const { data: auths } = await serviceClient.from("library_authors").select("name").in("id", profile.favorite_authors);
      authorNames = (auths ?? []).map((a) => a.name);
    }

    const userText = [
      `Current reading streak: ${streak ?? 0} days.`,
      goals && goals.length > 0
        ? `Active goals: ${goals.map((g) => `${g.goal_type === "custom" ? g.custom_label : g.goal_type} (target ${g.target})`).join(", ")}.`
        : "No active goals set.",
      genreNames.length > 0 ? `Favorite genres: ${genreNames.join(", ")}.` : "",
      authorNames.length > 0 ? `Favorite authors: ${authorNames.join(", ")}.` : "",
      weakTopics && weakTopics.length > 0
        ? `Weak quiz topics (from past practice exam attempts, lowest accuracy first): ${weakTopics.map((t: { topic: string; accuracy_percent: number }) => `${t.topic} (${t.accuracy_percent}% accuracy)`).join(", ")}.`
        : "",
    ].filter(Boolean).join("\n");

    const result = await structuredCompletion({
      provider: "openai",
      model: "gpt-4o-mini",
      system: "You are a friendly reading and study coach. Given a reader's goals, favorite genres/authors, current streak, and (if present) weak quiz topics from past practice exams, write a short encouraging plan: an overall summary, up to 4 concrete weekly focus items (e.g. pacing advice, a habit to build), up to 5 general book/genre suggestion titles that fit their taste (informal suggestions, not verified catalog matches), and up to 4 study_focus items that directly address the weak topics if any were given (e.g. 'Review chapter 3 concepts and retake a practice quiz on Supply and Demand') — return an empty study_focus array if no weak topics were provided. Keep it concise and motivating, never preachy.",
      userText,
      schema: PLAN_SCHEMA,
      toolName: "generate_reading_plan",
      maxTokens: 800,
    }) as { plan_summary: string; weekly_focus: string[]; book_suggestion_titles: string[]; study_focus: string[] };

    return json({ ok: true, ...result }, 200, cors);
  } catch (err) {
    const msg = err instanceof ProviderError ? err.message : err instanceof Error ? err.message : String(err);
    console.error("library-generate-reading-plan error:", msg);
    return json({ error: msg }, 500, cors);
  }
});
