import {
  Controller, Post, Body, UseGuards,
  HttpCode, HttpStatus, Get, Req,
} from "@nestjs/common";
import { Throttle }            from "@nestjs/throttler";
import { AuthService }         from "./auth.service";
import { LoginDto, RegisterDto, RefreshTokenDto } from "./dto/login.dto";
import { JwtAuthGuard }        from "../../guards/jwt-auth.guard";
import type { Request }        from "express";

@Controller("api/auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Body() dto: RefreshTokenDto) {
    const user = (req as any).user;
    await this.auth.logout(user.id, dto.refreshToken);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  getMe(@Req() req: Request) {
    return (req as any).user;
  }
}
