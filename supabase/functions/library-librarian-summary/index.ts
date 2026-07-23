/**
 * library-librarian-summary — Smart Summaries: daily/weekly/monthly/yearly
 * narrative recaps (reading insights, learning insights, skill development
 * insights) built from real aggregate stats (library_reading_daily_activity,
 * library_listening_daily_stats, library_reading_progress completions,
 * library_certificates, library_skills) plus one narrative LLM call.
 * Persists to library_librarian_summaries (upsert per user+period+start).
 *
 * Auth: user-jwt required.
 * Input: JSON { period: "daily"|"weekly"|"monthly"|"yearly" }
 * Returns: JSON { ok, summary: <library_librarian_summaries row> }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { structuredCompletion, ProviderError } from "../_shared/aiProvider.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

type Period = "daily" | "weekly" | "monthly" | "yearly";

function periodRange(period: Period): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  if (period === "daily") start.setDate(start.getDate() - 1);
  else if (period === "weekly") start.setDate(start.getDate() - 7);
  else if (period === "monthly") start.setMonth(start.getMonth() - 1);
  else start.setFullYear(start.getFullYear() - 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

const SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    reading_insights: { type: "string" },
    learning_insights: { type: "string" },
    skill_insights: { type: "string" },
    summary_text: { type: "string" },
  },
  required: ["reading_insights", "learning_insights", "skill_insights", "summary_text"],
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

  let body: { period?: Period };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }
  if (!body.period || !["daily", "weekly", "monthly", "yearly"].includes(body.period)) {
    return json({ error: "period must be daily, weekly, monthly, or yearly" }, 400, cors);
  }

  const { data: allowed } = await serviceClient.rpc("check_ai_rate_limit", { _user_id: user.id, _function_name: "library-librarian-summary" });
  if (allowed === false) return json({ error: "Daily limit reached. Try again tomorrow." }, 429, cors);

  try {
    const { start, end } = periodRange(body.period);

    const [{ data: activity }, { data: listening }, { data: completedBooks }, { data: certificates }, { data: skills }] = await Promise.all([
      userClient.from("library_reading_daily_activity").select("pages_read, minutes_read, sessions").eq("user_id", user.id).gte("activity_date", start).lte("activity_date", end),
      userClient.from("library_listening_daily_stats").select("seconds_listened").eq("user_id", user.id).gte("stat_date", start).lte("stat_date", end),
      userClient.from("library_reading_progress").select("book_id, library_books(title)").eq("user_id", user.id).gte("completed_at", start).lte("completed_at", end + "T23:59:59"),
      userClient.from("library_certificates").select("title").eq("user_id", user.id).gte("issued_at", start).lte("issued_at", end + "T23:59:59"),
      userClient.from("library_skills").select("skill_name, proficiency_level").eq("user_id", user.id).gte("updated_at", start).lte("updated_at", end + "T23:59:59"),
    ]);

    const totalPages = (activity ?? []).reduce((sum: number, r: { pages_read: number }) => sum + r.pages_read, 0);
    const totalMinutes = (activity ?? []).reduce((sum: number, r: { minutes_read: number }) => sum + r.minutes_read, 0);
    const totalSessions = (activity ?? []).reduce((sum: number, r: { sessions: number }) => sum + r.sessions, 0);
    const totalListeningMinutes = Math.round((listening ?? []).reduce((sum: number, r: { seconds_listened: number }) => sum + r.seconds_listened, 0) / 60);
    const completedTitles = ((completedBooks ?? []) as unknown as Array<{ library_books: { title: string } | null }>).map((r) => r.library_books?.title).filter(Boolean);
    const certificateTitles = (certificates ?? []).map((c: { title: string }) => c.title);
    const skillNames = (skills ?? []).map((s: { skill_name: string; proficiency_level: string }) => `${s.skill_name} (${s.proficiency_level})`);

    const stats = {
      totalPages, totalMinutes, totalSessions, totalListeningMinutes,
      completedCount: completedTitles.length, certificateCount: certificateTitles.length, skillsUpdated: skillNames.length,
    };

    const userText = [
      `Period: ${body.period} (${start} to ${end}).`,
      `Reading: ${totalPages} pages read across ${totalSessions} sessions, ${totalMinutes} minutes total.`,
      `Listening: ${totalListeningMinutes} minutes of audiobook listening.`,
      completedTitles.length > 0 ? `Books completed: ${completedTitles.join(", ")}.` : "No books completed in this period.",
      certificateTitles.length > 0 ? `Certificates earned: ${certificateTitles.join(", ")}.` : "",
      skillNames.length > 0 ? `Skills updated: ${skillNames.join(", ")}.` : "",
    ].filter(Boolean).join("\n");

    const result = await structuredCompletion({
      provider: "openai",
      model: "gpt-4o-mini",
      system: `You write a warm, encouraging ${body.period} recap for a reader/learner using an AI Personal Librarian app, based on their real activity stats. Produce: reading_insights (1-2 sentences about their reading volume/pace this period), learning_insights (1-2 sentences about courses/skills/certificates progress, or gentle encouragement if none), skill_insights (1-2 sentences specifically about skill development, or encouragement to add skills if none tracked), and a summary_text (2-3 sentence overall recap tying it together). Be specific to the numbers given, never generic filler, and never invent activity not present in the data.`,
      userText,
      schema: SUMMARY_SCHEMA,
      toolName: "generate_smart_summary",
      maxTokens: 700,
    }) as { reading_insights: string; learning_insights: string; skill_insights: string; summary_text: string };

    const { data: saved, error: saveErr } = await serviceClient
      .from("library_librarian_summaries")
      .upsert({
        user_id: user.id,
        summary_period: body.period,
        period_start: start,
        period_end: end,
        reading_insights: result.reading_insights,
        learning_insights: result.learning_insights,
        skill_insights: result.skill_insights,
        summary_text: result.summary_text,
        stats,
        generated_at: new Date().toISOString(),
      }, { onConflict: "user_id,summary_period,period_start" })
      .select("*").single();
    if (saveErr) throw saveErr;

    return json({ ok: true, summary: saved }, 200, cors);
  } catch (err) {
    const msg = err instanceof ProviderError ? err.message : err instanceof Error ? err.message : String(err);
    console.error("library-librarian-summary error:", msg);
    return json({ error: msg }, 500, cors);
  }
});
