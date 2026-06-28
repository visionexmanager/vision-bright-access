import { Controller, Get, Query, UseGuards, ParseUUIDPipe, Param } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { JwtAuthGuard }     from "../../guards/jwt-auth.guard";

@Controller("api/tv/analytics")
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly svc: AnalyticsService) {}

  @Get("channels/:id/stats")
  channelStats(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("days") days?: string,
  ) {
    return this.svc.getChannelStats(id, days ? parseInt(days) : 7);
  }

  @Get("channels/top")
  topChannels(@Query("limit") limit?: string) {
    return this.svc.getTopChannels(limit ? parseInt(limit) : 10);
  }

  @Get("health/summary")
  healthSummary() {
    return this.svc.getStreamHealthSummary();
  }
}
