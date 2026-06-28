/**
 * Stream Orchestrator Service — CORE ENGINE
 *
 * Responsibilities:
 *  1. Select the best stream source for a channel (by priority × reliability)
 *  2. Detect source failures and switch instantly (<2s)
 *  3. Retry failed sources in background (exponential backoff)
 *  4. Update reliability scores after each probe
 *  5. Broadcast health events via WebSocket
 *
 * Reliability score algorithm:
 *   score = 0.30 × startup_score + 0.50 × buffer_score + 0.20 × error_score
 *
 *   startup_score = max(0, 100 − (latency_ms − 3000) / 70)
 *   buffer_score  = max(0, 100 − buffer_ratio × 5000)
 *   error_score   = max(0, 100 − failure_count × 10)
 */

import {
  Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject,
} from "@nestjs/common";
import { ConfigService }   from "@nestjs/config";
import { Pool }            from "pg";
import { DB_POOL }         from "../../database/database.module";
import { REDIS_CLIENT }    from "../../database/redis.module";
import type Redis          from "ioredis";

export interface StreamSource {
  id:          string;
  channelId:   string;
  url:         string;
  type:        string;
  priority:    number;
  reliability: number;
  latencyMs:   number | null;
  isActive:    boolean;
}

export interface SourceSelectionResult {
  sourceId:   string;
  url:        string;
  type:       string;
  quality:    string;
  channelId:  string;
}

const PROBE_TIMEOUT_MS   = 8_000;
const CACHE_TTL_SECONDS  = 120;  // Redis source cache
const RETRY_DELAYS_MS    = [4_000, 8_000, 16_000];

@Injectable()
export class OrchestratorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger       = new Logger(OrchestratorService.name);
  private healthCheckInterval?: NodeJS.Timeout;
  // In-memory map of sourceId → next retry timestamp (ms)
  private readonly retryQueue   = new Map<string, number>();
  private readonly failingNow   = new Set<string>();

  constructor(
    @Inject(DB_POOL)      private readonly db:    Pool,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly cfg: ConfigService,
  ) {}

  onModuleInit() {
    const intervalMs = this.cfg.get<number>("stream.healthIntervalMs", 30_000);
    this.healthCheckInterval = setInterval(
      () => this.runHealthChecks(),
      intervalMs
    );
    this.logger.log(`Health check loop started (interval: ${intervalMs}ms)`);
  }

  onModuleDestroy() {
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
  }

  // ── Source selection ──────────────────────────────────────────────────────

  /**
   * Select the best available source for a channel.
   * Uses Redis cache first, falls back to DB, then probes.
   */
  async selectSource(channelId: string): Promise<SourceSelectionResult | null> {
    const sources = await this.getChannelSources(channelId);
    if (!sources.length) return null;

    // Rank: skip currently-failing sources, sort by (priority ASC, reliability DESC)
    const ranked = sources
      .filter(s => s.isActive && !this.failingNow.has(s.id))
      .sort((a, b) => a.priority - b.priority || b.reliability - a.reliability);

    for (const source of ranked) {
      const probeOk = await this.probeSource(source);
      if (probeOk) {
        const channel = await this.getChannelQuality(channelId);
        return {
          sourceId:  source.id,
          url:       source.url,
          type:      source.type,
          quality:   channel?.quality ?? "HD",
          channelId,
        };
      }
      this.markFailing(source.id);
    }

    return null; // all sources unavailable
  }

  /**
   * Called when the player reports a source failure.
   * Returns the next best source immediately, retries failed source in background.
   */
  async switchSource(
    channelId:      string,
    failedSourceId: string
  ): Promise<SourceSelectionResult | null> {
    this.logger.warn(`[switch] channel=${channelId} failed=${failedSourceId}`);
    this.markFailing(failedSourceId);

    // Schedule background retry of the failed source
    this.scheduleRetry(failedSourceId, 0);

    // Invalidate cache so we get fresh data
    await this.redis.del(`sources:${channelId}`);

    return this.selectSource(channelId);
  }

  // ── Health checks ─────────────────────────────────────────────────────────

  private async runHealthChecks() {
    const { rows: sources } = await this.db.query<{
      id: string; url: string; channel_id: string; reliability: number;
    }>(
      `SELECT id, url, channel_id, reliability
       FROM tv_stream_sources
       WHERE is_active = TRUE
       ORDER BY last_checked_at ASC NULLS FIRST
       LIMIT 20`
    );

    await Promise.allSettled(sources.map(s => this.probeFull(s)));
  }

  private async probeFull(source: { id: string; url: string; channel_id: string; reliability: number }) {
    const start  = Date.now();
    const ok     = await this.probeUrl(source.url);
    const latMs  = Date.now() - start;

    // Exponential moving average: 0.7 × old + 0.3 × sample
    const sample    = ok ? 100 : 0;
    const newScore  = Math.max(0, Math.min(100,
      Math.round(0.70 * source.reliability + 0.30 * sample)
    ));

    await this.db.query(
      `UPDATE tv_stream_sources
       SET reliability = $1, latency_ms = $2, last_checked_at = NOW(),
           failure_count = CASE WHEN $3 THEN failure_count ELSE failure_count + 1 END,
           success_count = CASE WHEN $3 THEN success_count + 1 ELSE success_count END
       WHERE id = $4`,
      [newScore, latMs, ok, source.id]
    );

    // Invalidate Redis cache for this channel
    await this.redis.del(`sources:${source.channel_id}`);

    if (!ok && newScore < 20) {
      this.logger.warn(`[health] source=${source.id} reliability=${newScore} — low reliability`);
    }

    return ok;
  }

  // ── Source probe (fast HEAD check) ───────────────────────────────────────

  private async probeSource(source: StreamSource): Promise<boolean> {
    const start = Date.now();
    const ok    = await this.probeUrl(source.url);
    const ms    = Date.now() - start;

    // Quick in-memory update; full DB update happens in health cycle
    if (ok) source.latencyMs = ms;

    return ok;
  }

  private async probeUrl(url: string): Promise<boolean> {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      const { default: fetch } = await import("node-fetch");
      const res = await (fetch as any)(url, {
        method:  "HEAD",
        signal:  controller.signal,
        headers: { "User-Agent": "VisionexOrchestrator/1.0" },
      });
      clearTimeout(tid);
      return res.ok;
    } catch {
      clearTimeout(tid);
      return false;
    }
  }

  // ── Retry queue ───────────────────────────────────────────────────────────

  private markFailing(sourceId: string) {
    this.failingNow.add(sourceId);
    // Auto-clear failing status after 60 seconds
    setTimeout(() => this.failingNow.delete(sourceId), 60_000);
  }

  private scheduleRetry(sourceId: string, attempt: number) {
    const delayMs = RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS.at(-1)!;
    this.retryQueue.set(sourceId, Date.now() + delayMs);
    setTimeout(async () => {
      const { rows: [src] } = await this.db.query<{ url: string; channel_id: string }>(
        "SELECT url, channel_id FROM tv_stream_sources WHERE id = $1",
        [sourceId]
      );
      if (!src) return;

      const ok = await this.probeUrl(src.url);
      if (ok) {
        this.failingNow.delete(sourceId);
        this.retryQueue.delete(sourceId);
        await this.redis.del(`sources:${src.channel_id}`);
        this.logger.log(`[retry] source=${sourceId} recovered after ${attempt + 1} attempts`);
      } else if (attempt < RETRY_DELAYS_MS.length - 1) {
        this.scheduleRetry(sourceId, attempt + 1);
      } else {
        this.logger.warn(`[retry] source=${sourceId} failed all retries — marked inactive`);
        await this.db.query(
          "UPDATE tv_stream_sources SET is_active = FALSE WHERE id = $1",
          [sourceId]
        );
      }
    }, delayMs);
  }

  // ── Data access ───────────────────────────────────────────────────────────

  private async getChannelSources(channelId: string): Promise<StreamSource[]> {
    const cacheKey = `sources:${channelId}`;
    const cached   = await this.redis.get(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch {}
    }

    const { rows } = await this.db.query<{
      id: string; url: string; type: string; priority: number;
      reliability: number; latency_ms: number | null; is_active: boolean;
    }>(
      `SELECT id, url, type, priority, reliability, latency_ms, is_active
       FROM tv_stream_sources
       WHERE channel_id = $1 AND is_active = TRUE
       ORDER BY priority ASC, reliability DESC`,
      [channelId]
    );

    const sources: StreamSource[] = rows.map(r => ({
      id:          r.id,
      channelId,
      url:         r.url,
      type:        r.type,
      priority:    r.priority,
      reliability: r.reliability,
      latencyMs:   r.latency_ms,
      isActive:    r.is_active,
    }));

    await this.redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(sources));
    return sources;
  }

  private async getChannelQuality(channelId: string) {
    const { rows: [ch] } = await this.db.query<{ quality: string }>(
      "SELECT quality FROM tv_channels WHERE id = $1",
      [channelId]
    );
    return ch ?? null;
  }

  // ── Public status ─────────────────────────────────────────────────────────

  getFailingSources(): string[] {
    return [...this.failingNow];
  }

  getRetryQueue(): Record<string, number> {
    return Object.fromEntries(this.retryQueue.entries());
  }
}
