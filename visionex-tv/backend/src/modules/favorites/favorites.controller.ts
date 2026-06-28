import { Controller, Get, Post, Delete, Param, UseGuards, Req, ParseUUIDPipe } from "@nestjs/common";
import { FavoritesService } from "./favorites.service";
import { JwtAuthGuard }     from "../../guards/jwt-auth.guard";
import type { Request }     from "express";

@Controller("api/tv/favorites")
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly svc: FavoritesService) {}

  @Get()
  list(@Req() req: Request) {
    return this.svc.list((req as any).user.id);
  }

  @Post(":channelId")
  toggle(@Param("channelId", ParseUUIDPipe) channelId: string, @Req() req: Request) {
    return this.svc.toggle((req as any).user.id, channelId);
  }

  @Get(":channelId")
  check(@Param("channelId", ParseUUIDPipe) channelId: string, @Req() req: Request) {
    return this.svc.isFavorite((req as any).user.id, channelId).then(isFavorite => ({ isFavorite }));
  }
}
