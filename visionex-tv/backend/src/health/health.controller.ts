import { Controller, Get, Inject } from "@nestjs/common";
import { Pool }          from "pg";
import { DB_POOL }       from "../database/database.module";
import { REDIS_CLIENT }  from "../database/redis.module";
import type Redis        from "ioredis";

@Controller()
export class HealthController {
  constructor(
    @Inject(DB_POOL)      private readonly db:    Pool,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get("health")
  async health() {
    const [dbOk, redisOk] = await Promise.all([
      this.db.query("SELECT 1").then(() => true).catch(() => false),
      this.redis.ping().then(r => r === "PONG").catch(() => false),
    ]);
    const status = dbOk && redisOk ? "ok" : "degraded";
    return {
      status,
      timestamp: new Date().toISOString(),
      services: { database: dbOk ? "ok" : "down", redis: redisOk ? "ok" : "down" },
    };
  }

  @Get("metrics")
  async metrics() {
    const [pool, redis] = await Promise.all([
      Promise.resolve({
        total: (this.db as any).totalCount,
        idle:  (this.db as any).idleCount,
        waiting: (this.db as any).waitingCount,
      }),
      this.redis.info("memory").catch(() => ""),
    ]);
    return { pool, timestamp: Date.now() };
  }
}
