/**
 * TvGateway — NestJS WebSocket Gateway (Socket.io)
 *
 * Events FROM client:
 *   authenticate   { token }                → join user room
 *   stream.error   { token, sourceId }      → trigger failover
 *   playback.stat  { token, latencyMs, bufferRatio } → health metrics
 *
 * Events TO client:
 *   authenticated                           → { userId }
 *   stream.status.update                    → { channelId, sourceId, score }
 *   stream.switched                         → { channelId, newSourceId, url }
 *   channel.update                          → { channel }
 *   recommendation.update                   → (invalidate cache signal)
 *   error                                   → { code, message }
 */

import {
  WebSocketGateway, WebSocketServer,
  SubscribeMessage, MessageBody, ConnectedSocket,
  OnGatewayConnection, OnGatewayDisconnect,
  WsException,
} from "@nestjs/websockets";
import { Logger, UseFilters }     from "@nestjs/common";
import { Server, Socket }         from "socket.io";
import { JwtService }             from "@nestjs/jwt";
import { StreamHealthService }    from "../stream-health/stream-health.service";
import { StreamService }          from "../stream/stream.service";

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN ?? "*", credentials: true },
  namespace: "/tv",
  transports: ["websocket", "polling"],
  pingInterval: 25_000,
  pingTimeout:  20_000,
})
export class TvGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(TvGateway.name);

  constructor(
    private readonly jwt:    JwtService,
    private readonly health: StreamHealthService,
    private readonly stream: StreamService,
  ) {}

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  handleConnection(client: AuthenticatedSocket) {
    this.logger.debug(`[ws] connect ${client.id}`);
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.debug(`[ws] disconnect ${client.id} user=${client.userId ?? "anon"}`);
  }

  // ── Authentication ────────────────────────────────────────────────────────

  @SubscribeMessage("authenticate")
  async handleAuthenticate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()    data:   { token: string }
  ) {
    try {
      const payload = this.jwt.verify<{ sub: string; email: string }>(data.token);
      client.userId = payload.sub;
      await client.join(`user:${payload.sub}`);
      client.emit("authenticated", { userId: payload.sub });
      this.logger.log(`[ws] user ${payload.sub} authenticated via ${client.id}`);
    } catch {
      client.emit("error", { code: 401, message: "Invalid token" });
      client.disconnect();
    }
  }

  // ── Stream error → trigger failover ──────────────────────────────────────

  @SubscribeMessage("stream.error")
  async handleStreamError(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()    data:   { token: string; sourceId: string }
  ) {
    if (!client.userId) return;

    try {
      // Record the error in health system
      await this.health.recordError(data.sourceId);

      // Ask stream service to switch source
      const next = await this.stream.switch_(client.userId, data.token, data.sourceId);
      if (next) {
        client.emit("stream.switched", {
          channelId:   next.channelId,
          newSourceId: next.sourceId,
          url:         next.url,
          type:        next.type,
        });
        // Broadcast updated health to all viewers of that channel
        this.broadcastHealthUpdate(next.channelId, data.sourceId);
      } else {
        client.emit("error", { code: 503, message: "No fallback stream available" });
      }
    } catch (e) {
      this.logger.warn(`[ws] stream.error handling failed: ${(e as Error).message}`);
    }
  }

  // ── Playback stats from player ────────────────────────────────────────────

  @SubscribeMessage("playback.stat")
  async handlePlaybackStat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()    data:   { token: string; sourceId: string; latencyMs: number; bufferRatio?: number }
  ) {
    if (!client.userId || !data.sourceId) return;

    await Promise.allSettled([
      this.health.recordLatency(data.sourceId, data.latencyMs),
      data.bufferRatio != null && data.bufferRatio > 0.05
        ? this.health.recordBufferEvent(data.sourceId)
        : Promise.resolve(),
    ]);
  }

  // ── Broadcast helpers (called from services) ──────────────────────────────

  async broadcastHealthUpdate(channelId: string, sourceId: string) {
    const snap = await this.health.getSnapshot(sourceId);
    this.server.emit("stream.status.update", {
      channelId,
      sourceId,
      score:       snap.score,
      avgLatencyMs: snap.avgLatencyMs,
      bufferEvents: snap.bufferEvents,
    });
  }

  broadcastChannelUpdate(channelId: string, data: Record<string, unknown>) {
    this.server.emit("channel.update", { channelId, ...data });
  }

  broadcastRecommendationUpdate(userId: string) {
    this.server.to(`user:${userId}`).emit("recommendation.update");
  }
}
