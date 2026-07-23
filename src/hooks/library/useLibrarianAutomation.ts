import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useContinueReading } from "@/hooks/library/useContinueReading";
import { useLibrarianDailyPlan } from "@/hooks/library/useLibrarianDailyPlan";
import { useLibrarianRecommendations } from "@/hooks/library/useLibrarianRecommendations";
import { fetchNextChapterSuggestion, fetchTodayReadingMinutes, isReadingFatigueLikely } from "@/services/library/librarianAutomation";
import { queryKeys } from "@/lib/api/queryKeys";

export type LibrarianAutomationSuggestionId = "resume-reading" | "next-chapter" | "review-session" | "fatigue-break" | "recommend-challenge";

export interface LibrarianAutomationSuggestion {
  id: LibrarianAutomationSuggestionId;
  /** Values to interpolate into the i18n message template for this id
   *  (e.g. {title}, {percent}, {count}, {chapterNumber}, {chapterTitle}). */
  values: Record<string, string | number>;
  actionTo: string;
}

/** Composes already-fetched signals (continue reading, chapters, today's
 *  activity, daily plan, recommendations) into a short list of actionable
 *  suggestions — Resume Reading / Next Chapter / Review Session / Fatigue /
 *  Study Plan / Breaks / Challenges, all deterministic. */
export function useLibrarianAutomation() {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const { items: continueReading } = useContinueReading();
  const currentBook = continueReading[0];
  const { plan } = useLibrarianDailyPlan();
  const { recommendations } = useLibrarianRecommendations();

  const { data: nextChapter } = useQuery({
    queryKey: [...queryKeys.library.continueReading(uid), "next-chapter", currentBook?.book.id ?? ""],
    queryFn: () => fetchNextChapterSuggestion(uid, currentBook!.book.id),
    enabled: !!user && !!currentBook,
  });

  const { data: todayMinutes = 0 } = useQuery({
    queryKey: [...queryKeys.library.librarianReadingHistory(uid), "today-minutes"],
    queryFn: () => fetchTodayReadingMinutes(uid),
    enabled: !!user,
  });

  const suggestions: LibrarianAutomationSuggestion[] = [];

  if (currentBook) {
    suggestions.push({
      id: "resume-reading",
      values: { title: currentBook.book.title, percent: Math.round(currentBook.percent_complete) },
      actionTo: `/library/read/${currentBook.book.id}`,
    });
  }

  if (nextChapter) {
    suggestions.push({
      id: "next-chapter",
      values: { chapterNumber: nextChapter.chapterNumber, chapterTitle: nextChapter.chapterTitle ?? "" },
      actionTo: `/library/read/${nextChapter.bookId}`,
    });
  }

  if (plan && plan.due_flashcard_ids.length > 0) {
    suggestions.push({
      id: "review-session",
      values: { count: plan.due_flashcard_ids.length },
      actionTo: "/library/flashcards",
    });
  }

  if (isReadingFatigueLikely(todayMinutes)) {
    suggestions.push({
      id: "fatigue-break",
      values: { minutes: todayMinutes },
      actionTo: "/library/librarian",
    });
  }

  const challengeRec = recommendations.find((r) => r.recommendation_type === "challenge");
  if (challengeRec) {
    suggestions.push({
      id: "recommend-challenge",
      values: { title: challengeRec.title },
      actionTo: "/library/challenges",
    });
  }

  return { suggestions };
}
