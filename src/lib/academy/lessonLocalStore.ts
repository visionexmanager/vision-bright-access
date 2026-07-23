/**
 * Academy — Lesson Local Store (Phase 3, temporary)
 *
 * Client-only (localStorage) persistence for lesson progress, notes, and
 * bookmarks. This is an honest stand-in until academy_lesson_progress /
 * academy_lesson_notes / academy_lesson_bookmarks (see academy-lms.ts) are
 * migrated and src/services/academy/lms.ts is wired to Supabase — data here
 * does not sync across devices and is lost if the user clears site data.
 *
 * Shape mirrors the future DB rows so migrating to real persistence later is
 * a drop-in swap of the read/write functions, not a redesign of callers.
 */

import type { AcademyLessonNoteRow, AcademyLessonBookmarkRow, AcademyLessonProgressRow } from "@/lib/types/academy-lms";
import { readJSON, writeJSON } from "../storage/localStorageUtils";

const PROGRESS_KEY = "academy:lesson-progress";
const NOTES_KEY = "academy:lesson-notes";
const BOOKMARKS_KEY = "academy:lesson-bookmarks";

// ── Progress ──────────────────────────────────────────────────────────────────

type ProgressMap = Record<string, AcademyLessonProgressRow>; // lessonId -> row

export function getLessonProgress(lessonId: string): AcademyLessonProgressRow | null {
  const map = readJSON<ProgressMap>(PROGRESS_KEY, {});
  return map[lessonId] ?? null;
}

export function getCourseProgress(courseId: string): AcademyLessonProgressRow[] {
  const map = readJSON<ProgressMap>(PROGRESS_KEY, {});
  return Object.values(map).filter((p) => p.course_id === courseId);
}

export function setLessonProgress(
  userId: string,
  courseId: string,
  lessonId: string,
  update: Partial<Pick<AcademyLessonProgressRow, "completed" | "last_position_seconds">>
): AcademyLessonProgressRow {
  const map = readJSON<ProgressMap>(PROGRESS_KEY, {});
  const existing = map[lessonId];
  const next: AcademyLessonProgressRow = {
    user_id: userId,
    lesson_id: lessonId,
    course_id: courseId,
    completed: existing?.completed ?? false,
    last_position_seconds: existing?.last_position_seconds ?? 0,
    ...existing,
    ...update,
    updated_at: new Date().toISOString(),
  };
  map[lessonId] = next;
  writeJSON(PROGRESS_KEY, map);
  return next;
}

// ── Notes ─────────────────────────────────────────────────────────────────────

type NotesMap = Record<string, AcademyLessonNoteRow[]>; // lessonId -> notes

export function getLessonNotesLocal(lessonId: string): AcademyLessonNoteRow[] {
  const map = readJSON<NotesMap>(NOTES_KEY, {});
  return map[lessonId] ?? [];
}

export function addLessonNoteLocal(
  userId: string,
  lessonId: string,
  content: string,
  timestampSeconds: number | null = null
): AcademyLessonNoteRow {
  const map = readJSON<NotesMap>(NOTES_KEY, {});
  const note: AcademyLessonNoteRow = {
    id: crypto.randomUUID(),
    user_id: userId,
    lesson_id: lessonId,
    timestamp_seconds: timestampSeconds,
    content,
    created_at: new Date().toISOString(),
  };
  map[lessonId] = [...(map[lessonId] ?? []), note];
  writeJSON(NOTES_KEY, map);
  return note;
}

export function removeLessonNoteLocal(lessonId: string, noteId: string): void {
  const map = readJSON<NotesMap>(NOTES_KEY, {});
  map[lessonId] = (map[lessonId] ?? []).filter((n) => n.id !== noteId);
  writeJSON(NOTES_KEY, map);
}

/** Aggregates notes across every lesson for a "My Notes" student-wide view — same rows LessonNotesPanel already writes, just flattened. */
export function getAllNotesForUser(userId: string): AcademyLessonNoteRow[] {
  const map = readJSON<NotesMap>(NOTES_KEY, {});
  return Object.values(map).flat().filter((n) => n.user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// ── Bookmarks ─────────────────────────────────────────────────────────────────

type BookmarksMap = Record<string, AcademyLessonBookmarkRow[]>; // lessonId -> bookmarks

export function getLessonBookmarksLocal(lessonId: string): AcademyLessonBookmarkRow[] {
  const map = readJSON<BookmarksMap>(BOOKMARKS_KEY, {});
  return map[lessonId] ?? [];
}

export function addLessonBookmarkLocal(
  userId: string,
  lessonId: string,
  timestampSeconds: number | null,
  label: string | null = null
): AcademyLessonBookmarkRow {
  const map = readJSON<BookmarksMap>(BOOKMARKS_KEY, {});
  const bookmark: AcademyLessonBookmarkRow = {
    id: crypto.randomUUID(),
    user_id: userId,
    lesson_id: lessonId,
    timestamp_seconds: timestampSeconds,
    label,
    created_at: new Date().toISOString(),
  };
  map[lessonId] = [...(map[lessonId] ?? []), bookmark];
  writeJSON(BOOKMARKS_KEY, map);
  return bookmark;
}

export function removeLessonBookmarkLocal(lessonId: string, bookmarkId: string): void {
  const map = readJSON<BookmarksMap>(BOOKMARKS_KEY, {});
  map[lessonId] = (map[lessonId] ?? []).filter((b) => b.id !== bookmarkId);
  writeJSON(BOOKMARKS_KEY, map);
}

/** Aggregates bookmarks across every lesson for a "My Bookmarks" student-wide view — same rows LessonBookmarksPanel already writes, just flattened. */
export function getAllBookmarksForUser(userId: string): AcademyLessonBookmarkRow[] {
  const map = readJSON<BookmarksMap>(BOOKMARKS_KEY, {});
  return Object.values(map).flat().filter((b) => b.user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Aggregates raw lesson progress rows across every course for a "My Courses" / study-calendar view. */
export function getAllProgressForUser(userId: string): AcademyLessonProgressRow[] {
  const map = readJSON<ProgressMap>(PROGRESS_KEY, {});
  return Object.values(map).filter((p) => p.user_id === userId);
}
