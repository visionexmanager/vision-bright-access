/**
 * Library — Personal Shelf Local Store (Phase 1, temporary)
 *
 * Client-only (localStorage) persistence for My Library, Favorites, Continue
 * Reading, Downloads, and Reading Lists — same honesty contract as Academy's
 * *LocalStore.ts files (e.g. scholarshipLocalStore.ts): data does not sync
 * across devices and is lost if the user clears site data. Shape mirrors the
 * planned Supabase rows (library-user-shelf.ts) so migrating to real
 * persistence later is a drop-in swap of these functions, not a redesign of
 * callers (src/hooks/library/*.ts).
 */

import { readJSON, writeJSON } from "../storage/localStorageUtils";

const SHELF_KEY = "library:my-shelf";
const FAVORITES_KEY = "library:favorites";
const PROGRESS_KEY = "library:reading-progress";
const DOWNLOADS_KEY = "library:downloads";

// ── My Library (shelf) ────────────────────────────────────────────────────

export function getShelfBookIds(userId: string): string[] {
  const all = readJSON<Record<string, string[]>>(SHELF_KEY, {});
  return all[userId] ?? [];
}

export function toggleShelfBookLocal(userId: string, bookId: string): boolean {
  const all = readJSON<Record<string, string[]>>(SHELF_KEY, {});
  const current = all[userId] ?? [];
  const isOnShelf = current.includes(bookId);
  all[userId] = isOnShelf ? current.filter((id) => id !== bookId) : [...current, bookId];
  writeJSON(SHELF_KEY, all);
  return !isOnShelf;
}

// ── Favorites ──────────────────────────────────────────────────────────────

export function getFavoriteBookIds(userId: string): string[] {
  const all = readJSON<Record<string, string[]>>(FAVORITES_KEY, {});
  return all[userId] ?? [];
}

export function toggleFavoriteBookLocal(userId: string, bookId: string): boolean {
  const all = readJSON<Record<string, string[]>>(FAVORITES_KEY, {});
  const current = all[userId] ?? [];
  const isFavorite = current.includes(bookId);
  all[userId] = isFavorite ? current.filter((id) => id !== bookId) : [...current, bookId];
  writeJSON(FAVORITES_KEY, all);
  return !isFavorite;
}

// ── Continue Reading (progress) ───────────────────────────────────────────

export interface LocalReadingProgress {
  percent_complete: number;
  last_opened_at: string;
}

export function getReadingProgress(userId: string): Record<string, LocalReadingProgress> {
  const all = readJSON<Record<string, Record<string, LocalReadingProgress>>>(PROGRESS_KEY, {});
  return all[userId] ?? {};
}

export function setReadingProgressLocal(userId: string, bookId: string, percentComplete: number): void {
  const all = readJSON<Record<string, Record<string, LocalReadingProgress>>>(PROGRESS_KEY, {});
  const userProgress = all[userId] ?? {};
  userProgress[bookId] = { percent_complete: percentComplete, last_opened_at: new Date().toISOString() };
  all[userId] = userProgress;
  writeJSON(PROGRESS_KEY, all);
}

// ── Downloads ──────────────────────────────────────────────────────────────

export function getDownloadedBookIds(userId: string): string[] {
  const all = readJSON<Record<string, string[]>>(DOWNLOADS_KEY, {});
  return all[userId] ?? [];
}

export function toggleDownloadLocal(userId: string, bookId: string): boolean {
  const all = readJSON<Record<string, string[]>>(DOWNLOADS_KEY, {});
  const current = all[userId] ?? [];
  const isDownloaded = current.includes(bookId);
  all[userId] = isDownloaded ? current.filter((id) => id !== bookId) : [...current, bookId];
  writeJSON(DOWNLOADS_KEY, all);
  return !isDownloaded;
}

// Reading Lists moved to real Supabase persistence (Phase 11) — see
// services/library/readingLists.ts.
