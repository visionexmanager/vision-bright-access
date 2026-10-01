/**
 * Entry point bundled and piped to `sudo node` on the server by the isp-pi-check
 * workflow. The env file path is fixed here on purpose: nothing the caller
 * supplies can point the check at another file. The only argument is --probe.
 */
import { ENV_FILE, runPiCheck } from "../src/pi-check.js";

// Anything unexpected must still print only the closed vocabulary.
const bail = () => {
  process.stdout.write("authentication: FAIL\n");
  process.exit(1);
};
process.on("uncaughtException", bail);
process.on("unhandledRejection", bail);

const code = await runPiCheck({ envFile: ENV_FILE, probe: process.argv.includes("--probe"), out: (l) => process.stdout.write(l + "\n") });
process.exit(code);
