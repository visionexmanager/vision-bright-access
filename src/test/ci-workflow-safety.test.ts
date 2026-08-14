import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const read = (name: string) => readFileSync(resolve(root, ".github/workflows", name), "utf8");

const ci = read("ci.yml");
const ciCd = read("ci-cd.yml");
const deploy = read("deploy.yml");
const releaseReconciler = read("reconcile-release.yml");
const edgeDeploy = readFileSync(resolve(root, "scripts/deploy-changed-supabase-functions.sh"), "utf8");
const windowsSync = readFileSync(resolve(root, "scripts/sync-visionex.ps1"), "utf8");
const windowsSyncInstaller = readFileSync(resolve(root, "scripts/install-visionex-sync-task.ps1"), "utf8");

/**
 * The six contexts branch protection requires on `main`. Every one is reported
 * by a job in ci.yml or ci-cd.yml; a name changed on either side leaves pull
 * requests stuck on "Expected — Waiting for status to be reported" with no
 * failing check to point at.
 */
const REQUIRED_CHECKS: Record<string, string> = {
  "Type check": "ci",
  "ESLint": "ci",
  "Unit tests (Vitest)": "ci",
  "Lint & Type Check": "ci-cd",
  "Security Scan": "ci-cd",
  "Tests": "ci-cd",
};

describe("required status checks", () => {
  it("declares a job for every context branch protection requires", () => {
    for (const [check, workflow] of Object.entries(REQUIRED_CHECKS)) {
      expect(workflow === "ci" ? ci : ciCd).toContain(`name: ${check}`);
    }
  });

  it("runs the check workflows on pull requests into main", () => {
    for (const workflow of [ci, ciCd]) {
      expect(workflow).toMatch(/pull_request:\s*\n\s*branches:\s*\[main\]/);
    }
  });

  it("filters no paths, so every pull request reports every required check", () => {
    // A `paths:` filter on a workflow that reports a required check is a trap:
    // a pull request touching nothing in the filter creates no run, the check
    // is never reported, and branch protection waits forever with nothing to
    // re-run. Path filters belong on workflows whose checks are not required.
    for (const workflow of [ci, ciCd]) {
      expect(workflow).not.toMatch(/^\s*paths(-ignore)?:/m);
    }
  });

  it("keeps a manual trigger, so a dropped webhook is recoverable", () => {
    // Required checks only ever report from a run created by a webhook. When
    // GitHub throttles webhook delivery — as during the 2026-08-06 Actions
    // incident, at ~15% processed — no run exists and there is nothing to
    // re-run. workflow_dispatch is the only way back without weakening the
    // protection rules.
    for (const workflow of [ci, ciCd]) {
      expect(workflow).toContain("workflow_dispatch:");
    }
  });
});

describe("missing automation events recover without weakening release gates", () => {
  it("polls main and can dispatch the required workflows", () => {
    expect(releaseReconciler).toContain('cron: "*/10 * * * *"');
    expect(releaseReconciler).toContain("actions: write");
    expect(releaseReconciler).toContain("gh workflow run \"$workflow\"");
    expect(releaseReconciler).toContain("gh workflow run deploy.yml");
  });

  it("waits for both check workflows before recovering deployment", () => {
    expect(releaseReconciler).toContain("recover_check ci.yml");
    expect(releaseReconciler).toContain("recover_check ci-cd.yml");
    expect(releaseReconciler).toContain('if [[ "$checks_ready" != true ]]');
  });

  it("does not endlessly retry failed checks or deployments", () => {
    expect(releaseReconciler).toContain("refusing to hide it with endless retries");
    expect(releaseReconciler).toContain("manual diagnosis is required");
  });
});

describe("Windows checkout synchronization preserves local work", () => {
  it("refuses to update a dirty worktree or unpublished local main", () => {
    expect(windowsSync).toContain("status --porcelain");
    expect(windowsSync).toContain("local changes are present and were preserved");
    expect(windowsSync).toContain("origin/main..HEAD");
    expect(windowsSync).toContain("unpublished commit(s)");
  });

  it("only updates main with a fast-forward", () => {
    expect(windowsSync).toContain('$branch -ne "main"');
    expect(windowsSync).toContain("merge --ff-only origin/main");
    expect(windowsSync).not.toMatch(/reset\s+--hard|clean\s+-[a-z]*f/i);
  });

  it("installs a single non-overlapping scheduled task", () => {
    expect(windowsSyncInstaller).toContain('"Visionex Git Sync"');
    expect(windowsSyncInstaller).toContain("-RepetitionInterval");
    expect(windowsSyncInstaller).toContain("-MultipleInstances IgnoreNew");
  });
});

describe("locale generation cannot loop on a finished batch", () => {
  const generateLocales = read("generate-locales.yml");

  it("treats a batch as finished when its dictionaries exist on main", () => {
    // Completion used to mean "the branch's copies are byte-identical to
    // main's". Once a batch merges, main moves on — any later key added to
    // those files by unrelated work makes the stale branch differ again, which
    // the identity test read as "not published yet". On a */15 cron that
    // re-opened a pull request from a branch behind main, which cannot merge,
    // forever. Existence on main is the honest signal.
    expect(generateLocales).toContain("locales_present_on_main()");
    expect(generateLocales).toContain('git cat-file -e "origin/main:${file}"');
    expect(generateLocales).toContain("report_matches_request && locales_present_on_main");
  });

  it("no longer decides completion by diffing the branch against main", () => {
    expect(generateLocales).not.toMatch(/git diff --quiet origin\/main HEAD/);
  });
});

describe("secret scanning", () => {
  it("scans the checked-out tree rather than a commit range", () => {
    // gitleaks-action resolves `<before>^..<after>` through `git log`. Rewriting
    // a branch orphans the old head, the range stops resolving, and Security
    // Scan — a required check — fails on a pull request whose code is fine.
    // A directory scan cannot be reached by unreachable history.
    expect(ciCd).toContain("gitleaks dir .");
    expect(ciCd).not.toContain("gitleaks/gitleaks-action");
  });

  it("keeps a leak fatal to the job", () => {
    expect(ciCd).toContain("--exit-code 1");
  });
});

describe("destructive jobs stay out of reach of a manual check run", () => {
  it("requires the rollback job to be asked for by name", () => {
    // `helm rollback` against production, no `needs:`, guarded only by the
    // event name. Adding workflow_dispatch without this input would fire a
    // production rollback on every manual run of the required checks.
    expect(ciCd).toContain("if: github.event_name == 'workflow_dispatch' && inputs.action == 'rollback'");
  });

  it("defaults the dispatch input to running checks only", () => {
    expect(ciCd).toMatch(/default:\s*checks/);
    expect(ciCd).toMatch(/options:\s*\n\s*-\s*checks\s*\n\s*-\s*rollback/);
  });

  it("keeps image publishing gated on a protected ref", () => {
    expect(ci).toContain("if: github.ref == 'refs/heads/main'");
    expect(ciCd).toContain("github.ref == 'refs/heads/main' || github.ref == 'refs/heads/staging'");
  });
});

describe("Supabase Edge Function deployment scope", () => {
  it("passes the exact CI-tested commit to the deploy script", () => {
    expect(deploy).toContain("DEPLOY_SHA:");
    expect(deploy).toContain("github.event.workflow_run.head_sha || github.sha");
    expect(deploy).not.toMatch(/GITHUB_EVENT_BEFORE:\s+["']{2}/);
  });

  it("uses the tested commit parent when workflow_run has no before SHA", () => {
    expect(edgeDeploy).toContain('before_sha="${target_sha}^"');
    expect(edgeDeploy).toContain('git diff --name-only "$before_sha" "$target_sha"');
  });

  it("fails closed instead of deploying every function when the base cannot be resolved", () => {
    expect(edgeDeploy).toContain("refusing to deploy every Edge Function");
    expect(edgeDeploy).not.toMatch(/\[\[ -z "\$before_sha" \]\][\s\S]{0,100}list_all_functions/);
  });
});
