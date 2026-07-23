/**
 * library-recommend-community — deterministic (non-AI, same style as
 * library-recommend-books) recommendations for:
 *   - clubs: public/private clubs whose current/past reading schedule
 *     overlaps the caller's favorite genres/authors or shelf/favorites, plus
 *     clubs a followee is already a member of.
 *   - friends: other readers who share favorite genres/authors (from
 *     library_reader_profiles), or who follow/are-followed-by someone the
 *     caller already follows (friend-of-a-friend), excluding people already
 *     followed.
 * No LLM call needed for this — it's the same co-occurrence/overlap scoring
 * library-recommend-books already uses for books, just against clubs/people
 * instead. Uses the service-role client since it must read other users'
 * library_reader_profiles/library_follows/library_club_members rows beyond
 * what plain RLS would allow the caller to see directly.
 *
 * Auth: user-jwt required (recommends for the calling user only)
 * Input: JSON { limit?: number (default 10, max 30) }
 * Returns: JSON { ok, clubs: [{id,slug,name,score,reason}], friends: [{user_id,display_name,avatar_url,score,reason}] }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

interface RequestBody {
  limit?: number;
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

  let body: RequestBody = {};
  try {
    if (req.headers.get("content-length") !== "0") body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }
  const limit = Math.min(Math.max(body.limit ?? 10, 1), 30);

  try {
    const { data: myProfile } = await serviceClient
      .from("library_reader_profiles")
      .select("favorite_genres, favorite_authors")
      .eq("user_id", user.id)
      .maybeSingle();
    const myGenres = new Set(myProfile?.favorite_genres ?? []);
    const myAuthors = new Set(myProfile?.favorite_authors ?? []);

    const { data: myMemberships } = await serviceClient.from("library_club_members").select("club_id").eq("user_id", user.id).eq("status", "active");
    const myClubIds = new Set((myMemberships ?? []).map((m) => m.club_id));

    const { data: myFollowing } = await serviceClient.from("library_follows").select("followee_id").eq("follower_id", user.id);
    const followingIds = new Set((myFollowing ?? []).map((f) => f.followee_id));

    // ── Clubs ──────────────────────────────────────────────────────────────
    const clubScores = new Map<string, { id: string; slug: string; name: string; score: number; reason: string }>();

    if (myGenres.size > 0 || myAuthors.size > 0) {
      const { data: schedules } = await serviceClient
        .from("library_club_reading_schedule")
        .select("club_id, library_books(category_id, author_id), library_clubs(id, slug, name, is_active, visibility)")
        .eq("is_current", true);

      for (const row of (schedules ?? []) as unknown as Array<{ club_id: string; library_books: { category_id: string | null; author_id: string } | null; library_clubs: { id: string; slug: string; name: string; is_active: boolean; visibility: string } | null }>) {
        const club = row.library_clubs;
        if (!club || !club.is_active || club.visibility === "invite_only" || myClubIds.has(club.id)) continue;
        const book = row.library_books;
        if (!book) continue;
        let score = 0;
        if (book.category_id && myGenres.has(book.category_id)) score += 2;
        if (myAuthors.has(book.author_id)) score += 1.5;
        if (score > 0) {
          const existing = clubScores.get(club.id);
          if (!existing || existing.score < score) {
            clubScores.set(club.id, { id: club.id, slug: club.slug, name: club.name, score, reason: "Reading a book that matches your taste" });
          }
        }
      }
    }

    if (followingIds.size > 0) {
      const { data: followeeClubs } = await serviceClient
        .from("library_club_members")
        .select("club_id, library_clubs(id, slug, name, is_active, visibility)")
        .in("user_id", Array.from(followingIds))
        .eq("status", "active");
      for (const row of (followeeClubs ?? []) as unknown as Array<{ club_id: string; library_clubs: { id: string; slug: string; name: string; is_active: boolean; visibility: string } | null }>) {
        const club = row.library_clubs;
        if (!club || !club.is_active || club.visibility === "invite_only" || myClubIds.has(club.id)) continue;
        const existing = clubScores.get(club.id);
        const bump = 1.2;
        if (existing) existing.score += bump;
        else clubScores.set(club.id, { id: club.id, slug: club.slug, name: club.name, score: bump, reason: "A reader you follow is a member" });
      }
    }

    const clubs = Array.from(clubScores.values()).sort((a, b) => b.score - a.score).slice(0, limit);

    // ── Friends ─────────────────────────────────────────────────────────────
    const friendScores = new Map<string, { user_id: string; score: number; reason: string }>();

    if (myGenres.size > 0 || myAuthors.size > 0) {
      const { data: otherProfiles } = await serviceClient
        .from("library_reader_profiles")
        .select("user_id, favorite_genres, favorite_authors, is_public")
        .neq("user_id", user.id)
        .eq("is_public", true)
        .limit(500);
      for (const p of otherProfiles ?? []) {
        if (followingIds.has(p.user_id)) continue;
        const sharedGenres = (p.favorite_genres ?? []).filter((g: string) => myGenres.has(g)).length;
        const sharedAuthors = (p.favorite_authors ?? []).filter((a: string) => myAuthors.has(a)).length;
        const score = sharedGenres * 1 + sharedAuthors * 1.5;
        if (score > 0) friendScores.set(p.user_id, { user_id: p.user_id, score, reason: "Shares your favorite genres/authors" });
      }
    }

    if (followingIds.size > 0) {
      const { data: friendsOfFriends } = await serviceClient
        .from("library_follows")
        .select("followee_id")
        .in("follower_id", Array.from(followingIds))
        .neq("followee_id", user.id);
      for (const row of friendsOfFriends ?? []) {
        if (followingIds.has(row.followee_id)) continue;
        const existing = friendScores.get(row.followee_id);
        const bump = 0.8;
        if (existing) existing.score += bump;
        else friendScores.set(row.followee_id, { user_id: row.followee_id, score: bump, reason: "Followed by readers you follow" });
      }
    }

    const topFriendIds = Array.from(friendScores.values()).sort((a, b) => b.score - a.score).slice(0, limit).map((f) => f.user_id);
    const { data: friendProfiles } = topFriendIds.length > 0
      ? await serviceClient.from("profiles").select("user_id, display_name, avatar_url").in("user_id", topFriendIds)
      : { data: [] as Array<{ user_id: string; display_name: string | null; avatar_url: string | null }> };
    const profileMap = new Map((friendProfiles ?? []).map((p) => [p.user_id, p]));

    const friends = topFriendIds.map((id) => {
      const s = friendScores.get(id)!;
      const p = profileMap.get(id);
      return { user_id: id, display_name: p?.display_name ?? "Reader", avatar_url: p?.avatar_url ?? null, score: s.score, reason: s.reason };
    });

    return json({ ok: true, clubs, friends }, 200, cors);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("library-recommend-community error:", msg);
    return json({ error: msg }, 500, cors);
  }
});
