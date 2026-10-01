import { z } from "zod";

const bool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? def : ["1", "true", "yes", "on"].includes(v.toLowerCase())));

const b64key = z
  .string()
  .min(1)
  .refine((v) => Buffer.from(v, "base64").length === 32, "must be base64 of exactly 32 bytes");

const schema = z.object({
  ISP_ENV: z.enum(["development", "staging", "production"]),
  ISP_HOST: z.string().default("127.0.0.1"),
  ISP_PORT: z.coerce.number().int().min(1).max(65535).default(8443),
  ISP_PUBLIC_ORIGIN: z.string().url(),
  ISP_TRUST_PROXY: bool(true),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: bool(false),
  ISP_ENCRYPTION_KEY: b64key,
  ISP_SESSION_PEPPER: b64key,

  PI_BASE_URL: z.string().url().optional(),
  PI_USERNAME: z.string().optional(),
  PI_PASSWORD: z.string().optional(),
  PI_TOTP_SECRET: z.string().optional(),
  PI_ACTIONS_FILE: z.string().optional(),

  WA_GATEWAY_HMAC_SECRET: z.string().min(32).optional(),
  WA_DIRECT_WEBHOOK: bool(false),
  WA_VERIFY_TOKEN: z.string().optional(),
  WA_APP_SECRET: z.string().optional(),
  WA_ACCESS_TOKEN: z.string().optional(),
  WA_PHONE_NUMBER_ID: z.string().optional(),
  WA_REQUIRE_UNLOCK: bool(true),

  ENABLE_RADIUS_WRITE: bool(false),
  ENABLE_WHATSAPP_WRITE: bool(false),
  ENABLE_CUSTOMER_SUSPENSION: bool(false),
  ENABLE_CUSTOMER_ACTIVATION: bool(false),
  ENABLE_CUSTOMER_TERMINATION: bool(false),

  REQUIRE_MFA: bool(true),
});

export interface Flags {
  radiusWrite: boolean;
  whatsappWrite: boolean;
  suspension: boolean;
  activation: boolean;
  termination: boolean;
}

export interface Config {
  env: "development" | "staging" | "production";
  host: string;
  port: number;
  publicOrigin: string;
  trustProxy: boolean;
  databaseUrl: string;
  databaseSsl: boolean;
  encryptionKey: Buffer;
  sessionPepper: string;
  pi: { baseUrl?: string; username?: string; password?: string; totpSecret?: string; actionsFile?: string };
  wa: {
    gatewaySecret?: string;
    directWebhook: boolean;
    verifyToken?: string;
    appSecret?: string;
    accessToken?: string;
    phoneNumberId?: string;
    requireUnlock: boolean;
  };
  flags: Flags;
  requireMfa: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const r = schema.safeParse(env);
  if (!r.success) {
    // Names only: a value could be a secret.
    const bad = r.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid configuration: ${bad}`);
  }
  const e = r.data;
  if (e.ISP_ENV === "production") {
    if (!e.ISP_PUBLIC_ORIGIN.startsWith("https://")) throw new Error("Invalid configuration: ISP_PUBLIC_ORIGIN must be https in production");
    if (!e.REQUIRE_MFA) throw new Error("Invalid configuration: REQUIRE_MFA cannot be disabled in production");
    if (e.WA_DIRECT_WEBHOOK && !e.WA_APP_SECRET) throw new Error("Invalid configuration: WA_APP_SECRET");
  }
  return {
    env: e.ISP_ENV,
    host: e.ISP_HOST,
    port: e.ISP_PORT,
    publicOrigin: e.ISP_PUBLIC_ORIGIN.replace(/\/$/, ""),
    trustProxy: e.ISP_TRUST_PROXY,
    databaseUrl: e.DATABASE_URL,
    databaseSsl: e.DATABASE_SSL,
    encryptionKey: Buffer.from(e.ISP_ENCRYPTION_KEY, "base64"),
    sessionPepper: e.ISP_SESSION_PEPPER,
    pi: {
      baseUrl: e.PI_BASE_URL?.replace(/\/$/, ""),
      username: e.PI_USERNAME,
      password: e.PI_PASSWORD,
      totpSecret: e.PI_TOTP_SECRET,
      actionsFile: e.PI_ACTIONS_FILE,
    },
    wa: {
      gatewaySecret: e.WA_GATEWAY_HMAC_SECRET,
      directWebhook: e.WA_DIRECT_WEBHOOK,
      verifyToken: e.WA_VERIFY_TOKEN,
      appSecret: e.WA_APP_SECRET,
      accessToken: e.WA_ACCESS_TOKEN,
      phoneNumberId: e.WA_PHONE_NUMBER_ID,
      requireUnlock: e.WA_REQUIRE_UNLOCK,
    },
    flags: {
      radiusWrite: e.ENABLE_RADIUS_WRITE,
      whatsappWrite: e.ENABLE_WHATSAPP_WRITE,
      suspension: e.ENABLE_CUSTOMER_SUSPENSION,
      activation: e.ENABLE_CUSTOMER_ACTIVATION,
      termination: e.ENABLE_CUSTOMER_TERMINATION,
    },
    requireMfa: e.REQUIRE_MFA,
  };
}
