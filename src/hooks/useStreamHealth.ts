/**
 * useStreamHealth
 *
 * Client-side stream health metrics and reliability scoring.
 *
 * Tracks:
 *  - startupTimeMs   — time from stream request to first frame
 *  - bufferStalls    — number of rebuffering events
 *  - bufferStallMs   — total milliseconds spent rebuffering
 *  - totalErrors     — fatal playback errors
 *  - totalPlaySecs   — cumulative seconds played (not rebuffering)
 *
 * Reliability score (0–100):
 *  - startup  30%  — ideal <3s, bad >10s
 *  - buffer   50%  — ideal <2% buffer ratio
 *  - errors   20%  — each fatal error deducts 20 pts
 *
 * Scores are persisted in localStorage so they survive page reload
 * and can be used for source ranking across sessions.
 *
 * Usage:
 *   const health = useStreamHealth(channelId);
 *   health.onStreamStart();  // call when stream init begins
 *   health.onFirstFrame();   // call on MANIFEST_PARSED
 *   health.onBufferStart();  // call on video "waiting"
 *   health.onBufferEnd();    // call on video "playing"
 *   health.onError();        // call on fatal HLS error
 *   health.onStop();         // call on unmount / channel change
 *   health.getScore();       // current channel reliability 0-100
 */

import { useRef, useCallback, useEffect } from "react";

const STORAGE_KEY = "vx:tv:stream-health-v2";

export type StreamMetrics = {
  startupTimeMs:  number;
  bufferStalls:   number;
  bufferStallMs:  number;
  totalErrors:    number;
  totalPlaySecs:  number;
  lastUpdated:    number;
};

const DEFAULT_METRICS: StreamMetrics = {
  startupTimeMs: 0,
  bufferStalls:  0,
  bufferStallMs: 0,
  totalErrors:   0,
  totalPlaySecs: 0,
  lastUpdated:   Date.now(),
};

function computeScore(m: StreamMetrics): number {
  // If no data yet, assume 100 (optimistic default)
  if (m.totalPlaySecs === 0 && m.startupTimeMs === 0 && m.totalErrors === 0) return 100;

  // Startup score: 3000ms → 100, 10000ms → 0
  const startupScore = m.startupTimeMs === 0
    ? 100
    : Math.max(0, 100 - ((m.startupTimeMs - 3000) / 70));

  // Buffer score: stall ratio as fraction of play time
  const totalMs    = m.totalPlaySecs * 1000;
  const stallRatio = totalMs > 0 ? m.bufferStallMs / totalMs : 0;
  const bufferScore = Math.max(0, 100 - (stallRatio * 5000));

  // Error score: each fatal error costs 20 points
  const errorScore = Math.max(0, 100 - (m.totalErrors * 20));

  return Math.round(
    startupScore * 0.30 +
    bufferScore  * 0.50 +
    errorScore   * 0.20
  );
}

function loadAll(): Record<string, StreamMetrics> {
  try   { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"); }
  catch { return {}; }
}

function saveAll(data: Record<string, StreamMetrics>): void {
  try {
    // Keep max 200 channel entries — prune oldest first
    const entries = Object.entries(data)
      .sort(([, a], [, b]) => b.lastUpdated - a.lastUpdated)
      .slice(0, 200);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {}
}

export function useStreamHealth(channelId: string | null) {
  const metricsRef    = useRef<StreamMetrics>({ ...DEFAULT_METRICS });
  const startTimeRef  = useRef<number | null>(null);
  const stallStartRef = useRef<number | null>(null);
  const playTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load saved metrics for this channel
  useEffect(() => {
    if (!channelId) return;
    const all = loadAll();
    metricsRef.current = all[channelId] ?? { ...DEFAULT_METRICS };
    return () => {
      // Persist on cleanup
      if (!channelId) return;
      const all = loadAll();
      all[channelId] = { ...metricsRef.current, lastUpdated: Date.now() };
      saveAll(all);
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [channelId]);

  const onStreamStart = useCallback(() => {
    startTimeRef.current = Date.now();
  }, []);

  const onFirstFrame = useCallback(() => {
    if (startTimeRef.current !== null) {
      metricsRef.current.startupTimeMs = Date.now() - startTimeRef.current;
    }
    if (playTimerRef.current) clearInterval(playTimerRef.current);
    playTimerRef.current = setInterval(() => {
      if (stallStartRef.current === null) {
        metricsRef.current.totalPlaySecs++;
      }
    }, 1000);
  }, []);

  const onBufferStart = useCallback(() => {
    if (stallStartRef.current !== null) return; // already stalling
    stallStartRef.current = Date.now();
    metricsRef.current.bufferStalls++;
  }, []);

  const onBufferEnd = useCallback(() => {
    if (stallStartRef.current === null) return;
    metricsRef.current.bufferStallMs += Date.now() - stallStartRef.current;
    stallStartRef.current = null;
  }, []);

  const onError = useCallback(() => {
    metricsRef.current.totalErrors++;
  }, []);

  const onStop = useCallback(() => {
    if (playTimerRef.current) {
      clearInterval(playTimerRef.current);
      playTimerRef.current = null;
    }
    if (channelId) {
      const all = loadAll();
      all[channelId] = { ...metricsRef.current, lastUpdated: Date.now() };
      saveAll(all);
    }
  }, [channelId]);

  const getScore = useCallback((): number => computeScore(metricsRef.current), []);

  // Parses localStorage once and returns a map of channelId → score.
  // Use this instead of calling getChannelScore() in a loop to avoid
  // O(n × JSON.parse) per render frame when showing scores in a list.
  const getAllScores = useCallback((): Record<string, number> => {
    const all = Object.entries(loadAll());
    const map: Record<string, number> = {};
    for (const [id, metrics] of all) map[id] = computeScore(metrics);
    return map;
  }, []);

  const getChannelScore = useCallback((id: string): number => {
    const all = loadAll();
    return all[id] ? computeScore(all[id]) : 100;
  }, []);

  const getMetrics = useCallback((): StreamMetrics => ({ ...metricsRef.current }), []);

  return {
    onStreamStart,
    onFirstFrame,
    onBufferStart,
    onBufferEnd,
    onError,
    onStop,
    getScore,
    getAllScores,
    getChannelScore,
    getMetrics,
  };
}
