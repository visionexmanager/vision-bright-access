import { Module }             from "@nestjs/common";
import { StreamService }      from "./stream.service";
import { StreamController }   from "./stream.controller";
import { OrchestratorModule } from "../orchestrator/orchestrator.module";
import { AnalyticsModule }    from "../analytics/analytics.module";

@Module({
  imports:     [OrchestratorModule, AnalyticsModule],
  controllers: [StreamController],
  providers:   [StreamService],
  exports:     [StreamService],
})
export class StreamModule {}
