import { Module }                from "@nestjs/common";
import { StreamHealthService }   from "./stream-health.service";
import { StreamHealthController } from "./stream-health.controller";

@Module({
  controllers: [StreamHealthController],
  providers:   [StreamHealthService],
  exports:     [StreamHealthService],
})
export class StreamHealthModule {}
