/**
 * Builds the exact program the server will run, and pins its hash.
 *   node scripts/build-ci-bundle.mjs          -> writes deploy/ci-pi-check/pi-check.mjs
 *                                               and EXPECTED_SHA256 in isp-pi-check-run
 *   node scripts/build-ci-bundle.mjs --check  -> fails if either is out of date (CI/test)
 * Output is deterministic (no minification, no timestamps, LF line endings).
 */
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "deploy/ci-pi-check/pi-check.mjs");
const run = join(root, "deploy/ci-pi-check/isp-pi-check-run");
const lf = (s) => s.replaceAll("\r\n", "\n");

const r = await build({
  entryPoints: [join(root, "scripts/pi-check-main.ts")],
  absWorkingDir: root,
  bundle: true, platform: "node", format: "esm", target: "node20", write: false,
  minify: false, legalComments: "none", charset: "utf8", logLevel: "error",
});
const bundle = lf(r.outputFiles[0].text);
const hash = createHash("sha256").update(bundle).digest("hex");
const runText = lf(readFileSync(run, "utf8"));
const next = runText.replace(/^EXPECTED_SHA256=.*$/m, `EXPECTED_SHA256=${hash}`);

if (process.argv.includes("--check")) {
  const stale = lf(readFileSync(out, "utf8")) !== bundle || runText !== next;
  if (stale) { console.error("deploy/ci-pi-check is out of date: run node scripts/build-ci-bundle.mjs"); process.exit(1); }
  console.log("up to date " + hash);
} else {
  writeFileSync(out, bundle);
  writeFileSync(run, next);
  console.log("wrote " + hash);
}
