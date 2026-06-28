import {
  Controller, Post, Body, UseGuards,
  Req, HttpCode, HttpStatus, Param,
} from "@nestjs/common";
import { StreamService }   from "./stream.service";
import { JwtAuthGuard }    from "../../guards/jwt-auth.guard";
import { IsString, IsInt, IsOptional, IsUUID, Min, Max } from "class-validator";
import type { Request }    from "express";

class StartStreamDto {
  @IsUUID() channelId!: string;
}

class SwitchStreamDto {
  @IsString() token!: string;
  @IsUUID()   failedSourceId!: string;
}

class StopStreamDto {
  @IsString()              token!: string;
  @IsInt() @Min(0) @Max(86400) watchedSeconds!: number;
}

class HeartbeatDto {
  @IsString()                  token!: string;
  @IsInt() @Min(0) @Max(100)   bufferHealth!: number;
}

@Controller("api/tv/stream")
@UseGuards(JwtAuthGuard)
export class StreamController {
  constructor(private readonly stream: StreamService) {}

  @Post("start")
  async start(@Body() dto: StartStreamDto, @Req() req: Request) {
    const user      = (req as any).user;
    const ip        = req.ip ?? "unknown";
    const userAgent = req.get("user-agent") ?? "";
    return this.stream.start(user.id, dto.channelId, ip, userAgent);
  }

  @Post("switch")
  async switch_(@Body() dto: SwitchStreamDto, @Req() req: Request) {
    return this.stream.switch_((req as any).user.id, dto.token, dto.failedSourceId);
  }

  @Post("heartbeat")
  @HttpCode(HttpStatus.NO_CONTENT)
  async heartbeat(@Body() dto: HeartbeatDto) {
    await this.stream.heartbeat(dto.token, dto.bufferHealth);
  }

  @Post("stop")
  @HttpCode(HttpStatus.NO_CONTENT)
  async stop(@Body() dto: StopStreamDto, @Req() req: Request) {
    await this.stream.stop((req as any).user.id, dto.token, dto.watchedSeconds);
  }
}
