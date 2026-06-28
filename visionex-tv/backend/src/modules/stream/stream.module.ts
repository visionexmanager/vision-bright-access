import { Module }             from "@nestjs/common";
import { StreamService }      from "./stream.service";
import { StreamController }   from "./stream.controller";
import { OrchestratorModule } from "../orchestrator/orchestrator.module";
import { AnalyticsModule }    from "../analytics/analytics.module";
import { StreamHealthModule } from "../stream-health/stream-health.module";

@Module({
  imports:     [OrchestratorModule, AnalyticsModule, StreamHealthModule],
  controllers: [StreamController],
  providers:   [StreamService],
  exports:     [StreamService],
})
export class StreamModule {}
