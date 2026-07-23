/**
 * library-librarian-privacy — the Privacy Dashboard's backend: export,
 * delete_category (selective memory), delete_all, pause, resume. Mirrors
 * career-gdpr-request's inline-export/logged-request shape, scoped to the
 * Library's own AI-memory tables only (matches that function's own
 * "shared/site-wide tables out of scope" precedent).
 *
 * delete_category/delete_all route through delete_library_librarian_category()
 * (SECURITY DEFINER, fixed category allow-list, no dynamic SQL) rather than
 * building DELETE statements here — keeps the injection-proof boundary in
 * the database function, not duplicated in edge-function string handling.
 *
 * Auth: user-jwt required.
 * Input: JSON { action: "export"|"delete_category"|"delete_all"|"pause"|"resume", category?: string }
 * Returns: JSON { ok, requestId, status, data? }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const EXPORT_TABLES = [
  "library_reading_progress", "library_bookmarks", "library_notes", "library_highlights",
  "library_favorites", "library_favorite_topics", "library_reader_profiles",
  "library_ai_preferences", "library_ai_chat_sessions", "library_reading_goals",
  "library_librarian_goals", "library_skills", "library_librarian_daily_plans",
  "library_librarian_summaries", "library_librarian_recommendations",
] as const;

const CATEGORIES = [
  "highlights", "notes", "bookmarks", "chat_history", "recommendations",
  "daily_plans", "summaries", "goals", "favorite_topics",
] as const;

type Action = "export" | "delete_category" | "delete_all" | "pause" | "resume";

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

  let body: { action?: Action; category?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }
  const action = body.action;
  if (!action || !["export", "delete_category", "delete_all", "pause", "resume"].includes(action)) {
    return json({ error: "action must be export, delete_category, delete_all, pause, or resume" }, 400, cors);
  }
  if (action === "delete_category" && (!body.category || !CATEGORIES.includes(body.category as typeof CATEGORIES[number]))) {
    return json({ error: `category must be one of: ${CATEGORIES.join(", ")}` }, 400, cors);
  }

  const requestType = action === "delete_all" ? "delete_all" : action === "delete_category" ? "delete_category" : action;

  const { data: requestRow, error: insertErr } = await serviceClient
    .from("library_librarian_data_requests")
    .insert({ user_id: user.id, request_type: requestType, category: body.category ?? null, status: "pending" })
    .select("id").single();
  if (insertErr) return json({ error: insertErr.message }, 500, cors);

  try {
    if (action === "export") {
      const bundle: Record<string, unknown> = {};
      for (const table of EXPORT_TABLES) {
        const { data } = await serviceClient.from(table).select("*").eq("user_id", user.id);
        bundle[table] = data ?? [];
      }
      await serviceClient.from("library_librarian_data_requests").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", requestRow.id);
      return json({ ok: true, requestId: requestRow.id, status: "completed", data: bundle }, 200, cors);
    }

    if (action === "delete_category") {
      const { error } = await userClient.rpc("delete_library_librarian_category", { _category: body.category });
      if (error) throw error;
    } else if (action === "delete_all") {
      for (const category of CATEGORIES) {
        const { error } = await userClient.rpc("delete_library_librarian_category", { _category: category });
        if (error) throw error;
      }
    } else if (action === "pause") {
      const { error } = await userClient.rpc("pause_library_ai_memory");
      if (error) throw error;
    } else if (action === "resume") {
      const { error } = await userClient.rpc("resume_library_ai_memory");
      if (error) throw error;
    }

    await serviceClient.from("library_librarian_data_requests").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", requestRow.id);
    return json({ ok: true, requestId: requestRow.id, status: "completed" }, 200, cors);
  } catch (err) {
    await serviceClient.from("library_librarian_data_requests").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", requestRow.id);
    const msg = err instanceof Error ? err.message : String(err);
    console.error("library-librarian-privacy error:", msg);
    return json({ error: msg }, 500, cors);
  }
});
