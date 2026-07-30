import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as logs from "@/features/visionkids/services/wellness/logs";
import type { Mood, SleepQuality } from "@/features/visionkids/types/wellness.types";

const todayIso = () => new Date().toISOString().slice(0, 10);

// ── Habits ────────────────────────────────────────────────────────────────
export function useHabitLogs(date: string = todayIso()) {
  return useQuery({ queryKey: ["kids-wellness", "habit-logs", date], queryFn: () => logs.fetchHabitLogs(date) });
}

export function useLogHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ habitSlug, date }: { habitSlug: string; date?: string }) => logs.logHabit(habitSlug, date ?? todayIso()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-wellness", "habit-logs"] });
      qc.invalidateQueries({ queryKey: ["kids-wellness", "stats"] });
    },
  });
}

// ── Mood ──────────────────────────────────────────────────────────────────
export function useMoodLogs(limit = 30) {
  return useQuery({ queryKey: ["kids-wellness", "mood-logs", limit], queryFn: () => logs.fetchMoodLogs(limit) });
}

export function useLogMood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ mood, color, note }: { mood: Mood; color?: string; note?: string }) => logs.logMood(mood, color, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-wellness", "mood-logs"] });
      qc.invalidateQueries({ queryKey: ["kids-wellness", "stats"] });
    },
  });
}

// ── Sleep ─────────────────────────────────────────────────────────────────
export function useSleepLogs(limit = 14) {
  return useQuery({ queryKey: ["kids-wellness", "sleep-logs", limit], queryFn: () => logs.fetchSleepLogs(limit) });
}

export function useLogSleep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { bedtime: string; wakeTime: string; durationMinutes: number; quality?: SleepQuality }) =>
      logs.logSleep(v.bedtime, v.wakeTime, v.durationMinutes, v.quality),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-wellness", "sleep-logs"] });
      qc.invalidateQueries({ queryKey: ["kids-wellness", "stats"] });
    },
  });
}

// ── Sessions ──────────────────────────────────────────────────────────────
export function useSessions(limit = 20) {
  return useQuery({ queryKey: ["kids-wellness", "sessions", limit], queryFn: () => logs.fetchSessions(limit) });
}

export function useLogSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, refSlug, minutes }: { kind: "exercise" | "mindfulness"; refSlug: string; minutes: number }) =>
      logs.logSession(kind, refSlug, minutes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-wellness", "sessions"] });
      qc.invalidateQueries({ queryKey: ["kids-wellness", "stats"] });
    },
  });
}
