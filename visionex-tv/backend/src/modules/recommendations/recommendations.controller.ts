import { Controller, Get, Query, UseGuards, Req } from "@nestjs/common";
import { RecommendationsService } from "./recommendations.service";
import { JwtAuthGuard }           from "../../guards/jwt-auth.guard";
import type { Request }           from "express";

@Controller("api/tv/recommendations")
@UseGuards(JwtAuthGuard)
export class RecommendationsController {
  constructor(private readonly svc: RecommendationsService) {}

  @Get()
  forUser(@Req() req: Request, @Query("limit") limit?: string) {
    return this.svc.forUser((req as any).user.id, limit ? parseInt(limit) : 10);
  }
}
