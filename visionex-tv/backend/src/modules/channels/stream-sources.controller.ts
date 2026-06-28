/**
 * StreamSourcesController
 * Manages multiple stream sources per channel.
 * GET    /api/tv/channels/:channelId/sources
 * POST   /api/tv/channels/:channelId/sources
 * PATCH  /api/tv/channels/:channelId/sources/:sourceId
 * DELETE /api/tv/channels/:channelId/sources/:sourceId
 */
import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from "@nestjs/common";
import { JwtAuthGuard }  from "../../guards/jwt-auth.guard";
import { DB_POOL }       from "../../database/database.module";
import { Pool }          from "pg";
import { Inject }        from "@nestjs/common";
import {
  IsString, IsInt, IsOptional, IsIn, IsUrl, Min, Max,
} from "class-validator";

class CreateSourceDto {
  @IsString()  url!:      string;
  @IsOptional() @IsIn(["hls","dash","mp4","rtmp"]) type?: string;
  @IsOptional() @IsInt() @Min(0) @Max(99)          priority?: number;
  @IsOptional() @IsString()                        label?:    string;
  @IsOptional() @IsString()                        headers?:  string;
}

class UpdateSourceDto {
  @IsOptional() @IsString()  url?:      string;
  @IsOptional() @IsString()  type?:     string;
  @IsOptional() @IsInt() @Min(0) @Max(99) priority?: number;
  @IsOptional() @IsString()  label?:    string;
  @IsOptional()              isActive?: boolean;
}

@Controller("api/tv/channels/:channelId/sources")
@UseGuards(JwtAuthGuard)
export class StreamSourcesController {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  @Get()
  async list(@Param("channelId", ParseUUIDPipe) channelId: string) {
    const { rows } = await this.db.query(
      `SELECT id, url, type, priority, label, reliability, latency_ms,
              is_active, success_count, failure_count, last_checked_at
       FROM tv_stream_sources
       WHERE channel_id = $1
       ORDER BY priority ASC, reliability DESC`,
      [channelId]
    );
    return rows;
  }

  @Post()
  async create(
    @Param("channelId", ParseUUIDPipe) channelId: string,
    @Body() dto: CreateSourceDto
  ) {
    const type = dto.type ?? (dto.url.includes(".m3u8") ? "hls" : dto.url.includes(".mpd") ? "dash" : "mp4");
    const { rows: [src] } = await this.db.query(
      `INSERT INTO tv_stream_sources (channel_id, url, type, priority, label)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [channelId, dto.url, type, dto.priority ?? 0, dto.label ?? ""]
    );
    return src;
  }

  @Patch(":sourceId")
  async update(
    @Param("channelId", ParseUUIDPipe) channelId: string,
    @Param("sourceId",  ParseUUIDPipe) sourceId:  string,
    @Body() dto: UpdateSourceDto
  ) {
    const sets:   string[]  = [];
    const params: unknown[] = [];
    let p = 1;

    if (dto.url      != null) { sets.push(`url      = $${p++}`); params.push(dto.url); }
    if (dto.type     != null) { sets.push(`type     = $${p++}`); params.push(dto.type); }
    if (dto.priority != null) { sets.push(`priority = $${p++}`); params.push(dto.priority); }
    if (dto.label    != null) { sets.push(`label    = $${p++}`); params.push(dto.label); }
    if (dto.isActive != null) { sets.push(`is_active= $${p++}`); params.push(dto.isActive); }

    if (!sets.length) return {};
    sets.push(`updated_at = NOW()`);
    params.push(sourceId, channelId);

    const { rows: [src] } = await this.db.query(
      `UPDATE tv_stream_sources SET ${sets.join(", ")}
       WHERE id = $${p++} AND channel_id = $${p}
       RETURNING *`,
      params
    );
    return src;
  }

  @Delete(":sourceId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param("channelId", ParseUUIDPipe) channelId: string,
    @Param("sourceId",  ParseUUIDPipe) sourceId:  string,
  ) {
    await this.db.query(
      "DELETE FROM tv_stream_sources WHERE id = $1 AND channel_id = $2",
      [sourceId, channelId]
    );
  }
}
