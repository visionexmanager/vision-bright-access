/**
 * useAiReadingPreferences — the single source of truth for the AI Reading
 * Assistant's per-user preferences (reading-level mode, read-aloud voice/
 * speed/pitch, last-used translation language). Every other AI hook
 * (useLibraryAiAssistant, useLibraryAiChat, useSmartSummary) reads
 * `readingMode` from here so no call site needs to remember to pass it.
 *
 * Local-first with debounced remote sync, mirroring useReaderSettings.ts's
 * established pattern exactly: hydrates from localStorage synchronously on
 * mount (zero-flicker), reconciles with the Supabase row once it loads
 * (remote wins — the assumption is the remote copy is the most recently
 * synced across devices), debounces (~800ms) writes to Supabase while
 * writing to localStorage synchronously on every change.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchAiPreferences, saveAiPreferences } from "@/services/library/aiPreferences";
import { DEFAULT_AI_PREFERENCES, type AiPreferencesRow, type AiReadingMode } from "@/lib/types/library-ai";

type LocalPrefs = Omit<AiPreferencesRow, "user_id" | "updated_at">;

const LOCAL_KEY = "library:ai-preferences";
const DEBOUNCE_MS = 800;

function readLocal(): LocalPrefs {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? { ...DEFAULT_AI_PREFERENCES, ...JSON.parse(raw) } : DEFAULT_AI_PREFERENCES;
  } catch {
    return DEFAULT_AI_PREFERENCES;
  }
}

function writeLocal(prefs: LocalPrefs) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage unavailable (private mode etc.) — preferences still work for this session via React state.
  }
}

export function useAiReadingPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.id;

  const [prefs, setPrefs] = useState<LocalPrefs>(readLocal);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconciledRef = useRef(false);

  const { data: remotePrefs } = useQuery({
    queryKey: queryKeys.library.aiPreferences(uid ?? ""),
    queryFn: () => fetchAiPreferences(uid!),
    enabled: !!uid,
  });

  useEffect(() => {
    if (remotePrefs && !reconciledRef.current) {
      reconciledRef.current = true;
      const merged = { ...DEFAULT_AI_PREFERENCES, ...remotePrefs };
      setPrefs(merged);
      writeLocal(merged);
    }
  }, [remotePrefs]);

  const update = useCallback(
    (patch: Partial<LocalPrefs>) => {
      setPrefs((prev) => {
        const next = { ...prev, ...patch };
        writeLocal(next);
        if (uid) {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            void saveAiPreferences(uid, next).then(() => {
              queryClient.invalidateQueries({ queryKey: queryKeys.library.aiPreferences(uid) });
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

  return {
    readingMode: prefs.reading_mode,
    voice: prefs.voice,
    speed: prefs.speech_speed,
    pitch: prefs.speech_pitch,
    lastTranslationLanguage: prefs.last_translation_language,
    setReadingMode: (reading_mode: AiReadingMode) => update({ reading_mode }),
    setVoice: (voice: string) => update({ voice }),
    setSpeed: (speech_speed: number) => update({ speech_speed }),
    setPitch: (speech_pitch: number) => update({ speech_pitch }),
    setLastTranslationLanguage: (last_translation_language: string) => update({ last_translation_language }),
  };
}
