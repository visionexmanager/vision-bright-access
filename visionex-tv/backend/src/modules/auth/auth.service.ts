import {
  Injectable, UnauthorizedException,
  ConflictException, Inject,
} from "@nestjs/common";
import { JwtService }     from "@nestjs/jwt";
import { ConfigService }  from "@nestjs/config";
import { Pool }           from "pg";
import * as bcrypt        from "bcryptjs";
import { randomBytes }    from "node:crypto";
import { DB_POOL }        from "../../database/database.module";
import { REDIS_CLIENT }   from "../../database/redis.module";
import type Redis         from "ioredis";
import type { LoginDto, RegisterDto } from "./dto/login.dto";

@Injectable()
export class AuthService {
  private readonly jwtCfg: { secret: string; accessExpiresIn: string; refreshExpiresIn: string };

  constructor(
    @Inject(DB_POOL)      private readonly db:    Pool,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly jwt: JwtService,
    private readonly cfg: ConfigService,
  ) {
    this.jwtCfg = cfg.get("jwt")!;
  }

  // ── Register ──────────────────────────────────────────────────────────────
  async register(dto: RegisterDto) {
    const existing = await this.db.query(
      "SELECT id FROM users WHERE email = $1",
      [dto.email.toLowerCase()]
    );
    if (existing.rows.length) throw new ConflictException("Email already registered");

    const hash = await bcrypt.hash(dto.password, 12);
    const { rows: [user] } = await this.db.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, display_name)
       VALUES ($1, $2, $3) RETURNING id`,
      [dto.email.toLowerCase(), hash, dto.displayName]
    );

    return this.issueTokens(user.id, dto.email, "user");
  }

  // ── Login ─────────────────────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const { rows: [user] } = await this.db.query<{
      id: string; email: string; password_hash: string; role: string; is_active: boolean;
    }>(
      "SELECT id, email, password_hash, role, is_active FROM users WHERE email = $1",
      [dto.email.toLowerCase()]
    );

    if (!user || !user.is_active)     throw new UnauthorizedException("Invalid credentials");
    const match = await bcrypt.compare(dto.password, user.password_hash);
    if (!match)                        throw new UnauthorizedException("Invalid credentials");

    return this.issueTokens(user.id, user.email, user.role);
  }

  // ── Refresh ───────────────────────────────────────────────────────────────
  async refresh(rawToken: string) {
    const hash = this.hashToken(rawToken);
    const { rows: [row] } = await this.db.query<{
      user_id: string; expires_at: string;
    }>(
      "SELECT user_id, expires_at FROM refresh_tokens WHERE token_hash = $1",
      [hash]
    );

    if (!row || new Date(row.expires_at) < new Date()) {
      throw new UnauthorizedException("Refresh token invalid or expired");
    }

    // Rotate: delete old token, issue new pair
    await this.db.query("DELETE FROM refresh_tokens WHERE token_hash = $1", [hash]);

    const { rows: [user] } = await this.db.query<{ email: string; role: string }>(
      "SELECT email, role FROM users WHERE id = $1",
      [row.user_id]
    );

    return this.issueTokens(row.user_id, user.email, user.role);
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  async logout(userId: string, refreshToken: string) {
    const hash = this.hashToken(refreshToken);
    await this.db.query(
      "DELETE FROM refresh_tokens WHERE user_id = $1 AND token_hash = $2",
      [userId, hash]
    );
    // Blacklist access token in Redis until natural expiry
    await this.redis.setex(`bl:${userId}`, 60 * 15, "1");
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private async issueTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };
    const accessToken  = this.jwt.sign(payload, { expiresIn: this.jwtCfg.accessExpiresIn });
    const rawRefresh   = randomBytes(64).toString("hex");
    const refreshHash  = this.hashToken(rawRefresh);
    const expiresAt    = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.db.query(
      "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
      [userId, refreshHash, expiresAt]
    );

    return { accessToken, refreshToken: rawRefresh, expiresIn: 900 };
  }

  private hashToken(raw: string): string {
    const { createHash } = require("node:crypto");
    return createHash("sha256").update(raw).digest("hex");
  }
}
