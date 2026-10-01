/**
 * LOCAL DEVELOPMENT ONLY. In-memory PostgreSQL (PGlite) + fictional customers +
 * a recording WhatsApp sender. Touches no real system and refuses to run unless
 * ISP_ENV=development. The admin password comes from DEV_ADMIN_PASSWORD.
 */
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createContainer } from "../src/container.js";
import { createPgliteDb, runMigrations } from "../src/db.js";
import { MemoryProviders } from "../src/providers/memory.js";
import { RecordingSender } from "../src/whatsapp/sender.js";

const password = process.env.DEV_ADMIN_PASSWORD;
if (process.env.ISP_ENV !== "development" || !password) throw new Error("dev-server needs ISP_ENV=development and DEV_ADMIN_PASSWORD");
const cfg = loadConfig();
const db = await createPgliteDb();
await runMigrations(db, new URL("../migrations", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const c = await createContainer(cfg, { db, providers: MemoryProviders.sample(), sender: new RecordingSender() });
await c.auth.createAdmin({ username: "devadmin", password, role: "SUPER_ADMIN" });
const app = await buildApp(c, { webDir: new URL("../web/dist", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1") });
await app.listen({ host: cfg.host, port: cfg.port });
console.log(`dev server on ${cfg.publicOrigin} (fictional data, in-memory DB)`);
