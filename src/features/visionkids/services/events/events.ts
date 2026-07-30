import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { EventType, KidsEvent } from "@/features/visionkids/types/events.types";

export interface EventFilters {
  ageGroup?: string;
  language?: string;
  level?: string;
  category?: string;
}

export async function fetchEvents(eventType?: EventType, filters: EventFilters = {}): Promise<KidsEvent[]> {
  let query = kidsDb.from("kids_events").select("*").neq("status", "draft").order("starts_at");
  if (eventType) query = query.eq("event_type", eventType);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.ageGroup && filters.ageGroup !== "all") query = query.in("age_group", [filters.ageGroup, "all"]);
  if (filters.language) query = query.eq("language", filters.language);
  if (filters.level && filters.level !== "all") query = query.in("level", [filters.level, "all"]);
  const { data, error } = await query.returns<KidsEvent[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchEventBySlug(slug: string): Promise<KidsEvent | null> {
  const { data, error } = await kidsDb.from("kids_events").select("*").eq("slug", slug).maybeSingle().returns<KidsEvent>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchEventById(id: string): Promise<KidsEvent | null> {
  const { data, error } = await kidsDb.from("kids_events").select("*").eq("id", id).maybeSingle().returns<KidsEvent>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchEventsByIds(ids: string[]): Promise<KidsEvent[]> {
  if (ids.length === 0) return [];
  const { data, error } = await kidsDb.from("kids_events").select("*").in("id", ids).returns<KidsEvent[]>();
  if (error) throw error;
  return data ?? [];
}

/** Calendar view — everything overlapping [from, to), independent of type,
 *  so the Calendar page can show all four event kinds together. */
export async function fetchEventsInRange(fromIso: string, toIso: string, filters: EventFilters = {}): Promise<KidsEvent[]> {
  let query = kidsDb
    .from("kids_events").select("*").neq("status", "draft")
    .lt("starts_at", toIso).gt("ends_at", fromIso)
    .order("starts_at");
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.ageGroup && filters.ageGroup !== "all") query = query.in("age_group", [filters.ageGroup, "all"]);
  if (filters.language) query = query.eq("language", filters.language);
  if (filters.level && filters.level !== "all") query = query.in("level", [filters.level, "all"]);
  const { data, error } = await query.returns<KidsEvent[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchUpcomingEvents(limit = 6): Promise<KidsEvent[]> {
  const { data, error } = await kidsDb
    .from("kids_events").select("*").neq("status", "draft").in("status", ["scheduled", "live"])
    .order("starts_at").limit(limit)
    .returns<KidsEvent[]>();
  if (error) throw error;
  return data ?? [];
}

export async function incrementEventReaction(eventId: string, emoji: string): Promise<void> {
  const { error } = await kidsDb.rpc("increment_kids_event_reaction", { _event_id: eventId, _emoji: emoji });
  if (error) throw error;
}
