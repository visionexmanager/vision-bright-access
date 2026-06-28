/**
 * useWatchHistory
 *
 * Persists recently-watched TV channels to localStorage.
 * Used to show a "Recently Watched" row on the channel browser.
 */

import { useCallback } from "react";
import type { TVChannel } from "./useTVSubscription";

const STORAGE_KEY = "vx:tv:watch-history";
const MAX_ENTRIES = 20;

export type WatchHistoryEntry = {
  id:           string;
  name:         string;
  name_ar:      string;
  logo_url:     string | null;
  official_url: string | null;
  quality:      string;
  country:      string | null;
  category?:    { id: string; name: string; name_ar: string; slug: string; icon: string };
  watchedAt:    number; // Date.now()
};

function loadHistory(): WatchHistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveHistory(entries: WatchHistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {}
}

export function useWatchHistory() {
  const record = useCallback((channel: TVChannel) => {
    const existing = loadHistory().filter(e => e.id !== channel.id);
    existing.unshift({
      id:           channel.id,
      name:         channel.name,
      name_ar:      channel.name_ar,
      logo_url:     channel.logo_url,
      official_url: channel.official_url,
      quality:      channel.quality,
      country:      channel.country,
      category:     channel.category,
      watchedAt:    Date.now(),
    });
    saveHistory(existing);
  }, []);

  const getHistory = useCallback((): WatchHistoryEntry[] => loadHistory(), []);

  const clearHistory = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  return { record, getHistory, clearHistory };
}
