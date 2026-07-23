// ─── Library — AI Personal Librarian: Smart Automation ─────────────────────
// Deliberately deterministic (no LLM call) — composes data already fetched
// elsewhere (continue-reading, chapters, today's activity, daily plan,
// recommendations) into a short list of actionable suggestions. Matches the
// app's "don't call an LLM for what's really a derived signal" precedent.

import { supabase } from "@/integrations/supabase/client";
import { fetchChaptersForBook } from "@/services/library/chapters";

const FATIGUE_THRESHOLD_MINUTES = 90;

export interface LibraryNextChapterSuggestion {
  bookId: string;
  chapterId: string;
  chapterTitle: string | null;
  chapterNumber: number;
}

/** Given the currently-in-progress book with the most recent activity,
 *  finds the next unread chapter after wherever last_position.chapter_id
 *  says the reader left off. Returns null if there's no next chapter or no
 *  chapter position was ever recorded (e.g. an audiobook or a book read via
 *  page-number only). */
export async function fetchNextChapterSuggestion(userId: string, bookId: string): Promise<LibraryNextChapterSuggestion | null> {
  const { data: progress, error } = await supabase
    .from("library_reading_progress").select("last_position").eq("user_id", userId).eq("book_id", bookId).maybeSingle();
  if (error) throw new Error(error.message);
  const lastChapterId = (progress?.last_position as { chapter_id?: string } | null)?.chapter_id;
  if (!lastChapterId) return null;

  const chapters = await fetchChaptersForBook(bookId);
  const currentIndex = chapters.findIndex((c) => c.id === lastChapterId);
  if (currentIndex === -1 || currentIndex >= chapters.length - 1) return null;
  const next = chapters[currentIndex + 1];
  return { bookId, chapterId: next.id, chapterTitle: next.title, chapterNumber: next.chapter_number };
}

export async function fetchTodayReadingMinutes(userId: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("library_reading_daily_activity").select("minutes_read").eq("user_id", userId).eq("activity_date", today).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.minutes_read ?? 0;
}

export function isReadingFatigueLikely(todayMinutes: number): boolean {
  return todayMinutes >= FATIGUE_THRESHOLD_MINUTES;
}
