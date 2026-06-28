/**
 * PlaylistsService — M3U and Xtream Codes import
 *
 * Supports:
 *  • M3U8 playlists (standard #EXTINF format)
 *  • Xtream Codes API (get_live_streams endpoint)
 */
import {
  Injectable, NotFoundException, Inject, BadRequestException,
} from "@nestjs/common";
import { Pool }          from "pg";
import { DB_POOL }       from "../../database/database.module";
import { ChannelsService } from "../channels/channels.service";

interface XtreamCredentials {
  host:     string;
  username: string;
  password: string;
}

@Injectable()
export class PlaylistsService {
  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    private readonly channels: ChannelsService,
  ) {}

  // ── Create playlist ───────────────────────────────────────────────────────
  async create(userId: string, name: string, type: "m3u" | "xtream", url?: string) {
    if ((await this.countActive(userId)) >= 20) {
      throw new BadRequestException("Maximum 20 active playlists per user");
    }

    const { rows: [row] } = await this.db.query<{ id: string }>(
      `INSERT INTO tv_user_playlists (user_id, name, type, source_url)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [userId, name, type, url ?? null]
    );
    return { id: row.id, name, type };
  }

  // ── List playlists ────────────────────────────────────────────────────────
  async list(userId: string) {
    const { rows } = await this.db.query(
      `SELECT id, name, type, source_url, last_synced_at, channel_count, created_at
       FROM tv_user_playlists
       WHERE user_id = $1 AND is_active = TRUE
       ORDER BY created_at DESC`,
      [userId]
    );
    return rows;
  }

  // ── Sync M3U playlist ─────────────────────────────────────────────────────
  async syncM3U(playlistId: string, userId: string) {
    const playlist = await this.getOwned(playlistId, userId);
    if (playlist.type !== "m3u" || !playlist.source_url) {
      throw new BadRequestException("Invalid playlist type or missing URL");
    }

    const content = await this.fetchUrl(playlist.source_url);
    const result  = await this.channels.importM3U(content);

    await this.db.query(
      `UPDATE tv_user_playlists
       SET last_synced_at = NOW(), channel_count = channel_count + $1
       WHERE id = $2`,
      [result.imported, playlistId]
    );

    return result;
  }

  // ── Import Xtream Codes ───────────────────────────────────────────────────
  async importXtream(userId: string, creds: XtreamCredentials, playlistName: string) {
    const baseUrl = creds.host.replace(/\/$/, "");
    const apiUrl  = `${baseUrl}/player_api.php?username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}&action=get_live_streams`;

    let streams: any[];
    try {
      const { default: fetch } = await import("node-fetch");
      const res = await (fetch as any)(apiUrl, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      streams = await res.json();
    } catch (e) {
      throw new BadRequestException(`Xtream API error: ${(e as Error).message}`);
    }

    if (!Array.isArray(streams) || !streams.length) {
      throw new BadRequestException("No streams returned from Xtream API");
    }

    // Convert to M3U format and import
    const m3uLines: string[] = ["#EXTM3U"];
    for (const s of streams) {
      const name    = s.name ?? "Unknown";
      const logo    = s.stream_icon ?? "";
      const cat     = s.category_name ?? "";
      const streamUrl = `${baseUrl}/live/${creds.username}/${creds.password}/${s.stream_id}.m3u8`;
      m3uLines.push(`#EXTINF:-1 tvg-logo="${logo}" group-title="${cat}",${name}`);
      m3uLines.push(streamUrl);
    }

    const result = await this.channels.importM3U(m3uLines.join("\n"));

    // Save playlist record
    const { rows: [row] } = await this.db.query<{ id: string }>(
      `INSERT INTO tv_user_playlists (user_id, name, type, source_url, last_synced_at, channel_count)
       VALUES ($1, $2, 'xtream', $3, NOW(), $4) RETURNING id`,
      [userId, playlistName, creds.host, result.imported + result.skipped]
    );

    return { id: row.id, ...result, total: streams.length };
  }

  // ── Delete playlist ───────────────────────────────────────────────────────
  async delete(playlistId: string, userId: string) {
    await this.getOwned(playlistId, userId);
    await this.db.query(
      "UPDATE tv_user_playlists SET is_active = FALSE WHERE id = $1",
      [playlistId]
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private async getOwned(playlistId: string, userId: string) {
    const { rows: [row] } = await this.db.query(
      "SELECT * FROM tv_user_playlists WHERE id = $1 AND user_id = $2 AND is_active = TRUE",
      [playlistId, userId]
    );
    if (!row) throw new NotFoundException("Playlist not found");
    return row;
  }

  private async countActive(userId: string): Promise<number> {
    const { rows: [r] } = await this.db.query<{ count: string }>(
      "SELECT COUNT(*)::INT AS count FROM tv_user_playlists WHERE user_id = $1 AND is_active = TRUE",
      [userId]
    );
    return parseInt(r.count);
  }

  private async fetchUrl(url: string): Promise<string> {
    const { default: fetch } = await import("node-fetch");
    const res = await (fetch as any)(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new BadRequestException(`Failed to fetch playlist: HTTP ${res.status}`);
    return res.text();
  }
}
