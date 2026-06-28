import { Module }             from "@nestjs/common";
import { TvGateway }          from "./tv.gateway";
import { AuthModule }         from "../auth/auth.module";
import { StreamHealthModule } from "../stream-health/stream-health.module";
import { StreamModule }       from "../stream/stream.module";

@Module({
  imports:   [AuthModule, StreamHealthModule, StreamModule],
  providers: [TvGateway],
  exports:   [TvGateway],
})
export class GatewayModule {}
