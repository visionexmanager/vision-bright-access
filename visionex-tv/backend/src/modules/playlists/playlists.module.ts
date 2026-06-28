import { Module }              from "@nestjs/common";
import { PlaylistsService }    from "./playlists.service";
import { PlaylistsController } from "./playlists.controller";
import { ChannelsModule }      from "../channels/channels.module";

@Module({
  imports:     [ChannelsModule],
  controllers: [PlaylistsController],
  providers:   [PlaylistsService],
})
export class PlaylistsModule {}
