/**
 * library-librarian-recommendations — the AI Personal Librarian's multi-type
 * recommendation feed (books/audiobooks/authors/book clubs/learning paths/
 * challenges/events/research topics), written to
 * library_librarian_recommendations.
 *
 * Deliberately mostly DETERMINISTIC (plain SQL candidate selection weighted
 * by the reader's own favorite genres/authors/topics), not LLM-generated —
 * matches this app's established "don't call an LLM for what's really a SQL
 * aggregate" precedent (e.g. get_library_trending_topics). The existing
 * library-recommend-books cache is reused as-is for the "book" type rather
 * than regenerated here. "Articles" has no dedicated content type in this
 * app yet, so it's intentionally omitted rather than faked.
 *
 * Auth: user-jwt required. Rate-limited like every other AI-adjacent
 * function even though most of this is non-LLM, since it still does
 * meaningful work per call and shouldn't be spammable.
 * Input: JSON {} (no body needed — always operates on the caller)
 * Returns: JSON { ok, generated: number }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

interface Candidate {
  recommendation_type: string;
  entity_id: string;
  title: string;
  reason: string;
  score: number;
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

  const { data: allowed } = await serviceClient.rpc("check_ai_rate_limit", { _user_id: user.id, _function_name: "library-librarian-recommendations" });
  if (allowed === false) return json({ error: "Daily limit reached. Try again tomorrow." }, 429, cors);

  try {
    const candidates: Candidate[] = [];

    const { data: profile } = await userClient
      .from("library_reader_profiles").select("favorite_genres, favorite_authors").eq("user_id", user.id).maybeSingle();
    const favoriteGenres: string[] = profile?.favorite_genres ?? [];
    const favoriteAuthors: string[] = profile?.favorite_authors ?? [];

    const { data: bookRecs } = await userClient
      .from("library_book_recommendations")
      .select("book_id, score, reason, library_books(title)")
      .eq("user_id", user.id).order("score", { ascending: false }).limit(8);
    for (const r of (bookRecs ?? []) as unknown as Array<{ book_id: string; score: number; reason: string; library_books: { title: string } | null }>) {
      if (!r.library_books) continue;
      candidates.push({ recommendation_type: "book", entity_id: r.book_id, title: r.library_books.title, reason: r.reason ?? "Based on your reading history", score: r.score });
    }

    const { data: mostListened } = await userClient.rpc("get_library_most_listened_books", { _limit: 6 });
    const mostListenedIds = ((mostListened ?? []) as unknown as Array<{ book_id: string; listen_count: number }>).map((r) => r.book_id);
    if (mostListenedIds.length > 0) {
      const { data: listenedBooks } = await userClient.from("library_books").select("id, title").in("id", mostListenedIds);
      const titleById = new Map((listenedBooks ?? []).map((b: { id: string; title: string }) => [b.id, b.title]));
      for (const row of (mostListened ?? []) as unknown as Array<{ book_id: string; listen_count: number }>) {
        const title = titleById.get(row.book_id);
        if (!title) continue;
        candidates.push({ recommendation_type: "audiobook", entity_id: row.book_id, title, reason: "Popular audiobook right now", score: 0.5 });
      }
    }

    if (favoriteGenres.length > 0) {
      const { data: authors } = await userClient
        .from("library_authors")
        .select("id, name, library_books!inner(category_id)")
        .in("library_books.category_id", favoriteGenres)
        .not("id", "in", `(${favoriteAuthors.length > 0 ? favoriteAuthors.join(",") : "00000000-0000-0000-0000-000000000000"})`)
        .limit(6);
      const seenAuthors = new Set<string>();
      for (const a of (authors ?? []) as unknown as Array<{ id: string; name: string }>) {
        if (seenAuthors.has(a.id)) continue;
        seenAuthors.add(a.id);
        candidates.push({ recommendation_type: "author", entity_id: a.id, title: a.name, reason: "Writes in genres you love", score: 0.6 });
      }
    }

    const { data: joinedClubIds } = await userClient.from("library_club_members").select("club_id").eq("user_id", user.id);
    const clubExclude = (joinedClubIds ?? []).map((r: { club_id: string }) => r.club_id);
    let clubQuery = userClient.from("library_clubs").select("id, name, member_count").eq("visibility", "public").order("member_count", { ascending: false }).limit(6);
    if (clubExclude.length > 0) clubQuery = clubQuery.not("id", "in", `(${clubExclude.join(",")})`);
    const { data: clubs } = await clubQuery;
    for (const c of (clubs ?? []) as unknown as Array<{ id: string; name: string; member_count: number }>) {
      candidates.push({ recommendation_type: "book_club", entity_id: c.id, title: c.name, reason: "Active book club you might enjoy", score: 0.4 });
    }

    const { data: paths } = await userClient.from("library_learning_paths").select("id, title").eq("is_published", true).limit(6);
    for (const p of (paths ?? []) as unknown as Array<{ id: string; title: string }>) {
      candidates.push({ recommendation_type: "learning_path", entity_id: p.id, title: p.title, reason: "Structured learning path", score: 0.35 });
    }

    const { data: joinedChallengeIds } = await userClient.from("library_challenge_progress").select("challenge_id").eq("user_id", user.id);
    const challengeExclude = (joinedChallengeIds ?? []).map((r: { challenge_id: string }) => r.challenge_id);
    let challengeQuery = userClient.from("library_challenges").select("id, title").eq("is_active", true).limit(6);
    if (challengeExclude.length > 0) challengeQuery = challengeQuery.not("id", "in", `(${challengeExclude.join(",")})`);
    const { data: challenges } = await challengeQuery;
    for (const c of (challenges ?? []) as unknown as Array<{ id: string; title: string }>) {
      candidates.push({ recommendation_type: "challenge", entity_id: c.id, title: c.title, reason: "Join a reading challenge", score: 0.4 });
    }

    const { data: rsvpEventIds } = await userClient.from("library_event_rsvps").select("event_id").eq("user_id", user.id);
    const eventExclude = (rsvpEventIds ?? []).map((r: { event_id: string }) => r.event_id);
    let eventQuery = userClient.from("library_events").select("id, title").gte("scheduled_start", new Date().toISOString()).order("scheduled_start", { ascending: true }).limit(6);
    if (eventExclude.length > 0) eventQuery = eventQuery.not("id", "in", `(${eventExclude.join(",")})`);
    const { data: events } = await eventQuery;
    for (const e of (events ?? []) as unknown as Array<{ id: string; title: string }>) {
      candidates.push({ recommendation_type: "event", entity_id: e.id, title: e.title, reason: "Upcoming event", score: 0.4 });
    }

    const { data: trending } = await userClient.rpc("get_library_trending_topics", { _limit: 6 });
    for (const t of (trending ?? []) as unknown as Array<{ entity_id: string; name: string }>) {
      candidates.push({ recommendation_type: "research_topic", entity_id: t.entity_id, title: t.name, reason: "Trending research topic", score: 0.3 });
    }

    await serviceClient.from("library_librarian_recommendations").delete().eq("user_id", user.id).eq("is_dismissed", false);
    if (candidates.length > 0) {
      const { error: insertErr } = await serviceClient.from("library_librarian_recommendations").insert(
        candidates.map((c) => ({ user_id: user.id, ...c }))
      );
      if (insertErr) throw insertErr;
    }

    return json({ ok: true, generated: candidates.length }, 200, cors);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("library-librarian-recommendations error:", msg);
    return json({ error: msg }, 500, cors);
  }
});
