import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as engagement from "@/features/visionkids/services/stories/engagement";
import type { DownloadFormat } from "@/features/visionkids/types/stories.types";

// ── Bookmarks ────────────────────────────────────────────────────────────
export function useBookmarks(storyId?: string) {
  return useQuery({ queryKey: ["kids", "bookmarks", storyId ?? "all"], queryFn: () => engagement.fetchBookmarks(storyId) });
}

export function useAddBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ storyId, pageNumber, label }: { storyId: string; pageNumber: number; label?: string }) =>
      engagement.addBookmark(storyId, pageNumber, label),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids", "bookmarks"] }),
  });
}

export function useRemoveBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => engagement.removeBookmark(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids", "bookmarks"] }),
  });
}

// ── Highlights ───────────────────────────────────────────────────────────
export function useHighlights(storyId: string | undefined) {
  return useQuery({ queryKey: ["kids", "highlights", storyId], queryFn: () => engagement.fetchHighlights(storyId!), enabled: !!storyId });
}

export function useAddHighlight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ storyId, pageNumber, text, color }: { storyId: string; pageNumber: number; text: string; color?: string }) =>
      engagement.addHighlight(storyId, pageNumber, text, color),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["kids", "highlights", vars.storyId] }),
  });
}

export function useRemoveHighlight(storyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => engagement.removeHighlight(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids", "highlights", storyId] }),
  });
}

// ── Notes ────────────────────────────────────────────────────────────────
export function useNotes(storyId: string | undefined) {
  return useQuery({ queryKey: ["kids", "notes", storyId], queryFn: () => engagement.fetchNotes(storyId!), enabled: !!storyId });
}

export function useAddNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ storyId, pageNumber, content }: { storyId: string; pageNumber: number; content: string }) =>
      engagement.addNote(storyId, pageNumber, content),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["kids", "notes", vars.storyId] }),
  });
}

export function useRemoveNote(storyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => engagement.removeNote(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids", "notes", storyId] }),
  });
}

// ── Favorites ────────────────────────────────────────────────────────────
export function useFavorites() {
  return useQuery({ queryKey: ["kids", "favorites"], queryFn: engagement.fetchFavorites });
}

export function useIsFavorite(storyId: string | undefined) {
  return useQuery({
    queryKey: ["kids", "is-favorite", storyId],
    queryFn: () => engagement.isFavorite(storyId!),
    enabled: !!storyId,
  });
}

export function useToggleFavorite(storyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (next: boolean) => engagement.toggleFavorite(storyId, next),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids", "favorites"] });
      qc.invalidateQueries({ queryKey: ["kids", "is-favorite", storyId] });
    },
  });
}

// ── Ratings ──────────────────────────────────────────────────────────────
export function useMyRating(storyId: string | undefined) {
  return useQuery({ queryKey: ["kids", "my-rating", storyId], queryFn: () => engagement.fetchMyRating(storyId!), enabled: !!storyId });
}

export function useRateStory(storyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rating, review }: { rating: number; review?: string }) => engagement.rateStory(storyId, rating, review),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids", "my-rating", storyId] });
      qc.invalidateQueries({ queryKey: ["kids", "story"] });
    },
  });
}

// ── Downloads ────────────────────────────────────────────────────────────
export function useDownloads() {
  return useQuery({ queryKey: ["kids", "downloads"], queryFn: engagement.fetchDownloads });
}

export function useLogDownload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ storyId, format }: { storyId: string; format: DownloadFormat }) => engagement.logDownload(storyId, format),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids", "downloads"] }),
  });
}

// ── Reading progress / history / continue reading ───────────────────────
export function useReadingProgress(storyId: string | undefined) {
  return useQuery({
    queryKey: ["kids", "reading-progress", storyId],
    queryFn: () => engagement.fetchReadingProgress(storyId!),
    enabled: !!storyId,
  });
}

export function useContinueReading() {
  return useQuery({ queryKey: ["kids", "continue-reading"], queryFn: engagement.fetchContinueReading });
}

export function useReadingHistory() {
  return useQuery({ queryKey: ["kids", "reading-history"], queryFn: engagement.fetchReadingHistory });
}

export function useSaveReadingProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: engagement.saveReadingProgress,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["kids", "reading-progress", vars.storyId] });
      qc.invalidateQueries({ queryKey: ["kids", "continue-reading"] });
      qc.invalidateQueries({ queryKey: ["kids", "reading-history"] });
      qc.invalidateQueries({ queryKey: ["kids", "reading-stats"] });
    },
  });
}

export function useReadingStats() {
  return useQuery({ queryKey: ["kids", "reading-stats"], queryFn: engagement.fetchReadingStats });
}

// ── Achievements / VX ────────────────────────────────────────────────────
export function useMyAchievements() {
  return useQuery({ queryKey: ["kids", "achievements"], queryFn: engagement.fetchMyAchievements });
}

export function useAllAchievements() {
  return useQuery({ queryKey: ["kids", "all-achievements"], queryFn: engagement.fetchAllAchievements, staleTime: 10 * 60 * 1000 });
}

export function useAwardAchievement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => engagement.awardAchievement(key),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids", "achievements"] }),
  });
}

export function useAwardXp() {
  return useMutation({ mutationFn: ({ amount, reason }: { amount: number; reason: string }) => engagement.awardXp(amount, reason) });
}
