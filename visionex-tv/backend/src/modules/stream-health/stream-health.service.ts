/**
 * StreamHealthService
 *
 * Tracks per-source health metrics in Redis + PostgreSQL.
 *
 * Metric model (Redis hash  key: sh:{sourceId}):
 *   latency_samples  — JSON array of last 10 latency readings (ms)
 *   buffer_events    — count of buffer stall events (last 5 min)
 *   error_events     — count of hard errors  (last 5 min)
 *   last_ok          — unix timestamp of last successful probe
 *   last_error       — unix timestamp of last error
 *
 * Score formula (0–100):
 *   latency_score  = max(0, 100 - (avg_latency - 2000) / 80)   [3s baseline]
 *   buffer_score   = max(0,  100 - buffer_events * 15)
 *   error_score    = max(0,  100 - error_events  * 25)
 *   reliability    = 0.30 * latency_score + 0.40 * buffer_score + 0.30 * error_score
 *
 *   Then EMA with DB: new_db = round(0.70 * db_score + 0.30 * reliability)
 */

import { Injectable, Inject, Logger } from "@nestjs/common";
import { Pool }         from "pg";
import { DB_POOL }      from "../../database/database.module";
import { REDIS_CLIENT } from "../../database/redis.module";
import type Redis       from "ioredis";

const WINDOW_SECONDS   = 300;   // 5-minute sliding window for events
const LATENCY_SAMPLES  = 10;    // keep last N latency readings

export interface SourceHealthSnapshot {
  sourceId:     string;
  score:        number;   // 0–100
  avgLatencyMs: number;
  bufferEvents: number;
  errorEvents:  number;
  lastOk:       number | null;
  lastError:    number | null;
}

@Injectable()
export class StreamHealthService {
  private readonly logger = new Logger(StreamHealthService.name);

  constructor(
    @Inject(DB_POOL)      private readonly db:    Pool,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // ── Called by the player / stream service ────────────────────────────────

  async recordLatency(sourceId: string, latencyMs: number) {
    const key     = `sh:${sourceId}`;
    const raw     = await this.redis.hget(key, "latency_samples");
    const samples: number[] = raw ? JSON.parse(raw) : [];
    samples.push(latencyMs);
    if (samples.length > LATENCY_SAMPLES) samples.shift();
    await this.redis.hset(key, "latency_samples", JSON.stringify(samples), "last_ok", Date.now());
    await this.redis.expire(key, WINDOW_SECONDS * 2);
    await this.syncScoreToDb(sourceId);
  }

  async recordBufferEvent(sourceId: string) {
    const key = `sh:${sourceId}`;
    await this.redis.hincrby(key, "buffer_events", 1);
    await this.redis.expire(key, WINDOW_SECONDS * 2);
  }

  async recordError(sourceId: string) {
    const key = `sh:${sourceId}`;
    await this.redis.hincrby(key, "error_events", 1);
    await this.redis.hset(key, "last_error", Date.now());
    await this.redis.expire(key, WINDOW_SECONDS * 2);
    await this.syncScoreToDb(sourceId);
  }

  // ── Read health snapshot ──────────────────────────────────────────────────

  async getSnapshot(sourceId: string): Promise<SourceHealthSnapshot> {
    const key  = `sh:${sourceId}`;
    const hash = await this.redis.hgetall(key);

    const samples: number[] = hash?.latency_samples ? JSON.parse(hash.latency_samples) : [];
    const avgLatency = samples.length
      ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)
      : 0;

    const bufferEvents = parseInt(hash?.buffer_events ?? "0");
    const errorEvents  = parseInt(hash?.error_events  ?? "0");
    const lastOk       = hash?.last_ok    ? parseInt(hash.last_ok)    : null;
    const lastError    = hash?.last_error ? parseInt(hash.last_error) : null;

    const score = this.computeScore(avgLatency, bufferEvents, errorEvents);

    return { sourceId, score, avgLatencyMs: avgLatency, bufferEvents, errorEvents, lastOk, lastError };
  }

  async getSnapshotBatch(sourceIds: string[]): Promise<Record<string, SourceHealthSnapshot>> {
    const results = await Promise.all(sourceIds.map(id => this.getSnapshot(id)));
    return Object.fromEntries(results.map(s => [s.sourceId, s]));
  }

  // ── Reset window counters (call on new session start) ────────────────────
  async resetCounters(sourceId: string) {
    const key = `sh:${sourceId}`;
    await this.redis.hdel(key, "buffer_events", "error_events");
  }

  // ── Score calculation ─────────────────────────────────────────────────────
  private computeScore(avgLatencyMs: number, bufferEvents: number, errorEvents: number): number {
    const latencyScore = Math.max(0, 100 - Math.max(0, avgLatencyMs - 2000) / 80);
    const bufferScore  = Math.max(0, 100 - bufferEvents * 15);
    const errorScore   = Math.max(0, 100 - errorEvents  * 25);
    const raw = 0.30 * latencyScore + 0.40 * bufferScore + 0.30 * errorScore;
    return Math.round(Math.max(0, Math.min(100, raw)));
  }

  // ── Persist EMA score to DB ───────────────────────────────────────────────
  private async syncScoreToDb(sourceId: string) {
    try {
      const snap = await this.getSnapshot(sourceId);

      const { rows: [row] } = await this.db.query<{ reliability: number; latency_ms: number | null }>(
        "SELECT reliability, latency_ms FROM tv_stream_sources WHERE id = $1",
        [sourceId]
      );
      if (!row) return;

      const ema = Math.round(0.70 * row.reliability + 0.30 * snap.score);
      await this.db.query(
        `UPDATE tv_stream_sources
         SET reliability     = $1,
             latency_ms      = $2,
             last_checked_at = NOW(),
             failure_count   = failure_count + $3,
             success_count   = success_count + $4
         WHERE id = $5`,
        [
          ema,
          snap.avgLatencyMs || row.latency_ms,
          snap.errorEvents > 0 ? 1 : 0,
          snap.errorEvents === 0 ? 1 : 0,
          sourceId,
        ]
      );
    } catch (e) {
      this.logger.warn(`syncScoreToDb error for ${sourceId}: ${(e as Error).message}`);
    }
  }
}
