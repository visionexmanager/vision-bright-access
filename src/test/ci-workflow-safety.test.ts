import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const read = (name: string) => readFileSync(resolve(root, ".github/workflows", name), "utf8");

const ci = read("ci.yml");
const ciCd = read("ci-cd.yml");

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
