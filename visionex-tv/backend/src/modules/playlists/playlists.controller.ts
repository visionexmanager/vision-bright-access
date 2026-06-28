import {
  Controller, Get, Post, Delete, Param, Body,
  UseGuards, Req, ParseUUIDPipe,
} from "@nestjs/common";
import { PlaylistsService }   from "./playlists.service";
import { JwtAuthGuard }       from "../../guards/jwt-auth.guard";
import { IsString, IsUrl, IsOptional } from "class-validator";
import type { Request }       from "express";

class CreatePlaylistDto {
  @IsString()   name!:    string;
  @IsString()   type!:    "m3u" | "xtream";
  @IsOptional() @IsString() url?: string;
}

class XtreamImportDto {
  @IsString() host!:       string;
  @IsString() username!:   string;
  @IsString() password!:   string;
  @IsString() playlistName!: string;
}

@Controller("api/tv/playlists")
@UseGuards(JwtAuthGuard)
export class PlaylistsController {
  constructor(private readonly svc: PlaylistsService) {}

  @Get()
  list(@Req() req: Request) {
    return this.svc.list((req as any).user.id);
  }

  @Post()
  create(@Body() dto: CreatePlaylistDto, @Req() req: Request) {
    return this.svc.create((req as any).user.id, dto.name, dto.type, dto.url);
  }

  @Post(":id/sync")
  sync(@Param("id", ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.svc.syncM3U(id, (req as any).user.id);
  }

  @Post("xtream")
  importXtream(@Body() dto: XtreamImportDto, @Req() req: Request) {
    return this.svc.importXtream(
      (req as any).user.id,
      { host: dto.host, username: dto.username, password: dto.password },
      dto.playlistName
    );
  }

  @Delete(":id")
  delete(@Param("id", ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.svc.delete(id, (req as any).user.id);
  }
}
