import { Module }            from "@nestjs/common";
import { ConfigModule }      from "@nestjs/config";
import { ThrottlerModule }   from "@nestjs/throttler";
import { APP_GUARD }         from "@nestjs/core";
import { ThrottlerGuard }    from "@nestjs/throttler";
import configuration         from "./config/configuration";
import { DatabaseModule }    from "./database/database.module";
import { RedisModule }       from "./database/redis.module";
import { AuthModule }        from "./modules/auth/auth.module";
import { ChannelsModule }    from "./modules/channels/channels.module";
import { StreamModule }      from "./modules/stream/stream.module";
import { OrchestratorModule } from "./modules/orchestrator/orchestrator.module";
import { AnalyticsModule }   from "./modules/analytics/analytics.module";
import { FavoritesModule }   from "./modules/favorites/favorites.module";
import { RecommendationsModule } from "./modules/recommendations/recommendations.module";
import { PlaylistsModule }   from "./modules/playlists/playlists.module";
import { HealthController }  from "./health/health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ThrottlerModule.forRootAsync({
      useFactory: () => ([{
        ttl:   parseInt(process.env.RATE_LIMIT_TTL   ?? "60") * 1000,
        limit: parseInt(process.env.RATE_LIMIT_MAX   ?? "100"),
      }]),
    }),
    DatabaseModule,
    RedisModule,
    AuthModule,
    ChannelsModule,
    OrchestratorModule,
    StreamModule,
    AnalyticsModule,
    FavoritesModule,
    RecommendationsModule,
    PlaylistsModule,
  ],
  controllers: [HealthController],
  providers:   [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
