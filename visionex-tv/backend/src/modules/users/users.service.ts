import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { Pool }        from "pg";
import { DB_POOL }     from "../../database/database.module";
import { REDIS_CLIENT } from "../../database/redis.module";
import type Redis      from "ioredis";

export interface UserPreferences {
  language:          string;
  quality:           "auto" | "SD" | "HD" | "FHD";
  subtitlesEnabled:  boolean;
  autoplay:          boolean;
  notificationsEnabled: boolean;
  preferredCategories: string[];
  preferredCountries:  string[];
}

const DEFAULT_PREFS: UserPreferences = {
  language:             "ar",
  quality:              "auto",
  subtitlesEnabled:     false,
  autoplay:             true,
  notificationsEnabled: true,
  preferredCategories:  [],
  preferredCountries:   [],
};

@Injectable()
export class UsersService {
  constructor(
    @Inject(DB_POOL)      private readonly db:    Pool,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // ── Profile ───────────────────────────────────────────────────────────────
  async getProfile(userId: string) {
    const { rows: [user] } = await this.db.query(
      `SELECT id, email, display_name, avatar_url, role, created_at,
              (SELECT COUNT(*) FROM tv_favorites     WHERE user_id = $1) AS favorite_count,
              (SELECT COUNT(*) FROM tv_watch_history WHERE user_id = $1) AS history_count
       FROM users WHERE id = $1`,
      [userId]
    );
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async updateProfile(userId: string, data: { displayName?: string; avatarUrl?: string }) {
    const sets:   string[]    = [];
    const params: unknown[]   = [];
    let p = 1;

    if (data.displayName != null) { sets.push(`display_name = $${p++}`); params.push(data.displayName); }
    if (data.avatarUrl   != null) { sets.push(`avatar_url   = $${p++}`); params.push(data.avatarUrl); }
    if (!sets.length) return this.getProfile(userId);

    params.push(userId);
    await this.db.query(
      `UPDATE users SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${p}`,
      params
    );
    return this.getProfile(userId);
  }

  // ── Preferences ───────────────────────────────────────────────────────────
  async getPreferences(userId: string): Promise<UserPreferences> {
    const cached = await this.redis.get(`prefs:${userId}`);
    if (cached) return JSON.parse(cached);

    const { rows: [row] } = await this.db.query<{ preferences: UserPreferences }>(
      "SELECT preferences FROM users WHERE id = $1",
      [userId]
    );
    const prefs = { ...DEFAULT_PREFS, ...(row?.preferences ?? {}) };
    await this.redis.setex(`prefs:${userId}`, 3600, JSON.stringify(prefs));
    return prefs;
  }

  async updatePreferences(userId: string, patch: Partial<UserPreferences>): Promise<UserPreferences> {
    const current = await this.getPreferences(userId);
    const updated = { ...current, ...patch };

    await this.db.query(
      "UPDATE users SET preferences = $1::jsonb, updated_at = NOW() WHERE id = $2",
      [JSON.stringify(updated), userId]
    );
    await this.redis.setex(`prefs:${userId}`, 3600, JSON.stringify(updated));
    return updated;
  }

  // ── Watch history ─────────────────────────────────────────────────────────
  async getWatchHistory(userId: string, limit = 20, offset = 0) {
    const { rows } = await this.db.query(
      `SELECT
         wh.id, wh.watched_at, wh.duration_sec,
         c.id AS channel_id, c.name, c.name_ar, c.logo_url, c.quality
       FROM tv_watch_history wh
       JOIN tv_channels c ON c.id = wh.channel_id
       WHERE wh.user_id = $1
       ORDER BY wh.watched_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    const { rows: [cnt] } = await this.db.query<{ count: string }>(
      "SELECT COUNT(*)::INT AS count FROM tv_watch_history WHERE user_id = $1",
      [userId]
    );
    return { data: rows, total: parseInt(cnt.count), limit, offset };
  }

  async clearHistory(userId: string) {
    await this.db.query(
      "DELETE FROM tv_watch_history WHERE user_id = $1",
      [userId]
    );
  }

  async deleteHistoryEntry(userId: string, entryId: string) {
    await this.db.query(
      "DELETE FROM tv_watch_history WHERE id = $1 AND user_id = $2",
      [entryId, userId]
    );
  }

  // ── Watch stats ───────────────────────────────────────────────────────────
  async getWatchStats(userId: string, days = 30) {
    const { rows } = await this.db.query(
      `SELECT
         ws.date,
         SUM(ws.total_watch_sec)::INT AS total_watch_sec,
         SUM(ws.watch_count)::INT     AS sessions,
         COUNT(DISTINCT ws.channel_id)::INT AS unique_channels
       FROM tv_watch_stats ws
       WHERE ws.user_id = $1
         AND ws.date >= NOW() - ($2 || ' days')::INTERVAL
       GROUP BY ws.date
       ORDER BY ws.date DESC`,
      [userId, days]
    );
    return rows;
  }
}
