import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createContainer } from "./container.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const cfg = (() => {
  try {
    return loadConfig();
  } catch (e) {
    console.error(String(e instanceof Error ? e.message : e)); // names only, never values
    process.exit(78);
  }
})();
const c = await createContainer(cfg);
const app = await buildApp(c, { webDir: process.env.ISP_WEB_DIR ?? join(here, "..", "web", "dist") });

const shutdown = async (sig: string) => {
  c.log.info("shutting down", { sig });
  // Stop accepting, let in-flight requests finish, then close the pool.
  await app.close();
  await c.db.close();
  process.exit(0);
};
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

await app.listen({ host: cfg.host, port: cfg.port });
c.log.info("isp-api listening", { env: cfg.env });
