// The one place every metered call reports to.
//
// aiProvider.ts (structured calls, streams, embeddings) and meteredFetch.ts
// (every other provider call: images, speech, transcription, moderation, the
// functions that call OpenAI directly) both emit here; `installUsageMetering`
// (usageMeter.ts) installs the sink that prices and stores each event. With no
// sink installed — a test, a script — emitting is a no-op.
//
// Pure: no provider, no database.

import type { UsageEvent } from "./metering.ts";

export type UsageSink = (event: UsageEvent) => void;
let usageSink: UsageSink | null = null;

/** Installed once per function by `installUsageMetering()`; null removes it. */
export function setUsageSink(sink: UsageSink | null): void {
  usageSink = sink;
}

/** Report one provider call. Never throws: metering never reaches the request. */
export function emitUsage(event: UsageEvent): void {
  const sink = usageSink;
  if (!sink) return;
  try {
    sink(event);
  } catch {
    // Metering never reaches the request.
  }
}

// ── Waiting for a reservation's events ──────────────────────────────────────
//
// A metered request settles from the ai_usage_events rows that carry its
// reservation id, and those rows are written in the background. The sink
// registers each write here, so settlement can wait for exactly its own.

const pendingWrites = new Map<string, Set<Promise<unknown>>>();

/** Called by the installed sink for each write that belongs to a reservation. */
export function trackReservationWrite(reservationId: string, write: Promise<unknown>): void {
  const set = pendingWrites.get(reservationId) ?? new Set<Promise<unknown>>();
  pendingWrites.set(reservationId, set);
  const settled = write.catch(() => undefined);
  set.add(settled);
  settled.finally(() => {
    set.delete(settled);
    if (set.size === 0) pendingWrites.delete(reservationId);
  });
}

/** Resolves once every event write registered for this reservation has finished. */
export async function reservationWritesSettled(reservationId: string): Promise<void> {
  for (;;) {
    const set = pendingWrites.get(reservationId);
    if (!set || set.size === 0) return;
    await Promise.all([...set]);
  }
}

type WaitUntil = (p: Promise<unknown>) => void;

/**
 * Keep work that finishes after the response alive (EdgeRuntime.waitUntil),
 * and swallow its failure. Outside the Edge runtime the promise simply runs.
 */
export function inBackground(work: Promise<unknown>): void {
  const settled = work.catch(() => undefined);
  try {
    (globalThis as { EdgeRuntime?: { waitUntil: WaitUntil } }).EdgeRuntime?.waitUntil(settled);
  } catch {
    // No runtime to hold it: it runs on its own.
  }
}
