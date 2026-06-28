import { Injectable, Inject } from "@nestjs/common";
import { Pool }               from "pg";
import { DB_POOL }            from "../../database/database.module";
import { REDIS_CLIENT }       from "../../database/redis.module";
import type Redis             from "ioredis";

@Injectable()
export class FavoritesService {
  constructor(
    @Inject(DB_POOL)      private readonly db:    Pool,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async list(userId: string) {
    const { rows } = await this.db.query(
      `SELECT c.id, c.slug, c.name, c.name_ar, c.logo_url, c.country, c.quality,
              f.created_at AS favorited_at
       FROM tv_favorites f
       JOIN tv_channels c ON c.id = f.channel_id
       WHERE f.user_id = $1 AND c.is_active = TRUE
       ORDER BY f.created_at DESC`,
      [userId]
    );
    return rows;
  }

  async toggle(userId: string, channelId: string): Promise<{ isFavorite: boolean }> {
    const { rows: [existing] } = await this.db.query(
      "SELECT id FROM tv_favorites WHERE user_id = $1 AND channel_id = $2",
      [userId, channelId]
    );

    if (existing) {
      await this.db.query(
        "DELETE FROM tv_favorites WHERE user_id = $1 AND channel_id = $2",
        [userId, channelId]
      );
      await this.redis.del(`fav:${userId}`);
      return { isFavorite: false };
    }

    await this.db.query(
      "INSERT INTO tv_favorites (user_id, channel_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [userId, channelId]
    );
    await this.redis.del(`fav:${userId}`);
    return { isFavorite: true };
  }

  async isFavorite(userId: string, channelId: string): Promise<boolean> {
    const { rows: [row] } = await this.db.query(
      "SELECT 1 FROM tv_favorites WHERE user_id = $1 AND channel_id = $2",
      [userId, channelId]
    );
    return !!row;
  }
}
