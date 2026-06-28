import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy }                  from "@nestjs/passport";
import { ExtractJwt, Strategy }              from "passport-jwt";
import { ConfigService }                     from "@nestjs/config";

export interface JwtPayload {
  sub:   string;
  email: string;
  role:  string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(cfg: ConfigService) {
    super({
      jwtFromRequest:   ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:      cfg.get("jwt.secret")!,
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub) throw new UnauthorizedException();
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
