/**
 * LibraryAudioPlayerContext — the audio player engine. Mounted once in
 * App.tsx, above <AppRoutes>, alongside a hidden <audio> element and the
 * always-visible <LibraryMiniPlayer/> — both render as SIBLINGS of the
 * whole routed app, so navigating between pages never unmounts playback
 * (Layout.tsx itself remounts per route, confirmed during Phase 7 planning,
 * so this could not live there).
 *
 * Chapters vs. legacy single-file: if the audiobook has
 * library_audiobook_chapters rows, chapter navigation swaps the <audio>
 * src between per-chapter signed URLs; if it has none (today's seed data,
 * or any audiobook generated before Phase 7), the audiobook's own
 * audio_file_id is played as one implicit chapter — full backward
 * compatibility.
 *
 * Equalizer/volume-boost: one AudioContext + one MediaElementAudioSourceNode
 * are created lazily (first play(), inside a user gesture, per browser
 * autoplay policy) and EXACTLY once per <audio> element (a second
 * createMediaElementSource() call on the same element throws) — guarded by
 * audioGraphInitRef. Basic 3-band graph (lowshelf/peaking/highshelf) + a
 * boost GainNode, not a professional parametric EQ (documented scope
 * boundary).
 *
 * Listening-time tracking (record_library_listening_heartbeat) is
 * deliberately separate from position tracking (useAudiobookProgress) —
 * seeking must never count as new listening time, only accumulated
 * wall-clock time spent actually playing does, throttled to ~one RPC call
 * per 20 seconds of active playback.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchAudiobookById } from "@/services/library/audiobooks";
import { fetchChaptersForAudiobook } from "@/services/library/audiobookChapters";
import { fetchBookFileById, getSignedBookFileUrl } from "@/services/library/readerFiles";
import { recordListeningHeartbeat } from "@/services/library/listeningStats";
import { logLibraryAnalyticsEvent } from "@/services/library/analytics";
import { useAudiobookProgress } from "@/hooks/library/useAudiobookProgress";
import type { LibraryAudiobookRow, LibraryAudiobookChapterRow } from "@/lib/types/library-audiobook";
import type { LibraryLastPositionAudio } from "@/lib/types/library-reader";

export type RepeatMode = "off" | "one" | "all";

export interface EqBands {
  bass: number; // dB, -12..12
  mid: number;
  treble: number;
}

const DEFAULT_EQ: EqBands = { bass: 0, mid: 0, treble: 0 };
const HEARTBEAT_INTERVAL_SECONDS = 20;
const POSITION_SAVE_INTERVAL_SECONDS = 5;
const DEVICE_ID_KEY = "visionex:library:device-id";

function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return "unknown-device";
  }
}

interface LibraryAudioPlayerState {
  bookId: string | null;
  audiobookId: string | null;
  audiobook: LibraryAudiobookRow | null;
  chapters: LibraryAudiobookChapterRow[];
  currentChapterIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  positionSeconds: number;
  durationSeconds: number;
  playbackRate: number;
  volume: number;
  volumeBoost: number;
  eq: EqBands;
  repeatMode: RepeatMode;
  shuffle: boolean;
  sleepTimerEndsAt: number | null;
}

interface LibraryAudioPlayerContextValue extends LibraryAudioPlayerState {
  play: (bookId: string, audiobookId: string) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  seek: (deltaSeconds: number) => void;
  seekTo: (seconds: number) => void;
  setRate: (rate: number) => void;
  setVolume: (v: number) => void;
  setVolumeBoost: (v: number) => void;
  setEqBand: (band: keyof EqBands, value: number) => void;
  setRepeatMode: (mode: RepeatMode) => void;
  toggleShuffle: () => void;
  nextChapter: () => Promise<void>;
  prevChapter: () => Promise<void>;
  jumpToChapter: (index: number) => Promise<void>;
  setSleepTimer: (minutes: number | null) => void;
}

const LibraryAudioPlayerContext = createContext<LibraryAudioPlayerContextValue | null>(null);

const SPEED_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export function clampSpeed(rate: number): number {
  return SPEED_STEPS.reduce((closest, step) => (Math.abs(step - rate) < Math.abs(closest - rate) ? step : closest), 1);
}

export function LibraryAudioPlayerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<LibraryAudioPlayerState>({
    bookId: null,
    audiobookId: null,
    audiobook: null,
    chapters: [],
    currentChapterIndex: 0,
    isPlaying: false,
    isLoading: false,
    error: null,
    positionSeconds: 0,
    durationSeconds: 0,
    playbackRate: 1,
    volume: 1,
    volumeBoost: 1,
    eq: DEFAULT_EQ,
    repeatMode: "off",
    shuffle: false,
    sleepTimerEndsAt: null,
  });

  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioGraphInitRef = useRef(false);
  const bassNodeRef = useRef<BiquadFilterNode | null>(null);
  const midNodeRef = useRef<BiquadFilterNode | null>(null);
  const trebleNodeRef = useRef<BiquadFilterNode | null>(null);
  const boostGainRef = useRef<GainNode | null>(null);
  const sleepTimerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const lastHeartbeatFlushRef = useRef(0); // accumulated seconds since last flush
  const lastPositionSaveAtRef = useRef(0); // ms timestamp
  const lastTickAtRef = useRef<number | null>(null); // ms timestamp of last "playing" tick

  const { updatePosition } = useAudiobookProgress(state.bookId ?? undefined);

  const ensureAudioGraph = useCallback(() => {
    if (audioGraphInitRef.current || !audioRef.current) return;
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaElementSource(audioRef.current);
      const bass = ctx.createBiquadFilter();
      bass.type = "lowshelf";
      bass.frequency.value = 200;
      const mid = ctx.createBiquadFilter();
      mid.type = "peaking";
      mid.frequency.value = 1000;
      mid.Q.value = 0.8;
      const treble = ctx.createBiquadFilter();
      treble.type = "highshelf";
      treble.frequency.value = 3000;
      const boost = ctx.createGain();
      boost.gain.value = 1;

      source.connect(bass).connect(mid).connect(treble).connect(boost).connect(ctx.destination);

      audioContextRef.current = ctx;
      bassNodeRef.current = bass;
      midNodeRef.current = mid;
      trebleNodeRef.current = treble;
      boostGainRef.current = boost;
      audioGraphInitRef.current = true;
    } catch (err) {
      console.warn("Failed to initialize audio EQ graph:", err);
    }
  }, []);

  const resolveSrcForChapterIndex = useCallback(
    async (index: number, chapters: LibraryAudiobookChapterRow[], audiobook: LibraryAudiobookRow): Promise<{ src: string; duration: number } | null> => {
      if (chapters.length > 0) {
        const chapter = chapters[index];
        if (!chapter?.audio_file_id) return null;
        const file = await fetchBookFileById(chapter.audio_file_id);
        if (!file) return null;
        const url = await getSignedBookFileUrl(file.storage_path, "library-audiobooks");
        return url ? { src: url, duration: chapter.duration_seconds } : null;
      }
      if (!audiobook.audio_file_id) return null;
      const file = await fetchBookFileById(audiobook.audio_file_id);
      if (!file) return null;
      const url = await getSignedBookFileUrl(file.storage_path, "library-audiobooks");
      return url ? { src: url, duration: audiobook.duration_seconds } : null;
    },
    []
  );

  const play = useCallback(
    async (bookId: string, audiobookId: string) => {
      setState((s) => ({ ...s, isLoading: true, error: null }));

      try {
        const [audiobook, chapters] = await Promise.all([fetchAudiobookById(audiobookId), fetchChaptersForAudiobook(audiobookId)]);
        if (!audiobook) throw new Error("Audiobook not found");

        let resumeChapterIndex = 0;
        let resumePositionSeconds = 0;
        let resumeRate = 1;

        if (user) {
          const { data: progressRow } = await supabase
            .from("library_reading_progress")
            .select("last_position")
            .eq("user_id", user.id)
            .eq("book_id", bookId)
            .maybeSingle();
          const lastPosition = (progressRow?.last_position ?? {}) as Partial<LibraryLastPositionAudio>;
          resumePositionSeconds = lastPosition.position_seconds ?? 0;
          resumeRate = lastPosition.playback_rate ?? 1;
          if (chapters.length > 0 && lastPosition.chapter_id) {
            const idx = chapters.findIndex((c) => c.id === lastPosition.chapter_id);
            if (idx >= 0) resumeChapterIndex = idx;
          }
        }

        const resolved = await resolveSrcForChapterIndex(resumeChapterIndex, chapters, audiobook);
        if (!resolved) throw new Error("This audiobook has no playable audio yet");

        setState((s) => ({
          ...s,
          bookId,
          audiobookId,
          audiobook,
          chapters,
          currentChapterIndex: resumeChapterIndex,
          durationSeconds: resolved.duration,
          playbackRate: resumeRate,
          isLoading: false,
        }));

        if (audioRef.current) {
          audioRef.current.src = resolved.src;
          audioRef.current.playbackRate = resumeRate;
          audioRef.current.currentTime = resumePositionSeconds;
          ensureAudioGraph();
          await audioRef.current.play();
        }

        void logLibraryAnalyticsEvent("listening_started", { userId: user?.id ?? null, entityType: "book", entityId: bookId });
      } catch (err) {
        setState((s) => ({ ...s, isLoading: false, error: err instanceof Error ? err.message : String(err) }));
      }
    },
    [user, resolveSrcForChapterIndex, ensureAudioGraph]
  );

  const pause = useCallback(() => {
    audioRef.current?.pause();
    void logLibraryAnalyticsEvent("playback_paused", { userId: user?.id ?? null, entityType: "book", entityId: state.bookId ?? undefined });
  }, [user, state.bookId]);

  const resume = useCallback(() => {
    void audioRef.current?.play();
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.src = "";
    setState((s) => ({
      ...s,
      bookId: null,
      audiobookId: null,
      audiobook: null,
      chapters: [],
      currentChapterIndex: 0,
      isPlaying: false,
      positionSeconds: 0,
      durationSeconds: 0,
      sleepTimerEndsAt: null,
    }));
    if (sleepTimerIntervalRef.current) {
      clearInterval(sleepTimerIntervalRef.current);
      sleepTimerIntervalRef.current = null;
    }
  }, []);

  const seekTo = useCallback((seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, seconds);
  }, []);

  const seek = useCallback(
    (deltaSeconds: number) => {
      if (!audioRef.current) return;
      seekTo(audioRef.current.currentTime + deltaSeconds);
    },
    [seekTo]
  );

  const setRate = useCallback((rate: number) => {
    const clamped = clampSpeed(rate);
    if (audioRef.current) audioRef.current.playbackRate = clamped;
    setState((s) => ({ ...s, playbackRate: clamped }));
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v));
    if (audioRef.current) audioRef.current.volume = clamped;
    setState((s) => ({ ...s, volume: clamped }));
  }, []);

  const setVolumeBoost = useCallback((v: number) => {
    const clamped = Math.min(3, Math.max(1, v));
    if (boostGainRef.current) boostGainRef.current.gain.value = clamped;
    setState((s) => ({ ...s, volumeBoost: clamped }));
  }, []);

  const setEqBand = useCallback((band: keyof EqBands, value: number) => {
    const clamped = Math.min(12, Math.max(-12, value));
    const node = band === "bass" ? bassNodeRef.current : band === "mid" ? midNodeRef.current : trebleNodeRef.current;
    if (node) node.gain.value = clamped;
    setState((s) => ({ ...s, eq: { ...s.eq, [band]: clamped } }));
  }, []);

  const setRepeatMode = useCallback((mode: RepeatMode) => setState((s) => ({ ...s, repeatMode: mode })), []);
  const toggleShuffle = useCallback(() => setState((s) => ({ ...s, shuffle: !s.shuffle })), []);

  const jumpToChapter = useCallback(
    async (index: number) => {
      setState((current) => {
        if (!current.audiobook || index < 0 || index >= Math.max(current.chapters.length, 1)) return current;
        return current;
      });
      const { audiobook, chapters } = state;
      if (!audiobook || chapters.length === 0 || index < 0 || index >= chapters.length) return;
      const resolved = await resolveSrcForChapterIndex(index, chapters, audiobook);
      if (!resolved || !audioRef.current) return;
      audioRef.current.src = resolved.src;
      audioRef.current.currentTime = 0;
      setState((s) => ({ ...s, currentChapterIndex: index, durationSeconds: resolved.duration }));
      await audioRef.current.play();
    },
    [state, resolveSrcForChapterIndex]
  );

  const nextChapter = useCallback(async () => {
    if (state.chapters.length === 0) return;
    const next = state.currentChapterIndex + 1;
    if (next < state.chapters.length) await jumpToChapter(next);
    else if (state.repeatMode === "all") await jumpToChapter(0);
  }, [state.chapters.length, state.currentChapterIndex, state.repeatMode, jumpToChapter]);

  const prevChapter = useCallback(async () => {
    if (state.chapters.length === 0) return;
    const prev = state.currentChapterIndex - 1;
    if (prev >= 0) await jumpToChapter(prev);
  }, [state.chapters.length, state.currentChapterIndex, jumpToChapter]);

  const setSleepTimer = useCallback((minutes: number | null) => {
    if (sleepTimerIntervalRef.current) {
      clearInterval(sleepTimerIntervalRef.current);
      sleepTimerIntervalRef.current = null;
    }
    if (minutes == null) {
      setState((s) => ({ ...s, sleepTimerEndsAt: null }));
      return;
    }
    const endsAt = Date.now() + minutes * 60 * 1000;
    setState((s) => ({ ...s, sleepTimerEndsAt: endsAt }));
    sleepTimerIntervalRef.current = setInterval(() => {
      setState((s) => {
        if (s.sleepTimerEndsAt != null && Date.now() >= s.sleepTimerEndsAt) {
          audioRef.current?.pause();
          if (sleepTimerIntervalRef.current) clearInterval(sleepTimerIntervalRef.current);
          return { ...s, sleepTimerEndsAt: null };
        }
        return s;
      });
    }, 1000);
  }, []);

  // ── <audio> element event wiring ──────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => {
      setState((s) => ({ ...s, isPlaying: true }));
      lastTickAtRef.current = Date.now();
    };
    const onPause = () => {
      setState((s) => ({ ...s, isPlaying: false }));
      lastTickAtRef.current = null;
    };
    const onTimeUpdate = () => {
      const now = Date.now();
      setState((s) => ({ ...s, positionSeconds: audio.currentTime }));

      if (lastTickAtRef.current != null) {
        const deltaSeconds = (now - lastTickAtRef.current) / 1000;
        lastTickAtRef.current = now;
        if (deltaSeconds > 0 && deltaSeconds < 10) {
          lastHeartbeatFlushRef.current += deltaSeconds;
          if (lastHeartbeatFlushRef.current >= HEARTBEAT_INTERVAL_SECONDS && user) {
            const toFlush = Math.round(lastHeartbeatFlushRef.current);
            lastHeartbeatFlushRef.current = 0;
            void recordListeningHeartbeat(toFlush, audio.playbackRate);
          }
        }
      }

      if (now - lastPositionSaveAtRef.current >= POSITION_SAVE_INTERVAL_SECONDS * 1000 && user) {
        lastPositionSaveAtRef.current = now;
        setState((s) => {
          if (s.bookId) {
            const chapterId = s.chapters[s.currentChapterIndex]?.id;
            void updatePosition(audio.currentTime, audio.playbackRate, chapterId, getDeviceId());
          }
          return s;
        });
      }
    };
    const onEnded = () => {
      setState((s) => {
        if (s.repeatMode === "one") {
          audio.currentTime = 0;
          void audio.play();
          return s;
        }
        return s;
      });
      if (state.repeatMode !== "one") void nextChapter();
    };
    const onError = () => {
      setState((s) => ({ ...s, error: "Playback error — the audio could not be loaded", isPlaying: false }));
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, updatePosition, nextChapter, state.repeatMode]);

  useEffect(() => {
    return () => {
      if (sleepTimerIntervalRef.current) clearInterval(sleepTimerIntervalRef.current);
      audioContextRef.current?.close().catch(() => {});
    };
  }, []);

  const value = useMemo<LibraryAudioPlayerContextValue>(
    () => ({
      ...state,
      play,
      pause,
      resume,
      stop,
      seek,
      seekTo,
      setRate,
      setVolume,
      setVolumeBoost,
      setEqBand,
      setRepeatMode,
      toggleShuffle,
      nextChapter,
      prevChapter,
      jumpToChapter,
      setSleepTimer,
    }),
    [state, play, pause, resume, stop, seek, seekTo, setRate, setVolume, setVolumeBoost, setEqBand, setRepeatMode, toggleShuffle, nextChapter, prevChapter, jumpToChapter, setSleepTimer]
  );

  return (
    <LibraryAudioPlayerContext.Provider value={value}>
      {children}
      <audio ref={audioRef} preload="metadata" />
    </LibraryAudioPlayerContext.Provider>
  );
}

export function useLibraryAudioPlayer(): LibraryAudioPlayerContextValue {
  const ctx = useContext(LibraryAudioPlayerContext);
  if (!ctx) throw new Error("useLibraryAudioPlayer must be used within a LibraryAudioPlayerProvider");
  return ctx;
}

export { SPEED_STEPS };
