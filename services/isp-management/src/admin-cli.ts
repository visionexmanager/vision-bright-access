/**
 * Bootstrap the first SUPER_ADMIN. The password is read from the
 * ISP_BOOTSTRAP_PASSWORD environment variable at the moment of the call and is
 * never written anywhere:  ISP_BOOTSTRAP_PASSWORD=... node dist/admin-cli.js <username>
 */
import { Auth } from "./auth.js";
import { loadConfig } from "./config.js";
import { createPgDb } from "./db.js";
import { RateLimiter } from "./ratelimit.js";
import { SecurityMonitor } from "./events.js";
import { createLogger } from "./logger.js";

const username = process.argv[2];
const password = process.env.ISP_BOOTSTRAP_PASSWORD;
if (!username || !password) {
  console.error("usage: ISP_BOOTSTRAP_PASSWORD=<password> node dist/admin-cli.js <username>");
  process.exit(2);
}
const cfg = loadConfig();
const db = await createPgDb(cfg.databaseUrl, cfg.databaseSsl);
const log = createLogger("isp-cli");
const monitor = new SecurityMonitor(db, log, { alert: async () => undefined });
const auth = new Auth({ db, pepper: cfg.sessionPepper, encKey: cfg.encryptionKey, requireMfa: cfg.requireMfa, limiter: new RateLimiter(), monitor });
const id = await auth.createAdmin({ username, password, role: "SUPER_ADMIN" });
console.log(`created SUPER_ADMIN ${username} (${id}). Sign in and enrol two-factor authentication.`);
await db.close();
