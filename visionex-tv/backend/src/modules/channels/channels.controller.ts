import {
  Controller, Get, Post, Param, Query, Body,
  UseGuards, ParseUUIDPipe,
} from "@nestjs/common";
import { ChannelsService, ChannelFilter } from "./channels.service";
import { JwtAuthGuard }  from "../../guards/jwt-auth.guard";
import { IsString, IsOptional } from "class-validator";

class ImportM3UDto {
  @IsString() content!:    string;
  @IsOptional() @IsString() categoryId?: string;
}

@Controller("api/tv/channels")
export class ChannelsController {
  constructor(private readonly svc: ChannelsService) {}

  @Get()
  findAll(
    @Query("category")  categoryId?: string,
    @Query("country")   country?:    string,
    @Query("quality")   quality?:    string,
    @Query("search")    search?:     string,
    @Query("featured")  featured?:   string,
    @Query("limit")     limit?:      string,
    @Query("offset")    offset?:     string,
  ) {
    return this.svc.findAll({
      categoryId,
      country,
      quality,
      search,
      featured: featured === "true",
      limit:  limit  ? parseInt(limit)  : 50,
      offset: offset ? parseInt(offset) : 0,
    });
  }

  @Get("categories")
  getCategories() {
    return this.svc.getCategories();
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }

  @Post("import/m3u")
  @UseGuards(JwtAuthGuard)
  importM3U(@Body() dto: ImportM3UDto) {
    return this.svc.importM3U(dto.content, dto.categoryId);
  }
}
