import { Injectable, Inject } from "@nestjs/common";
import { Pool }               from "pg";
import { DB_POOL }            from "../../database/database.module";

type EventType = "start" | "stop" | "switch" | "error" | "buffer";

@Injectable()
export class AnalyticsService {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  async recordEvent(
    channelId: string,
    sourceId:  string,
    userId:    string,
    event:     EventType,
    metadata?: Record<string, unknown>
  ) {
    await this.db.query(
      `INSERT INTO tv_stream_events (channel_id, source_id, user_id, event_type, metadata, occurred_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [channelId, sourceId, userId, event, JSON.stringify(metadata ?? {})]
    ).catch(() => {});  // analytics must not block the happy path
  }

  async getChannelStats(channelId: string, days = 7) {
    const { rows } = await this.db.query(
      `SELECT
         date_trunc('day', ws.date) AS day,
         SUM(ws.total_watch_sec)::INT AS total_watch_sec,
         SUM(ws.watch_count)::INT     AS sessions,
         COUNT(DISTINCT ws.user_id)::INT AS unique_viewers
       FROM tv_watch_stats ws
       WHERE ws.channel_id = $1
         AND ws.date >= NOW() - ($2 || ' days')::INTERVAL
       GROUP BY 1
       ORDER BY 1 ASC`,
      [channelId, days]
    );
    return rows;
  }

  async getTopChannels(limit = 10) {
    const { rows } = await this.db.query(
      `SELECT
         c.id, c.name, c.name_ar, c.logo_url,
         COALESCE(SUM(ws.watch_count), 0)::INT     AS total_views,
         COALESCE(SUM(ws.total_watch_sec), 0)::INT AS total_watch_sec
       FROM tv_channels c
       LEFT JOIN tv_watch_stats ws ON ws.channel_id = c.id
         AND ws.date >= NOW() - INTERVAL '30 days'
       WHERE c.is_active = TRUE
       GROUP BY c.id
       ORDER BY total_views DESC
       LIMIT $1`,
      [limit]
    );
    return rows;
  }

  async getStreamHealthSummary() {
    const { rows } = await this.db.query(
      `SELECT
         COUNT(*)                                                 AS total_sources,
         COUNT(*) FILTER (WHERE reliability >= 80)               AS healthy,
         COUNT(*) FILTER (WHERE reliability BETWEEN 40 AND 79)   AS degraded,
         COUNT(*) FILTER (WHERE reliability < 40)                AS critical,
         AVG(latency_ms)::INT                                     AS avg_latency_ms
       FROM tv_stream_sources
       WHERE is_active = TRUE`
    );
    return rows[0];
  }
}
