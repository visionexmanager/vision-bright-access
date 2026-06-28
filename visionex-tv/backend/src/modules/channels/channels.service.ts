import { Injectable, NotFoundException, Inject } from "@nestjs/common";
import { Pool }        from "pg";
import { DB_POOL }     from "../../database/database.module";
import { REDIS_CLIENT } from "../../database/redis.module";
import type Redis      from "ioredis";

export interface ChannelFilter {
  categoryId?: string;
  country?:    string;
  quality?:    string;
  search?:     string;
  featured?:   boolean;
  limit?:      number;
  offset?:     number;
}

@Injectable()
export class ChannelsService {
  constructor(
    @Inject(DB_POOL)      private readonly db:    Pool,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // ── List channels ─────────────────────────────────────────────────────────
  async findAll(filter: ChannelFilter = {}) {
    const {
      categoryId, country, quality, search, featured,
      limit = 50, offset = 0,
    } = filter;

    const conditions: string[] = ["c.is_active = TRUE"];
    const params: unknown[]    = [];
    let   p                    = 1;

    if (categoryId) { conditions.push(`c.category_id = $${p++}`); params.push(categoryId); }
    if (country)    { conditions.push(`c.country = $${p++}`);      params.push(country); }
    if (quality)    { conditions.push(`c.quality = $${p++}`);      params.push(quality); }
    if (featured)   { conditions.push("c.is_featured = TRUE"); }

    if (search) {
      conditions.push(
        `(to_tsvector('simple', c.name || ' ' || c.name_ar || ' ' || coalesce(c.country,''))
          @@ plainto_tsquery('simple', $${p++})
          OR c.name ILIKE $${p++}
          OR c.name_ar ILIKE $${p++})`
      );
      params.push(search, `%${search}%`, `%${search}%`);
    }

    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

    const { rows } = await this.db.query(
      `SELECT
         c.id, c.slug, c.name, c.name_ar, c.description, c.description_ar,
         c.logo_url, c.country, c.language, c.quality, c.is_featured,
         c.official_url, c.view_count,
         cat.id   AS category_id,
         cat.slug AS category_slug,
         cat.name AS category_name,
         cat.name_ar AS category_name_ar,
         (SELECT COUNT(*) FROM tv_channels WHERE is_active = TRUE ${categoryId ? "AND category_id = $1" : ""}) AS total
       FROM tv_channels c
       LEFT JOIN tv_categories cat ON cat.id = c.category_id
       ${where}
       ORDER BY c.is_featured DESC, c.view_count DESC, c.name ASC
       LIMIT $${p++} OFFSET $${p}`,
      [...params, limit, offset]
    );

    return {
      data:   rows.map(this.formatChannel),
      total:  rows[0]?.total ?? 0,
      limit,
      offset,
    };
  }

  // ── Get single channel ────────────────────────────────────────────────────
  async findOne(id: string) {
    const { rows: [row] } = await this.db.query(
      `SELECT
         c.id, c.slug, c.name, c.name_ar, c.description, c.description_ar,
         c.logo_url, c.country, c.language, c.quality, c.is_featured,
         c.official_url, c.view_count,
         cat.id   AS category_id,
         cat.slug AS category_slug,
         cat.name AS category_name,
         cat.name_ar AS category_name_ar
       FROM tv_channels c
       LEFT JOIN tv_categories cat ON cat.id = c.category_id
       WHERE c.id = $1 AND c.is_active = TRUE`,
      [id]
    );
    if (!row) throw new NotFoundException("Channel not found");

    // Increment view count asynchronously
    this.db.query("UPDATE tv_channels SET view_count = view_count + 1 WHERE id = $1", [id]).catch(() => {});

    return this.formatChannel(row);
  }

  // ── List categories ───────────────────────────────────────────────────────
  async getCategories() {
    const { rows } = await this.db.query(
      `SELECT cat.id, cat.slug, cat.name, cat.name_ar, cat.icon, cat.sort_order,
              COUNT(c.id)::INT AS channel_count
       FROM tv_categories cat
       LEFT JOIN tv_channels c ON c.category_id = cat.id AND c.is_active = TRUE
       WHERE cat.is_active = TRUE
       GROUP BY cat.id
       ORDER BY cat.sort_order ASC`
    );
    return rows;
  }

  // ── Import from M3U playlist ──────────────────────────────────────────────
  async importM3U(content: string, defaultCategoryId?: string): Promise<{ imported: number; skipped: number }> {
    const channels = this.parseM3U(content);
    let imported = 0, skipped = 0;

    for (const ch of channels) {
      const slug = this.slugify(ch.name);
      const existing = await this.db.query(
        "SELECT id FROM tv_channels WHERE slug = $1",
        [slug]
      );

      if (existing.rows.length) {
        // Update existing
        await this.db.query(
          `UPDATE tv_channels
           SET logo_url = COALESCE($1, logo_url), updated_at = NOW()
           WHERE slug = $2`,
          [ch.logo, slug]
        );
        // Add or update stream source
        await this.upsertStreamSource(existing.rows[0].id, ch.url);
        skipped++;
      } else {
        // Insert new channel
        const { rows: [inserted] } = await this.db.query<{ id: string }>(
          `INSERT INTO tv_channels
             (slug, name, name_ar, logo_url, country, category_id, language)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [slug, ch.name, "", ch.logo, ch.country, defaultCategoryId ?? null, ch.language ?? "ar"]
        );
        await this.upsertStreamSource(inserted.id, ch.url);
        imported++;
      }
    }

    // Invalidate channels cache
    await this.redis.del("channels:all");

    return { imported, skipped };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private async upsertStreamSource(channelId: string, url: string) {
    await this.db.query(
      `INSERT INTO tv_stream_sources (channel_id, url, type, priority, label)
       VALUES ($1, $2, $3, 0, 'imported')
       ON CONFLICT DO NOTHING`,
      [channelId, url, url.includes(".m3u8") ? "hls" : "http"]
    );
  }

  private formatChannel(row: Record<string, unknown>) {
    return {
      id:          row.id,
      slug:        row.slug,
      name:        row.name,
      nameAr:      row.name_ar,
      description: row.description,
      descriptionAr: row.description_ar,
      logoUrl:     row.logo_url,
      country:     row.country,
      language:    row.language,
      quality:     row.quality,
      isFeatured:  row.is_featured,
      officialUrl: row.official_url,
      viewCount:   row.view_count,
      category: row.category_id ? {
        id:     row.category_id,
        slug:   row.category_slug,
        name:   row.category_name,
        nameAr: row.category_name_ar,
      } : null,
    };
  }

  private parseM3U(content: string) {
    const lines   = content.split("\n").map(l => l.trim());
    const results: Array<{ name: string; logo?: string; url: string; country?: string; language?: string }> = [];
    let current: Partial<(typeof results)[0]> = {};

    for (const line of lines) {
      if (line.startsWith("#EXTINF")) {
        current = {
          name:     line.match(/,(.+)$/)?.[1]?.trim() ?? "Unknown",
          logo:     line.match(/tvg-logo="([^"]+)"/)?.[1],
          country:  line.match(/tvg-country="([^"]+)"/)?.[1],
          language: line.match(/tvg-language="([^"]+)"/)?.[1],
        };
      } else if (line && !line.startsWith("#") && current.name) {
        results.push({ ...(current as any), url: line });
        current = {};
      }
    }
    return results;
  }

  private slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
}
