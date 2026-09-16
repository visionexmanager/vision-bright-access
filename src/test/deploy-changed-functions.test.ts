// Which Edge Functions an automatic deploy picks.
//
// On 2026-09-16 a rebase merge pushed thirteen commits. The deploy compared the
// last of them with its parent, found no function changes, and skipped ai-chat
// and newsletter-preferences, whose changes were in earlier commits — while the
// run was green. These tests run the real script over a throwaway repository
// with a stand-in `supabase` command that only records what it was asked to do.

import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const SCRIPT = resolve(__dirname, "../../scripts/deploy-changed-supabase-functions.sh");

const BASH = [
  "bash",
  "C:\\Program Files\\Git\\bin\\bash.exe",
  "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
].find((candidate) => {
  if (candidate.includes("\\") && !existsSync(candidate)) return false;
  return spawnSync(candidate, ["-c", "echo ok"], { encoding: "utf8" }).stdout?.trim() === "ok";
});

let repo = "";
let bin = "";
const shas: string[] = [];

function git(...args: string[]) {
  const result = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  return result.stdout.trim();
}

function commit(file: string, message: string) {
  const path = join(repo, file);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `${message}\n`);
  git("add", "-A");
  git("-c", "user.email=test@example.test", "-c", "user.name=test", "commit", "-qm", message);
  shas.push(git("rev-parse", "HEAD"));
}

function deploy(env: Record<string, string>) {
  const log = join(repo, `deployed-${Math.random().toString(36).slice(2)}.log`);
  const result = spawnSync(BASH!, [SCRIPT.replace(/\\/g, "/")], {
    cwd: repo,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}${delimiter}${process.env.PATH}`,
      SUPABASE_PROJECT_REF: "test",
      DEPLOYED_LOG: log,
      GITHUB_EVENT_BEFORE: "",
      DEPLOY_BASE_SHA: "",
      DEPLOY_FUNCTIONS: "",
      ...env,
    },
  });
  const deployed = existsSync(log) ? readFileSync(log, "utf8").trim().split(/\r?\n/).filter(Boolean).sort() : [];
  return { status: result.status, deployed, output: `${result.stdout}${result.stderr}` };
}

beforeAll(() => {
  if (!BASH) return;
  repo = mkdtempSync(join(tmpdir(), "vx-deploy-"));
  bin = join(repo, ".bin");
  mkdirSync(bin);
  const fake = join(bin, "supabase");
  writeFileSync(fake, '#!/usr/bin/env bash\n[ "$1 $2" = "functions deploy" ] && echo "$3" >> "$DEPLOYED_LOG"\nexit 0\n');
  chmodSync(fake, 0o755);
  git("init", "-q");
  commit("supabase/functions/ai-chat/index.ts", "base");
  commit("supabase/functions/newsletter-preferences/index.ts", "base 2");
  commit("supabase/functions/other/index.ts", "base 3"); // shas[2]: last deployed
  commit("supabase/functions/ai-chat/limits.ts", "change ai-chat");
  commit("supabase/functions/newsletter-preferences/index.ts", "change newsletter");
  commit("src/page.tsx", "frontend only"); // shas[5]: what was pushed
});

describe.skipIf(!BASH)("deploying changed Edge Functions", () => {
  it("deploys every function changed since the last deploy, not just in the last commit", () => {
    const run = deploy({ GITHUB_EVENT_NAME: "workflow_run", DEPLOY_SHA: shas[5], DEPLOY_BASE_SHA: shas[2] });
    expect(run.status, run.output).toBe(0);
    expect(run.deployed).toEqual(["ai-chat", "newsletter-preferences"]);
  });

  it("reproduces the miss when no base is known, which is why deploy.yml supplies one", () => {
    const run = deploy({ GITHUB_EVENT_NAME: "workflow_run", DEPLOY_SHA: shas[5] });
    expect(run.status, run.output).toBe(0);
    expect(run.deployed).toEqual([]);
  });

  it("prefers a push event's own base", () => {
    const run = deploy({ GITHUB_EVENT_NAME: "push", DEPLOY_SHA: shas[5], GITHUB_EVENT_BEFORE: shas[3], DEPLOY_BASE_SHA: shas[0] });
    expect(run.deployed).toEqual(["newsletter-preferences"]);
  });

  it("deploys only the functions a manual run names", () => {
    const run = deploy({ GITHUB_EVENT_NAME: "workflow_dispatch", DEPLOY_SHA: shas[5], DEPLOY_FUNCTIONS: " newsletter-preferences  ai-chat " });
    expect(run.status, run.output).toBe(0);
    expect(run.deployed).toEqual(["ai-chat", "newsletter-preferences"]);
  });

  it("deploys nothing when a manual run names something that is not a function", () => {
    for (const bad of ["ai-chat does-not-exist", "../src", "_shared", "*"]) {
      const run = deploy({ GITHUB_EVENT_NAME: "workflow_dispatch", DEPLOY_SHA: shas[5], DEPLOY_FUNCTIONS: bad });
      expect(run.status, `${bad}: ${run.output}`).toBe(1);
      expect(run.deployed, bad).toEqual([]);
    }
  });

  it("still deploys every function from a manual run that names none", () => {
    const run = deploy({ GITHUB_EVENT_NAME: "workflow_dispatch", DEPLOY_SHA: shas[5] });
    expect(run.deployed).toEqual(["ai-chat", "newsletter-preferences", "other"]);
  });
});

describe("deploy.yml supplies the base", () => {
  const workflow = readFileSync(resolve(__dirname, "../../.github/workflows/deploy.yml"), "utf8").replace(/\r\n/g, "\n");
  const job = workflow.slice(workflow.indexOf("deploy-edge-functions:"), workflow.indexOf("run-migrations:"));

  it("looks up the last successful deploy and hands it to the script", () => {
    expect(job).toMatch(/gh run list --repo "\$REPO" --workflow deploy\.yml --branch main --status success/);
    expect(job).toMatch(/DEPLOY_BASE_SHA: +\$\{\{ steps\.base\.outputs\.sha \}\}/);
    expect(job).toMatch(/permissions:\n {6}actions: read[^\n]*\n {6}contents: read\n/);
  });

  // The first version of this step read correctly as YAML and failed on every
  // run: a line continuation had become a literal "\n", `gh` received two
  // arguments, stderr was discarded, and the step fell back in 0.2 seconds.
  // So the step is executed here, with stand-ins for gh and git.
  it.skipIf(!BASH)("actually finds the last deployed commit when run", () => {
    // The step's literal block, dedented: every line after "run: |" that is
    // indented further than "run:" itself.
    const lines = job.slice(job.indexOf("id: base")).split("\n");
    const start = lines.findIndex((line) => /^\s*run: \|$/.test(line));
    const indent = lines[start].indexOf("run:");
    const body: string[] = [];
    for (const line of lines.slice(start + 1)) {
      if (line.trim() && line.search(/\S/) <= indent) break;
      body.push(line.slice(indent + 2));
    }
    const step = { run: body.join("\n") };
    expect(step.run).toContain("gh run list");

    const dir = mkdtempSync(join(tmpdir(), "vx-base-"));
    const stubs = join(dir, "bin");
    mkdirSync(stubs);
    const last = "a".repeat(40);
    // Like the real `gh run list`: every flag takes a value, and a stray
    // positional argument is an error — which is exactly what broke the step.
    writeFileSync(
      join(stubs, "gh"),
      [
        "#!/usr/bin/env bash",
        '[ "$1 $2" = "run list" ] || exit 1',
        "shift 2",
        "while [ $# -gt 0 ]; do",
        '  case "$1" in',
        "    --repo|--workflow|--branch|--status|--limit|--json|--jq) shift 2 ;;",
        '    *) echo "accepts 0 arg(s), received: $1" >&2; exit 1 ;;',
        "  esac",
        "done",
        `echo "${last}"`,
        "",
      ].join("\n"),
    );
    writeFileSync(join(stubs, "git"), "#!/usr/bin/env bash\nexit 0\n");
    chmodSync(join(stubs, "gh"), 0o755);
    chmodSync(join(stubs, "git"), 0o755);
    const script = join(dir, "step.sh");
    writeFileSync(script, step.run);
    const output = join(dir, "output");
    writeFileSync(output, "");

    const result = spawnSync(BASH!, [script.replace(/\\/g, "/")], {
      encoding: "utf8",
      env: { ...process.env, PATH: `${stubs}${delimiter}${process.env.PATH}`, GH_TOKEN: "x", REPO: "o/r", RUN_ID: "1", GITHUB_OUTPUT: output },
    });
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(output, "utf8").trim()).toBe(`sha=${last}`);
  });

  it("passes manual function names through the environment, never into the shell", () => {
    expect(job).toMatch(/DEPLOY_FUNCTIONS: +\$\{\{ inputs\.functions \}\}/);
    expect(job).not.toMatch(/run:[^\n]*\$\{\{ inputs\.functions/);
  });
});
