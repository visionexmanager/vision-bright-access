// ─── Library — Analytics Service (Phase 4) ────────────────────────────────────
// Fire-and-forget event logging into library_analytics_events
// (20260722000000_library_explorer_functions.sql). A failed analytics write
// must never break the UI — every error here is swallowed and warned, not
// thrown. Scope (per the Phase 4 plan): page views for books/categories
// piggyback on the recently-viewed insert / a page_view event; "clicks" is
// scoped to book/category card clicks, not every click on the page; search
// and filter-change events are logged debounced by the caller, not per
// keystroke.

import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "library:analytics-session-id";

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "unknown";
  }
}

export type LibraryAnalyticsEventType =
  | "page_view" | "card_click" | "search" | "filter_change" | "book_open"
  // ── Phase 5: Book Details action-level events ──────────────────────────
  | "reading_started" | "listening_started" | "download" | "purchase"
  | "favorite_added" | "share" | "review_written"
  // ── Phase 6: Reader Engine events ───────────────────────────────────────
  | "page_turned" | "chapter_completed" | "search_performed" | "bookmark_added"
  | "note_added" | "highlight_added" | "ai_assistant_used" | "read_aloud_started"
  | "offline_download" | "reader_error"
  // ── Phase 7: Audiobooks Platform events ─────────────────────────────────
  | "playback_paused" | "playback_rate_changed";

interface LogEventOptions {
  userId?: string | null;
  entityType?: "book" | "category" | "author" | "explorer" | "audiobook" | "narrator";
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export async function logLibraryAnalyticsEvent(eventType: LibraryAnalyticsEventType, options: LogEventOptions = {}): Promise<void> {
  try {
    const { error } = await supabase.from("library_analytics_events").insert({
      user_id: options.userId ?? null,
      session_id: getSessionId(),
      event_type: eventType,
      entity_type: options.entityType ?? null,
      entity_id: options.entityId ?? null,
      metadata: options.metadata ?? {},
    });
    if (error) console.warn("library analytics event failed:", error.message);
  } catch (err) {
    console.warn("library analytics event failed:", err);
  }
}

// ─── Author-facing analytics (Phase 9) ────────────────────────────────────
// Wraps the library-book-analytics edge function — owner/admin only.

export interface LibraryDailyStatRow {
  book_id: string;
  stat_date: string;
  views: number;
  downloads: number;
  purchases: number;
  favorites_added: number;
  reviews_added: number;
  reading_sessions_started: number;
  reading_sessions_completed: number;
  reading_minutes: number;
  revenue_usd: number;
  revenue_vx: number;
}

export interface LibraryDimensionStatRow {
  dimension_value: string;
  count: number;
}

export async function fetchBookDailyStats(bookId: string, from?: string, to?: string): Promise<LibraryDailyStatRow[]> {
  const { data, error } = await supabase.functions.invoke("library-book-analytics", { body: { book_id: bookId, period: "daily", from, to } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return (data.rows ?? []) as LibraryDailyStatRow[];
}

export async function fetchBookDimensionStats(bookId: string, dimension: "country" | "device" | "traffic_source", from?: string, to?: string): Promise<LibraryDimensionStatRow[]> {
  const { data, error } = await supabase.functions.invoke("library-book-analytics", { body: { book_id: bookId, dimension, from, to } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return (data.rows ?? []) as LibraryDimensionStatRow[];
}
