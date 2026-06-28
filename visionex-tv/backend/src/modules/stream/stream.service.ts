/**
 * StreamService — Session management + stream token lifecycle
 *
 * Handles:
 *  • POST /api/tv/stream/start   — creates session, returns signed token
 *  • POST /api/tv/stream/switch  — fails over to next source instantly
 *  • POST /api/tv/stream/stop    — cleans up session, persists watch time
 *  • POST /api/tv/stream/heartbeat — updates last_seen_at
 */

import {
  Injectable, NotFoundException, ForbiddenException,
  BadRequestException, Inject, Logger,
} from "@nestjs/common";
import { ConfigService }       from "@nestjs/config";
import { Pool }                from "pg";
import { randomBytes }         from "node:crypto";
import { DB_POOL }             from "../../database/database.module";
import { REDIS_CLIENT }        from "../../database/redis.module";
import { OrchestratorService } from "../orchestrator/orchestrator.service";
import { AnalyticsService }    from "../analytics/analytics.service";
import type Redis              from "ioredis";

export interface StartStreamResult {
  token:     string;
  sourceId:  string;
  url:       string;
  type:      string;
  quality:   string;
  expiresAt: string;
  channelId: string;
}

@Injectable()
export class StreamService {
  private readonly logger = new Logger(StreamService.name);
  private readonly tokenTtlMs: number;

  constructor(
    @Inject(DB_POOL)      private readonly db:    Pool,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly orchestrator: OrchestratorService,
    private readonly analytics:   AnalyticsService,
    private readonly cfg:         ConfigService,
  ) {
    this.tokenTtlMs = this.cfg.get<number>("stream.tokenTtlHours", 4) * 60 * 60 * 1000;
  }

  // ── Start stream ──────────────────────────────────────────────────────────
  async start(userId: string, channelId: string, ip: string, userAgent: string): Promise<StartStreamResult> {
    // Verify channel exists and is active
    const { rows: [channel] } = await this.db.query<{ id: string; is_active: boolean }>(
      "SELECT id, is_active FROM tv_channels WHERE id = $1",
      [channelId]
    );
    if (!channel || !channel.is_active) throw new NotFoundException("Channel not found");

    // Verify subscription (trial or active)
    const hasSub = await this.checkSubscription(userId);
    if (!hasSub) throw new ForbiddenException("Active subscription required");

    // Select best source
    const selected = await this.orchestrator.selectSource(channelId);
    if (!selected) throw new NotFoundException("No stream sources available for this channel");

    // Issue session token
    const token     = randomBytes(48).toString("hex");
    const expiresAt = new Date(Date.now() + this.tokenTtlMs);

    await this.db.query(
      `INSERT INTO tv_stream_sessions
         (user_id, channel_id, source_id, token, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, channelId, selected.sourceId, token, expiresAt, ip, userAgent]
    );

    // Cache token → session for fast validation
    await this.redis.setex(
      `session:${token}`,
      Math.floor(this.tokenTtlMs / 1000),
      JSON.stringify({ userId, channelId, sourceId: selected.sourceId })
    );

    // Log start event
    await this.analytics.recordEvent(channelId, selected.sourceId, userId, "start");

    this.logger.log(`[start] user=${userId} channel=${channelId} source=${selected.sourceId}`);

    return {
      token,
      sourceId:  selected.sourceId,
      url:       selected.url,
      type:      selected.type,
      quality:   selected.quality,
      expiresAt: expiresAt.toISOString(),
      channelId,
    };
  }

  // ── Switch source (failover) ───────────────────────────────────────────────
  async switch_(userId: string, token: string, failedSourceId: string) {
    const session = await this.validateToken(token);
    if (session.userId !== userId) throw new ForbiddenException();

    const selected = await this.orchestrator.switchSource(session.channelId, failedSourceId);
    if (!selected) throw new NotFoundException("No fallback stream sources available");

    // Update session with new source
    await this.db.query(
      "UPDATE tv_stream_sessions SET source_id = $1, last_seen_at = NOW() WHERE token = $2",
      [selected.sourceId, token]
    );
    await this.redis.setex(
      `session:${token}`,
      Math.floor(this.tokenTtlMs / 1000),
      JSON.stringify({ userId, channelId: session.channelId, sourceId: selected.sourceId })
    );

    await this.analytics.recordEvent(session.channelId, failedSourceId, userId, "switch", {
      newSourceId: selected.sourceId,
    });

    this.logger.log(`[switch] user=${userId} from=${failedSourceId} to=${selected.sourceId}`);

    return {
      sourceId:  selected.sourceId,
      url:       selected.url,
      type:      selected.type,
      quality:   selected.quality,
      channelId: session.channelId,
    };
  }

  // ── Heartbeat ────────────────────────────────────────────────────────────
  async heartbeat(token: string, bufferHealth: number) {
    const cached = await this.redis.get(`session:${token}`);
    if (!cached) return null; // session expired

    await this.db.query(
      "UPDATE tv_stream_sessions SET last_seen_at = NOW() WHERE token = $1",
      [token]
    );

    return { ok: true };
  }

  // ── Stop stream ───────────────────────────────────────────────────────────
  async stop(userId: string, token: string, watchedSeconds: number) {
    const session = await this.validateToken(token).catch(() => null);
    if (!session || session.userId !== userId) return;

    await this.redis.del(`session:${token}`);
    await this.db.query("DELETE FROM tv_stream_sessions WHERE token = $1", [token]);

    if (watchedSeconds > 0) {
      // Persist watch time
      await this.db.query(
        "SELECT upsert_watch_stats($1, $2, $3)",
        [userId, session.channelId, Math.floor(watchedSeconds)]
      );
      // Insert watch history entry
      await this.db.query(
        `INSERT INTO tv_watch_history (user_id, channel_id, source_id, duration_sec)
         VALUES ($1, $2, $3, $4)`,
        [userId, session.channelId, session.sourceId, Math.floor(watchedSeconds)]
      );
      await this.analytics.recordEvent(session.channelId, session.sourceId, userId, "stop", {
        duration: watchedSeconds,
      });
    }
  }

  // ── Resolve stream URL from token (for proxy) ─────────────────────────────
  async resolveToken(token: string): Promise<{ url: string; channelId: string } | null> {
    const session = await this.validateToken(token).catch(() => null);
    if (!session) return null;

    const { rows: [src] } = await this.db.query<{ url: string }>(
      "SELECT url FROM tv_stream_sources WHERE id = $1 AND is_active = TRUE",
      [session.sourceId]
    );
    if (!src) return null;

    return { url: src.url, channelId: session.channelId };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private async validateToken(token: string): Promise<{ userId: string; channelId: string; sourceId: string }> {
    const cached = await this.redis.get(`session:${token}`);
    if (cached) return JSON.parse(cached);

    const { rows: [row] } = await this.db.query<{
      user_id: string; channel_id: string; source_id: string; expires_at: string;
    }>(
      "SELECT user_id, channel_id, source_id, expires_at FROM tv_stream_sessions WHERE token = $1",
      [token]
    );

    if (!row || new Date(row.expires_at) < new Date()) {
      throw new ForbiddenException("Stream token expired or invalid");
    }

    const session = { userId: row.user_id, channelId: row.channel_id, sourceId: row.source_id };
    await this.redis.setex(`session:${token}`, 3600, JSON.stringify(session));
    return session;
  }

  private async checkSubscription(userId: string): Promise<boolean> {
    const { rows: [sub] } = await this.db.query(
      `SELECT id FROM tv_subscriptions
       WHERE user_id = $1 AND status = 'active' AND expires_at > NOW()
       LIMIT 1`,
      [userId]
    );
    return !!sub;
  }
}
