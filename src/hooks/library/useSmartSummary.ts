/**
 * useSmartSummary — generates (or fetches the cached copy of) a summary at
 * a given scope/length. The edge function itself checks library_ai_summaries
 * before calling the model, so a repeat request for the same
 * (book, chapter, scope, length) combination is a cheap DB read, not a new
 * LLM call — this hook just calls it and reports whether the result was a
 * cache hit via `result.cached`.
 */

import { useCallback, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { runLibraryAiAssistant } from "@/services/library/aiAssistant";
import { useAiReadingPreferences } from "@/hooks/library/useAiReadingPreferences";
import type { SmartSummaryResult } from "@/lib/types/library-ai";

export function useSmartSummary(bookId: string | undefined) {
  const { readingMode } = useAiReadingPreferences();
  const [result, setResult] = useState<SmartSummaryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const generate = useCallback(
    async (scope: "page" | "chapter" | "book", length: "quick" | "medium" | "detailed", chapterId?: string) => {
      if (!bookId) return;
      setIsLoading(true);
      try {
        const res = await runLibraryAiAssistant({ mode: "smart-summary", book_id: bookId, chapter_id: chapterId, scope, length, readingMode });
        if (res.mode === "smart-summary") setResult(res.result);
      } catch (err) {
        toast({ title: "Couldn't generate summary", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    },
    [bookId, readingMode]
  );

  return { result, isLoading, generate };
}
