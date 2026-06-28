import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

export const REDIS_CLIENT = "REDIS_CLIENT";

@Global()
@Module({
  providers: [
    {
      provide:    REDIS_CLIENT,
      inject:     [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const r = cfg.get("redis")!;
        const client = new Redis({
          host:            r.host,
          port:            r.port,
          password:        r.password,
          db:              r.db,
          lazyConnect:     false,
          retryStrategy:   (times) => Math.min(times * 100, 3000),
          enableReadyCheck: true,
        });
        client.on("error", (e) => console.error("[redis] error:", e.message));
        client.on("ready", ()  => console.log("[redis] connected"));
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
