import { loadConfig } from "./config.js";
import { createContainer } from "./container.js";
import { runWorkerForever } from "./worker.js";

const cfg = (() => {
  try {
    return loadConfig();
  } catch (e) {
    console.error(String(e instanceof Error ? e.message : e));
    process.exit(78);
  }
})();
const c = await createContainer(cfg);
const ac = new AbortController();
const stop = () => ac.abort();
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
c.log.info("isp-worker started");
await runWorkerForever(c, 30_000, ac.signal);
await c.db.close();
