import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "../src/app.js";
import { loadConfig, type Config } from "../src/config.js";
import { createContainer, type Container } from "../src/container.js";
import { createPgliteDb, runMigrations } from "../src/db.js";
import { createLogger } from "../src/logger.js";
import { MemoryProviders } from "../src/providers/memory.js";
import { RecordingSender } from "../src/whatsapp/sender.js";
import { totpAt } from "../src/crypto.js";

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
export const ORIGIN = "https://isp-admin.test.invalid";
export const GATEWAY_SECRET = "g".repeat(40);

export const testEnv = (over: Record<string, string> = {}): NodeJS.ProcessEnv => ({
  ISP_ENV: "development",
  ISP_PUBLIC_ORIGIN: ORIGIN,
  DATABASE_URL: "postgres://unused",
  ISP_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  ISP_SESSION_PEPPER: Buffer.alloc(32, 9).toString("base64"),
  WA_GATEWAY_HMAC_SECRET: GATEWAY_SECRET,
  ENABLE_RADIUS_WRITE: "true",
  ENABLE_WHATSAPP_WRITE: "true",
  ENABLE_CUSTOMER_SUSPENSION: "true",
  ENABLE_CUSTOMER_ACTIVATION: "true",
  REQUIRE_MFA: "false",
  ...over,
});

export interface Harness {
  c: Container;
  cfg: Config;
  providers: MemoryProviders;
  sender: RecordingSender;
  logs: string[];
  clock: { t: number };
  app: Awaited<ReturnType<typeof buildApp>>;
}

export async function harness(env: Record<string, string> = {}): Promise<Harness> {
  const db = await createPgliteDb();
  await runMigrations(db, MIGRATIONS);
  const cfg = loadConfig(testEnv(env));
  const providers = MemoryProviders.sample();
  const sender = new RecordingSender();
  const logs: string[] = [];
  const clock = { t: Date.parse("2026-10-01T12:00:00Z") };
  const c = await createContainer(cfg, { db, providers, sender, log: createLogger("test", (l) => logs.push(l)), now: () => clock.t });
  const app = await buildApp(c);
  return { c, cfg, providers, sender, logs, clock, app };
}

export const STRONG = "Correct-Horse-9-Battery";

export async function makeAdmin(h: Harness, username: string, role: "SUPER_ADMIN" | "ADMIN" | "READ_ONLY_ADMIN" = "SUPER_ADMIN") {
  return h.c.auth.createAdmin({ username, password: STRONG, role });
}

/** Logs in over HTTP and returns the cookie + csrf for subsequent requests. */
export async function login(h: Harness, username: string, password = STRONG, otp?: string) {
  const res = await h.app.inject({ method: "POST", url: "/api/auth/login", headers: { origin: ORIGIN, "content-type": "application/json" }, payload: { username, password, otp } });
  const cookie = (res.headers["set-cookie"] as string | undefined)?.split(";")[0];
  const body = res.json() as { csrf?: string };
  return { res, cookie: cookie ?? "", csrf: body.csrf ?? "" };
}

export const authed = (a: { cookie: string; csrf: string }, write = false) => ({
  cookie: a.cookie,
  ...(write ? { "x-csrf-token": a.csrf, origin: ORIGIN, "content-type": "application/json" } : {}),
});

export const totpNow = (secret: string, t: number) => totpAt(secret, Math.floor(t / 30000));
