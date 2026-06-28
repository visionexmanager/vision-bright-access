import { Controller, Get, Post, Body, Param, UseGuards } from "@nestjs/common";
import { StreamHealthService } from "./stream-health.service";
import { JwtAuthGuard }        from "../../guards/jwt-auth.guard";
import { IsString, IsInt, Min, IsUUID } from "class-validator";

class RecordLatencyDto {
  @IsUUID()  sourceId!:  string;
  @IsInt() @Min(0) latencyMs!: number;
}

class RecordEventDto {
  @IsUUID()  sourceId!:  string;
  @IsString() type!: "buffer" | "error";
}

@Controller("api/tv/health")
@UseGuards(JwtAuthGuard)
export class StreamHealthController {
  constructor(private readonly svc: StreamHealthService) {}

  @Get("sources/:id")
  snapshot(@Param("id") id: string) {
    return this.svc.getSnapshot(id);
  }

  @Post("latency")
  recordLatency(@Body() dto: RecordLatencyDto) {
    return this.svc.recordLatency(dto.sourceId, dto.latencyMs);
  }

  @Post("event")
  async recordEvent(@Body() dto: RecordEventDto) {
    if (dto.type === "buffer") await this.svc.recordBufferEvent(dto.sourceId);
    else                       await this.svc.recordError(dto.sourceId);
    return { ok: true };
  }
}
