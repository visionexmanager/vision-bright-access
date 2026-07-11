/**
 * useLessonProgress — playback progress, notes, and bookmarks for a lesson
 * (Phase 1 backend, replaces lessonLocalStore.ts for the learning player).
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchCourseProgress,
  markLessonProgress,
  fetchLessonNotes,
  saveLessonNote,
  removeLessonNote,
  fetchLessonBookmarks,
  addLessonBookmark,
  removeLessonBookmark,
} from "@/services/academy/lms";
import type { AcademyLessonProgressRow } from "@/lib/types/academy-lms";

export function useCourseProgress(courseId: string | undefined) {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.academy.lms.progress(user?.id ?? "", courseId ?? ""),
    queryFn: () => fetchCourseProgress(user!.id, courseId!),
    enabled: !!user && !!courseId,
  });
  return { progress: data ?? [], isLoading };
}

export function useMarkLessonProgress(courseId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (params: { lessonId: string; update: Partial<Pick<AcademyLessonProgressRow, "completed" | "last_position_seconds">> }) =>
      markLessonProgress(user!.id, courseId!, params.lessonId, params.update),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.academy.lms.progress(user?.id ?? "", courseId ?? "") });
      queryClient.invalidateQueries({ queryKey: queryKeys.academy.lms.enrollment(user?.id ?? "", courseId ?? "") });
      queryClient.invalidateQueries({ queryKey: queryKeys.academy.lms.myEnrollments(user?.id ?? "") });
    },
  });

  return { markProgress: mutateAsync, isSaving: isPending };
}

export function useLessonNotes(lessonId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const enabled = !!user && !!lessonId;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.academy.lms.notes(user?.id ?? "", lessonId ?? ""),
    queryFn: () => fetchLessonNotes(user!.id, lessonId!),
    enabled,
  });

  const addNote = useMutation({
    mutationFn: (params: { content: string; timestampSeconds?: number | null }) =>
      saveLessonNote({ user_id: user!.id, lesson_id: lessonId!, content: params.content, timestamp_seconds: params.timestampSeconds ?? null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.academy.lms.notes(user?.id ?? "", lessonId ?? "") }),
  });

  const deleteNote = useMutation({
    mutationFn: (noteId: string) => removeLessonNote(noteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.academy.lms.notes(user?.id ?? "", lessonId ?? "") }),
  });

  return { notes: data ?? [], isLoading, addNote: addNote.mutateAsync, deleteNote: deleteNote.mutateAsync };
}

export function useLessonBookmarks(lessonId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const enabled = !!user && !!lessonId;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.academy.lms.bookmarks(user?.id ?? "", lessonId ?? ""),
    queryFn: () => fetchLessonBookmarks(user!.id, lessonId!),
    enabled,
  });

  const addBookmark = useMutation({
    mutationFn: (params: { timestampSeconds: number | null; label?: string | null }) =>
      addLessonBookmark(user!.id, lessonId!, params.timestampSeconds, params.label ?? null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.academy.lms.bookmarks(user?.id ?? "", lessonId ?? "") }),
  });

  const deleteBookmark = useMutation({
    mutationFn: (bookmarkId: string) => removeLessonBookmark(bookmarkId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.academy.lms.bookmarks(user?.id ?? "", lessonId ?? "") }),
  });

  return { bookmarks: data ?? [], isLoading, addBookmark: addBookmark.mutateAsync, deleteBookmark: deleteBookmark.mutateAsync };
}
