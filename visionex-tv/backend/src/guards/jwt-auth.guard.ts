import { Injectable, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { AuthGuard }   from "@nestjs/passport";
import { REDIS_CLIENT } from "../database/redis.module";
import { Inject }      from "@nestjs/common";
import type Redis      from "ioredis";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    super();
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const ok = await super.canActivate(ctx);
    if (!ok) return false;

    // Check if access token is blacklisted (after logout)
    const req  = ctx.switchToHttp().getRequest();
    const user = req.user;
    const bl   = await this.redis.get(`bl:${user.id}`);
    if (bl) throw new UnauthorizedException("Token has been revoked");

    return true;
  }

  handleRequest(err: any, user: any) {
    if (err || !user) throw new UnauthorizedException("Invalid or expired token");
    return user;
  }
}
