import {
  Controller, Get, Patch, Delete, Body, Query,
  UseGuards, Param, ParseUUIDPipe, HttpCode, HttpStatus,
} from "@nestjs/common";
import { UsersService }   from "./users.service";
import { JwtAuthGuard }   from "../../guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../common/decorators/current-user.decorator";
import { IsString, IsBoolean, IsArray, IsOptional, IsIn, IsUrl } from "class-validator";

class UpdateProfileDto {
  @IsOptional() @IsString() displayName?: string;
  @IsOptional() @IsString() avatarUrl?:   string;
}

class UpdatePrefsDto {
  @IsOptional() @IsString()   language?:             string;
  @IsOptional() @IsIn(["auto", "SD", "HD", "FHD"]) quality?: "auto" | "SD" | "HD" | "FHD";
  @IsOptional() @IsBoolean()  subtitlesEnabled?:     boolean;
  @IsOptional() @IsBoolean()  autoplay?:             boolean;
  @IsOptional() @IsBoolean()  notificationsEnabled?: boolean;
  @IsOptional() @IsArray()    preferredCategories?:  string[];
  @IsOptional() @IsArray()    preferredCountries?:   string[];
}

@Controller("api/tv/users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Get("me")
  getProfile(@CurrentUser() user: AuthUser) {
    return this.svc.getProfile(user.id);
  }

  @Patch("me")
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.svc.updateProfile(user.id, dto);
  }

  @Get("me/preferences")
  getPrefs(@CurrentUser() user: AuthUser) {
    return this.svc.getPreferences(user.id);
  }

  @Patch("me/preferences")
  updatePrefs(@CurrentUser() user: AuthUser, @Body() dto: UpdatePrefsDto) {
    return this.svc.updatePreferences(user.id, dto);
  }

  @Get("me/history")
  getHistory(
    @CurrentUser() user: AuthUser,
    @Query("limit")  limit?:  string,
    @Query("offset") offset?: string,
  ) {
    return this.svc.getWatchHistory(user.id, limit ? parseInt(limit) : 20, offset ? parseInt(offset) : 0);
  }

  @Delete("me/history")
  @HttpCode(HttpStatus.NO_CONTENT)
  clearHistory(@CurrentUser() user: AuthUser) {
    return this.svc.clearHistory(user.id);
  }

  @Delete("me/history/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteEntry(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.svc.deleteHistoryEntry(user.id, id);
  }

  @Get("me/stats")
  getStats(@CurrentUser() user: AuthUser, @Query("days") days?: string) {
    return this.svc.getWatchStats(user.id, days ? parseInt(days) : 30);
  }
}
