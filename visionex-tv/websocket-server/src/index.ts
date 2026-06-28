/**
 * Visionex TV — WebSocket Server
 *
 * Events emitted to clients:
 *  • stream.status.update  — source reliability changed
 *  • channel.update        — channel metadata changed
 *  • playback.health       — buffer/error stats from a session
 *  • recommendation.update — recs invalidated for user
 *
 * Events received from clients:
 *  • subscribe   { token }           — authenticate and join user room
 *  • stream.error { token, sourceId } — report playback error
 */

import { createServer }  from "node:http";
import { Server }        from "socket.io";
import Redis             from "ioredis";

const PORT      = parseInt(process.env.WS_PORT    ?? "3001");
const REDIS_URL = process.env.REDIS_URL           ?? "redis://localhost:6379";
const BACKEND   = process.env.BACKEND_URL         ?? "http://localhost:3000";
const CORS_ORIGIN = process.env.CORS_ORIGIN       ?? "http://localhost:5173";

const http = createServer();
const io   = new Server(http, {
  cors: { origin: CORS_ORIGIN, methods: ["GET", "POST"], credentials: true },
  transports: ["websocket", "polling"],
  pingInterval: 25_000,
  pingTimeout:  20_000,
});

// Subscribe to Redis pub/sub to relay internal events to sockets
const sub = new Redis(REDIS_URL);
sub.subscribe("vx:stream:health", "vx:channel:update", "vx:rec:invalidate");

sub.on("message", (channel, message) => {
  try {
    const data = JSON.parse(message);
    if (channel === "vx:stream:health")     io.emit("stream.status.update", data);
    if (channel === "vx:channel:update")    io.emit("channel.update", data);
    if (channel === "vx:rec:invalidate")    io.to(`user:${data.userId}`).emit("recommendation.update");
  } catch {}
});

// ── Connection handler ─────────────────────────────────────────────────────
io.on("connection", (socket) => {
  let userId: string | null = null;

  console.log(`[ws] connect ${socket.id}`);

  // Authenticate and join user room
  socket.on("subscribe", async ({ token }: { token: string }) => {
    try {
      const { default: fetch } = await import("node-fetch");
      const res = await (fetch as any)(`${BACKEND}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { socket.emit("error", { code: 401, message: "Unauthorized" }); return; }

      const user = await res.json() as { id: string };
      userId = user.id;
      socket.join(`user:${userId}`);
      socket.emit("subscribed", { userId });
      console.log(`[ws] user ${userId} joined via ${socket.id}`);
    } catch {
      socket.emit("error", { code: 500, message: "Authentication failed" });
    }
  });

  // Client reports a stream error
  socket.on("stream.error", async ({ token, sourceId }: { token: string; sourceId: string }) => {
    if (!userId) return;
    try {
      const { default: fetch } = await import("node-fetch");
      await (fetch as any)(`${BACKEND}/api/tv/stream/switch`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ token, failedSourceId: sourceId }),
      });
    } catch {}
  });

  socket.on("disconnect", () => {
    console.log(`[ws] disconnect ${socket.id} user=${userId ?? "anon"}`);
  });
});

http.listen(PORT, () => console.log(`[ws] WebSocket server listening on :${PORT}`));
