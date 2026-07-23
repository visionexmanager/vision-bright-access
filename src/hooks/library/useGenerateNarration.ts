/**
 * useGenerateNarration — drives AI audiobook narration generation
 * chapter-by-chapter (never one giant call — see library-generate-narration
 * edge function's per-chapter contract). Reads the book's TEXT chapters
 * (library_chapters, via chapters.ts) as the source material, calls
 * generateChapterNarration() once per chapter in sequence, and exposes
 * progress for a dialog UI.
 */

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchChaptersForBook } from "@/services/library/chapters";
import { generateChapterNarration, type GenerateNarrationRequest } from "@/services/library/narration";

export type NarrationGenerationStatus = "idle" | "running" | "done" | "error";

export interface NarrationVoiceOptions {
  voice?: string;
  gender?: "male" | "female" | "neutral";
  dialect?: string;
  language?: string;
  speed?: number;
  emotion?: string;
}

export function useGenerateNarration(bookId: string | undefined) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<NarrationGenerationStatus>("idle");
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [totalChapters, setTotalChapters] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audiobookId, setAudiobookId] = useState<string | null>(null);

  const generate = useCallback(
    async (options: NarrationVoiceOptions) => {
      if (!bookId) return;
      setStatus("running");
      setError(null);
      setCurrentChapterIndex(0);

      try {
        const chapters = await fetchChaptersForBook(bookId);
        setTotalChapters(chapters.length);
        if (chapters.length === 0) {
          throw new Error("This book has no chapters to narrate.");
        }

        let lastAudiobookId: string | null = null;
        for (let i = 0; i < chapters.length; i++) {
          setCurrentChapterIndex(i);
          const req: GenerateNarrationRequest = { book_id: bookId, chapter_id: chapters[i].id, ...options };
          const result = await generateChapterNarration(req);
          lastAudiobookId = result.audiobook_id;
        }

        setAudiobookId(lastAudiobookId);
        setCurrentChapterIndex(chapters.length);
        setStatus("done");
        if (lastAudiobookId) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.library.audiobookChapters(lastAudiobookId) });
        }
        void queryClient.invalidateQueries({ queryKey: queryKeys.library.audiobook(bookId) });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    },
    [bookId, queryClient]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setCurrentChapterIndex(0);
    setTotalChapters(0);
    setError(null);
    setAudiobookId(null);
  }, []);

  return { status, currentChapterIndex, totalChapters, error, audiobookId, generate, reset };
}
