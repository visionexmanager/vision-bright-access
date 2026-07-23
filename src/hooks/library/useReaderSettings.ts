/**
 * useReaderSettings — reading preferences (font/theme/spacing/margins/
 * scroll mode/page layout), book-independent, persisted to the user's
 * account for cross-device sync. Local-first with debounced remote sync:
 * hydrates from localStorage synchronously on mount (zero-flicker first
 * paint), reconciles with the Supabase row once it loads (remote wins, on
 * the assumption the remote copy is the most-recently-synced-across-devices
 * one), and debounces (~800ms) writes to Supabase while writing to
 * localStorage synchronously on every change (instant, works offline).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchReaderSettings, saveReaderSettings } from "@/services/library/readerSettings";
import { DEFAULT_READER_SETTINGS, type LibraryReaderSettings } from "@/lib/types/library-reader";

const LOCAL_KEY = "library:reader-settings";
const DEBOUNCE_MS = 800;

function readLocal(): LibraryReaderSettings {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? { ...DEFAULT_READER_SETTINGS, ...JSON.parse(raw) } : DEFAULT_READER_SETTINGS;
  } catch {
    return DEFAULT_READER_SETTINGS;
  }
}

function writeLocal(settings: LibraryReaderSettings) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(settings));
  } catch {
    // localStorage unavailable (private mode etc.) — settings still work for this session via React state.
  }
}

export function useReaderSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.id;

  const [settings, setSettings] = useState<LibraryReaderSettings>(readLocal);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconciledRef = useRef(false);

  const { data: remoteSettings } = useQuery({
    queryKey: queryKeys.library.readerSettings(uid ?? ""),
    queryFn: () => fetchReaderSettings(uid!),
    enabled: !!uid,
  });

  useEffect(() => {
    if (remoteSettings && !reconciledRef.current) {
      reconciledRef.current = true;
      const merged = { ...DEFAULT_READER_SETTINGS, ...remoteSettings };
      setSettings(merged);
      writeLocal(merged);
    }
  }, [remoteSettings]);

  const updateSettings = useCallback(
    (patch: Partial<LibraryReaderSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        writeLocal(next);
        if (uid) {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            void saveReaderSettings(uid, next).then(() => {
              queryClient.invalidateQueries({ queryKey: queryKeys.library.readerSettings(uid) });
            });
          }, DEBOUNCE_MS);
        }
        return next;
      });
    },
    [uid, queryClient]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { settings, updateSettings };
}
