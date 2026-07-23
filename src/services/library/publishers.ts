// ─── Library — Publisher Store Service (Phase 10) ─────────────────────────
// library_publishers has no user_id/owner account (confirmed: publishers
// are admin-curated catalog entities, unlike self-service library_authors)
// — this is a read-only public store + follow mechanism, no publisher-side
// dashboard.

import { supabase } from "@/integrations/supabase/client";
import type { LibraryPublisherProfile } from "@/lib/types/library-marketplace";

const PUBLISHER_SELECT = "id, name, slug, description, logo_url, website_url, bio, banner_url, social_links, follower_count";

export async function fetchPublisherBySlug(slug: string): Promise<LibraryPublisherProfile | null> {
  const { data, error } = await supabase.from("library_publishers").select(PUBLISHER_SELECT).eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return data as LibraryPublisherProfile | null;
}

/** "Popular Publishers" — an aggregation over library_books, no dedicated
 *  table. Ranked by total views across the publisher's catalog, computed
 *  client-side since the publisher list is always small (matches
 *  fetchPublishers' own documented "always a small, bounded list" note in
 *  catalog.ts). */
export async function fetchPopularPublishers(limit = 8): Promise<Array<LibraryPublisherProfile & { totalViews: number; bookCount: number }>> {
  const { data, error } = await supabase.from("library_books").select("publisher_id, views_count, library_publishers(id, name, slug, description, logo_url, website_url, bio, banner_url, social_links, follower_count)").eq("publish_status", "published").not("publisher_id", "is", null);
  if (error) throw new Error(error.message);

  const byPublisher = new Map<string, { profile: LibraryPublisherProfile; totalViews: number; bookCount: number }>();
  for (const row of (data ?? []) as unknown as Array<{ publisher_id: string; views_count: number; library_publishers: LibraryPublisherProfile | null }>) {
    if (!row.library_publishers) continue;
    const existing = byPublisher.get(row.publisher_id);
    if (existing) {
      existing.totalViews += row.views_count ?? 0;
      existing.bookCount += 1;
    } else {
      byPublisher.set(row.publisher_id, { profile: row.library_publishers, totalViews: row.views_count ?? 0, bookCount: 1 });
    }
  }

  return Array.from(byPublisher.values())
    .sort((a, b) => b.totalViews - a.totalViews)
    .slice(0, limit)
    .map((entry) => ({ ...entry.profile, totalViews: entry.totalViews, bookCount: entry.bookCount }));
}

export async function isFollowingPublisher(publisherId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase.from("library_publisher_followers").select("publisher_id").eq("publisher_id", publisherId).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

export async function followPublisher(publisherId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("library_publisher_followers").insert({ publisher_id: publisherId, user_id: userId });
  if (error) throw new Error(error.message);
}

export async function unfollowPublisher(publisherId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("library_publisher_followers").delete().eq("publisher_id", publisherId).eq("user_id", userId);
  if (error) throw new Error(error.message);
}
