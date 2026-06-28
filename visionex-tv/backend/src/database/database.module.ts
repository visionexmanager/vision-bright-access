import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool } from "pg";

export const DB_POOL = "DB_POOL";

@Global()
@Module({
  providers: [
    {
      provide: DB_POOL,
      inject:  [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const db = cfg.get("database")!;
        const pool = new Pool({
          host:     db.host,
          port:     db.port,
          database: db.name,
          user:     db.user,
          password: db.password,
          ssl:      db.ssl ? { rejectUnauthorized: false } : false,
          min:      db.poolMin,
          max:      db.poolMax,
          idleTimeoutMillis:    30_000,
          connectionTimeoutMillis: 5_000,
        });
        pool.on("error", (err) => console.error("[pg] pool error:", err.message));
        return pool;
      },
    },
  ],
  exports: [DB_POOL],
})
export class DatabaseModule {}
