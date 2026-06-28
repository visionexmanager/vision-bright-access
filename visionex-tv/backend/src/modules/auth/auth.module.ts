import { Module }        from "@nestjs/common";
import { JwtModule }     from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { AuthService }   from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy }   from "./strategies/jwt.strategy";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      inject:      [ConfigService],
      useFactory:  (cfg: ConfigService) => ({
        secret:      cfg.get("jwt.secret"),
        signOptions: { expiresIn: cfg.get("jwt.accessExpiresIn") },
      }),
    }),
  ],
  controllers: [AuthController],
  providers:   [AuthService, JwtStrategy],
  exports:     [JwtModule, AuthService],
})
export class AuthModule {}
