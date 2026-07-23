/**
 * useLibrarianPreferences — the AI Personal Librarian's "AI Memory" surface.
 * Reads/writes the SAME library_ai_preferences row and cache key as
 * useAiReadingPreferences (this phase only ADDED columns to that table,
 * it didn't create a new one) — sharing the query key keeps both hooks'
 * caches in sync automatically without any cross-invalidation plumbing.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchAiPreferences, saveAiPreferences } from "@/services/library/aiPreferences";
import { toast } from "@/hooks/use-toast";
import {
  DEFAULT_AI_PREFERENCES,
  type LibraryPreferredBookLength, type LibraryLearningStyle, type LibraryPreferredReadingTime,
  type LibraryAccessibilityPreferences,
} from "@/lib/types/library-ai";

export function useLibrarianPreferences() {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.library.aiPreferences(uid),
    queryFn: () => fetchAiPreferences(uid),
    enabled: !!user,
  });

  const prefs = { ...DEFAULT_AI_PREFERENCES, ...data };

  const save = async (patch: Partial<typeof prefs>) => {
    if (!user) return;
    try {
      await saveAiPreferences(user.id, patch);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.aiPreferences(uid) });
    } catch (err) {
      toast({ title: "Couldn't save preference", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return {
    isLoading,
    readingSpeedPagesPerHour: prefs.reading_speed_pages_per_hour,
    listeningSpeedPreference: prefs.listening_speed_preference,
    preferredBookLength: prefs.preferred_book_length,
    learningStyle: prefs.learning_style,
    preferredReadingTime: prefs.preferred_reading_time,
    accessibilityPreferences: prefs.accessibility_preferences,
    memoryPaused: prefs.memory_paused,
    setReadingSpeed: (reading_speed_pages_per_hour: number | null) => save({ reading_speed_pages_per_hour }),
    setListeningSpeedPreference: (listening_speed_preference: number) => save({ listening_speed_preference }),
    setPreferredBookLength: (preferred_book_length: LibraryPreferredBookLength) => save({ preferred_book_length }),
    setLearningStyle: (learning_style: LibraryLearningStyle) => save({ learning_style }),
    setPreferredReadingTime: (preferred_reading_time: LibraryPreferredReadingTime) => save({ preferred_reading_time }),
    setAccessibilityPreferences: (accessibility_preferences: LibraryAccessibilityPreferences) => save({ accessibility_preferences }),
    setMemoryPaused: (memory_paused: boolean) => save({ memory_paused, memory_paused_at: memory_paused ? new Date().toISOString() : null }),
  };
}
