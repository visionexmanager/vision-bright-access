/**
 * Recommendations Engine — content-based filtering
 *
 * Algorithm:
 *  1. Fetch user's top-5 watched channels (by total_watch_sec, last 30 days)
 *  2. Collect their category_ids and countries
 *  3. Score all other active channels: +40 pts same category, +20 pts same country
 *  4. Sort by score DESC, break ties by view_count
 *  5. Return top N (default 10)
 *
 * Cache: Redis key `rec:{userId}` with 10 min TTL
 */
import { Injectable, Inject } from "@nestjs/common";
import { Pool }               from "pg";
import { DB_POOL }            from "../../database/database.module";
import { REDIS_CLIENT }       from "../../database/redis.module";
import type Redis             from "ioredis";

const CACHE_TTL = 600;  // seconds

@Injectable()
export class RecommendationsService {
  constructor(
    @Inject(DB_POOL)      private readonly db:    Pool,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async forUser(userId: string, limit = 10): Promise<unknown[]> {
    const cacheKey = `rec:${userId}`;
    const cached   = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Top channels the user watches
    const { rows: topWatched } = await this.db.query<{
      channel_id: string; category_id: string | null; country: string | null;
    }>(
      `SELECT ws.channel_id, c.category_id, c.country
       FROM tv_watch_stats ws
       JOIN tv_channels c ON c.id = ws.channel_id
       WHERE ws.user_id = $1 AND ws.date >= NOW() - INTERVAL '30 days'
       ORDER BY ws.total_watch_sec DESC
       LIMIT 5`,
      [userId]
    );

    // No history → return featured channels
    if (!topWatched.length) {
      const { rows } = await this.db.query(
        `SELECT id, slug, name, name_ar, logo_url, country, quality, view_count
         FROM tv_channels WHERE is_featured = TRUE AND is_active = TRUE
         ORDER BY view_count DESC LIMIT $1`,
        [limit]
      );
      return rows;
    }

    const watchedIds  = topWatched.map(r => r.channel_id);
    const categories  = [...new Set(topWatched.map(r => r.category_id).filter(Boolean))];
    const countries   = [...new Set(topWatched.map(r => r.country).filter(Boolean))];

    const { rows: candidates } = await this.db.query(
      `SELECT
         c.id, c.slug, c.name, c.name_ar, c.logo_url, c.country, c.quality,
         c.view_count, c.category_id,
         (CASE WHEN c.category_id = ANY($2::uuid[]) THEN 40 ELSE 0 END
          + CASE WHEN c.country = ANY($3::text[]) THEN 20 ELSE 0 END) AS score
       FROM tv_channels c
       WHERE c.is_active = TRUE
         AND c.id <> ALL($1::uuid[])
       ORDER BY score DESC, c.view_count DESC
       LIMIT $4`,
      [watchedIds, categories, countries, limit]
    );

    await this.redis.setex(cacheKey, CACHE_TTL, JSON.stringify(candidates));
    return candidates;
  }

  async invalidate(userId: string) {
    await this.redis.del(`rec:${userId}`);
  }
}
