// Putting one location block into the live nginx site file.
//
// The deploy step used to insert the block and then, on every later run, see
// `internal/media` in the file and say "already present — nothing to do". That
// is idempotent by *absence*, not by content: a change to the block was copied
// to the server, skipped, and reported as a success. It happened for real on
// 2026-09-05 — a larger `client_max_body_size` and a longer
// `proxy_read_timeout` were merged, deployed, and never reached nginx, and the
// run was green.
//
// This edits the file that serves visionex.app, so it is worth testing on
// something other than the server. `awk` is on the CI runner and on this
// checkout, so these run the real transformation over real fixtures rather than
// asserting a reimplementation of it.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = "services/media-processor/nginx/site-block.awk";
const LIVE_BLOCK = "services/media-processor/nginx/visionex-media.location.conf";
const FIXTURES = "services/media-processor/nginx/fixtures";

/**
 * Where awk is, which is not always on `PATH`.
 *
 * On Linux — the CI runner and the server — it is `awk` and nothing more needs
 * saying. On Windows it ships with Git and is on `PATH` under Git Bash but not
 * under PowerShell, so the same suite passed from one shell and failed with a
 * bare `ENOENT` from the other. Resolved once, from a list, and it throws with
 * a sentence rather than skipping: these tests guard a script that edits the
 * nginx config of the live site, and a silent skip is the wrong way to lose
 * them.
 */
const AWK = (() => {
  const candidates = [
    "awk",
    "gawk",
    "C:/Program Files/Git/usr/bin/awk.exe",
    "C:/Program Files (x86)/Git/usr/bin/awk.exe",
  ];
  for (const candidate of candidates) {
    try {
      if (execFileSync(candidate, ["BEGIN{print 1}"], { encoding: "utf8" }).trim() === "1") {
        return candidate;
      }
    } catch {
      // Try the next one.
    }
  }
  throw new Error(
    "No awk found. It is standard on Linux and ships with Git on Windows " +
    "(under Git Bash). These tests run the real deploy script, so there is " +
    "nothing to assert without it.",
  );
})();

const dir = mkdtempSync(join(tmpdir(), "nginx-block-"));
let seq = 0;

/** Run the real script over a block and a site file, and return the result. */
function apply(block: string, site: string): string {
  const blockPath = join(dir, `block-${++seq}.conf`);
  const sitePath = join(dir, `site-${seq}.conf`);
  writeFileSync(blockPath, block);
  writeFileSync(sitePath, site);
  return execFileSync(AWK, ["-f", SCRIPT, blockPath, sitePath], { encoding: "utf8" });
}

/** Braces outside comments. The block being managed is mostly comments. */
function balanced(config: string): boolean {
  let depth = 0;
  for (const line of config.split(/\r?\n/)) {
    const code = line.replace(/#.*$/, "");
    depth += (code.match(/\{/g) ?? []).length - (code.match(/\}/g) ?? []).length;
    if (depth < 0) return false;
  }
  return depth === 0;
}

const blocks = (config: string) =>
  (config.match(/location\s+\/internal\/media\//g) ?? []).length;

const fixture = (name: string) => readFileSync(join(FIXTURES, name), "utf8");

const NEW_BLOCK = [
  "# A comment with a brace { in it, so the counter has to ignore comments.",
  "location /internal/media/ {",
  "    proxy_pass http://127.0.0.1:8081/;",
  "    client_max_body_size 16m;",
  "    proxy_read_timeout 120s;",
  "}",
  "",
].join("\n");

describe("installing the location block", () => {
  it("replaces the copy already on the server, rather than skipping it", () => {
    // The fixture is what production actually had: an unmarked block with
    // 12m/40s in it, written before the markers existed.
    const before = fixture("site-legacy.conf");
    expect(before).toContain("client_max_body_size 12m");

    const after = apply(NEW_BLOCK, before);

    expect(blocks(after)).toBe(1);
    expect(after).toContain("client_max_body_size 16m");
    expect(after).not.toContain("client_max_body_size 12m");
    expect(after).not.toContain("proxy_read_timeout 40s");
    expect(balanced(after)).toBe(true);
  });

  it("leaves no orphaned commentary from the block it replaced", () => {
    const after = apply(NEW_BLOCK, fixture("site-legacy.conf"));
    // The legacy block carried its own comments directly above it. Left behind,
    // they would describe a block that is no longer there — and accumulate one
    // copy per deploy.
    expect(after).not.toContain("The one route that reaches");
  });

  it("fences what it wrote, so the next run knows exactly what to replace", () => {
    const after = apply(NEW_BLOCK, fixture("site-legacy.conf"));
    expect(after).toContain(">>> visionex-media");
    expect(after).toContain("<<< visionex-media");
  });

  it("changes nothing when the block has not changed", () => {
    const once = apply(NEW_BLOCK, fixture("site-legacy.conf"));
    expect(apply(NEW_BLOCK, once)).toBe(once);
  });

  it("picks up a change on the run after it", () => {
    const once = apply(NEW_BLOCK, fixture("site-legacy.conf"));
    const twice = apply(NEW_BLOCK.replace("16m", "24m"), once);
    expect(twice).toContain("client_max_body_size 24m");
    expect(twice).not.toContain("client_max_body_size 16m");
    expect(blocks(twice)).toBe(1);
  });

  it("inserts into a site that has no block, at the end of the 443 server", () => {
    // The bug this test was written for: counting braces from zero at the
    // `listen` line made the very next line look like the end of the block, and
    // the whole thing landed directly under `listen 443` — where nginx accepts
    // it and serves it from the wrong scope. Depth starts at 1 because the
    // server's own brace is already open.
    const after = apply(NEW_BLOCK, fixture("site-fresh.conf"));
    expect(blocks(after)).toBe(1);
    expect(balanced(after)).toBe(true);

    const lines = after.split(/\r?\n/);
    const inserted = lines.findIndex((l) => l.includes("location /internal/media/"));
    const listen = lines.findIndex((l) => /listen\s+443/.test(l));
    const rootLocation = lines.findIndex((l) => l.trim() === "location / {");
    expect(inserted).toBeGreaterThan(listen + 1);
    // After everything the server block already had, not wedged among it.
    expect(inserted).toBeGreaterThan(rootLocation);
  });

  it("installs the block this repository actually deploys", () => {
    // The fixtures above are small on purpose. This is the real file, with its
    // real commentary and its real braces, against the real site shape.
    expect(existsSync(LIVE_BLOCK)).toBe(true);
    const after = apply(readFileSync(LIVE_BLOCK, "utf8"), fixture("site-legacy.conf"));

    expect(blocks(after)).toBe(1);
    expect(balanced(after)).toBe(true);
    expect(after).toContain("proxy_pass http://127.0.0.1:8081/;");
    // And it is idempotent with the real block too, which is the property the
    // server depends on every time this is run.
    expect(apply(readFileSync(LIVE_BLOCK, "utf8"), after)).toBe(after);
  });

  it("refuses a site it cannot place the block in", () => {
    // Better to fail the step than to guess. The deploy has a backup and a
    // rollback, and neither helps if this writes a plausible wrong answer.
    expect(() => apply(NEW_BLOCK, "server {\n    listen 8080;\n}\n")).toThrow();
  });
});

describe("the block that will be installed", () => {
  it("admits the largest ceiling behind the prefix", () => {
    // Asserted here as well as in `whatsapp-office.test.ts` because this is the
    // file that reaches nginx, and the two ceilings must not drift apart.
    const block = readFileSync(LIVE_BLOCK, "utf8");
    expect(block).toMatch(/client_max_body_size\s+16m;/);
    expect(block).toMatch(/proxy_read_timeout\s+120s;/);
  });
});
