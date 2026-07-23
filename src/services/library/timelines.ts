// ─── Library — Knowledge & Research Platform: Timelines ────────────────────

import { supabase } from "@/integrations/supabase/client";

export type LibraryTimelineType = "historical" | "scientific_discovery" | "book_series" | "author_life" | "technology_evolution";

export interface LibraryTimelineRow {
  id: string;
  title: string;
  timeline_type: LibraryTimelineType;
  description: string | null;
  kg_entity_id: string | null;
  series_id: string | null;
  is_ai_generated: boolean;
  created_by: string | null;
  created_at: string;
}

export interface LibraryTimelineEventRow {
  id: string;
  timeline_id: string;
  event_date_or_period: string;
  title: string;
  description: string | null;
  order_index: number;
  kg_entity_id: string | null;
  source_book_id: string | null;
  created_at: string;
}

export async function fetchTimelines(timelineType?: LibraryTimelineType): Promise<LibraryTimelineRow[]> {
  let query = supabase.from("library_timelines").select("*").order("created_at", { ascending: false });
  if (timelineType) query = query.eq("timeline_type", timelineType);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryTimelineRow[];
}

export async function fetchTimeline(timelineId: string): Promise<LibraryTimelineRow | null> {
  const { data, error } = await supabase.from("library_timelines").select("*").eq("id", timelineId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as LibraryTimelineRow | null;
}

export async function fetchTimelineEvents(timelineId: string): Promise<LibraryTimelineEventRow[]> {
  const { data, error } = await supabase.from("library_timeline_events").select("*").eq("timeline_id", timelineId).order("order_index");
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryTimelineEventRow[];
}

export interface CreateTimelineInput {
  title: string;
  timeline_type: LibraryTimelineType;
  description?: string | null;
  kg_entity_id?: string | null;
  series_id?: string | null;
}

export async function createTimeline(userId: string, input: CreateTimelineInput): Promise<LibraryTimelineRow> {
  const { data, error } = await supabase.from("library_timelines").insert({ ...input, created_by: userId }).select("*").single();
  if (error) throw new Error(error.message);
  return data as LibraryTimelineRow;
}

export async function addTimelineEvent(timelineId: string, event: { event_date_or_period: string; title: string; description?: string | null; order_index: number }): Promise<LibraryTimelineEventRow> {
  const { data, error } = await supabase.from("library_timeline_events").insert({ ...event, timeline_id: timelineId }).select("*").single();
  if (error) throw new Error(error.message);
  return data as LibraryTimelineEventRow;
}

export async function deleteTimelineEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from("library_timeline_events").delete().eq("id", eventId);
  if (error) throw new Error(error.message);
}
