import { Module }                   from "@nestjs/common";
import { ChannelsService }          from "./channels.service";
import { ChannelsController }       from "./channels.controller";
import { StreamSourcesController }  from "./stream-sources.controller";

@Module({
  controllers: [ChannelsController, StreamSourcesController],
  providers:   [ChannelsService],
  exports:     [ChannelsService],
})
export class ChannelsModule {}
