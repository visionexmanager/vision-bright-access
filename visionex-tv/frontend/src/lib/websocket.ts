/**
 * WebSocket client — singleton Socket.io connection to /tv namespace.
 *
 * Usage:
 *   const ws = getTvSocket(accessToken);
 *   ws.on("stream.switched", handler);
 *   ws.emit("stream.error", { token, sourceId });
 */

import { io, Socket } from "socket.io-client";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3000";

export type StreamStatusEvent = {
  channelId:    string;
  sourceId:     string;
  score:        number;
  avgLatencyMs: number;
  bufferEvents: number;
};

export type StreamSwitchedEvent = {
  channelId:   string;
  newSourceId: string;
  url:         string;
  type:        string;
};

export type ChannelUpdateEvent = {
  channelId: string;
  [key: string]: unknown;
};

let socket: Socket | null = null;
let currentToken: string | null = null;

export function getTvSocket(accessToken?: string): Socket {
  if (!socket || !socket.connected) {
    socket = io(`${WS_URL}/tv`, {
      transports:         ["websocket", "polling"],
      reconnection:       true,
      reconnectionDelay:  1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    socket.on("connect", () => {
      console.log("[ws] connected");
      if (currentToken) socket?.emit("authenticate", { token: currentToken });
    });

    socket.on("disconnect", (reason) => {
      console.log(`[ws] disconnected: ${reason}`);
    });

    socket.on("error", (err: { code: number; message: string }) => {
      console.warn(`[ws] error ${err.code}: ${err.message}`);
    });
  }

  // Authenticate with new token if changed
  if (accessToken && accessToken !== currentToken) {
    currentToken = accessToken;
    if (socket.connected) {
      socket.emit("authenticate", { token: accessToken });
    }
  }

  return socket;
}

export function disconnectTvSocket() {
  socket?.disconnect();
  socket       = null;
  currentToken = null;
}

export function emitStreamError(token: string, sourceId: string) {
  socket?.emit("stream.error", { token, sourceId });
}

export function emitPlaybackStat(sourceId: string, latencyMs: number, bufferRatio?: number) {
  socket?.emit("playback.stat", { sourceId, latencyMs, bufferRatio });
}
