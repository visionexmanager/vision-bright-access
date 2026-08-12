import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Deleting a function's directory does not remove it from Supabase. Ten
// career-ai-* functions stayed live with no source, filled the 100-function
// cap, and blocked their own replacement from deploying. These pin the
// retirement path that fixes that, and — more importantly — pin the limits on
// it, because a reconciler that deletes whatever it does not recognise would be
// a far worse problem than the drift it fixes.

const root = resolve(import.meta.dirname, "../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

const manifest = JSON.parse(read("supabase/retirement-manifest.json")) as {
  manifest_version: number;
  never_retire: string[];
  retire: {
    slug: string;
    replaced_by: string;
    superseded_by_pr: number;
    approved_by: string;
    approved_on: string;
    reason: string;
  }[];
};

const script = read("scripts/retire-supabase-functions.sh");
const workflow = read(".github/workflows/retire-supabase-functions.yml");
const deployScript = read("scripts/deploy-changed-supabase-functions.sh");

const repoFunctions = readdirSync(resolve(root, "supabase/functions"), { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== "_shared")
  .map((e) => e.name);

/** The script's own protected list, which is the last word over the manifest. */
const hardProtected = (() => {
  const block = script.slice(
    script.indexOf("readonly HARD_PROTECTED=("),
    script.indexOf(")", script.indexOf("readonly HARD_PROTECTED=(")),
  );
  return block
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
})();

describe("the manifest is the only thing that authorizes a deletion", () => {
  it("never lists a function the repository still ships", () => {
    // The dangerous inversion. A slug that is both shipped and marked for
    // retirement means one of the two is wrong, and the script fails rather
    // than picking one.
    for (const entry of manifest.retire) {
      expect(repoFunctions, `${entry.slug} is still in supabase/functions`)
        .not.toContain(entry.slug);
      expect(existsSync(resolve(root, "supabase/functions", entry.slug))).toBe(false);
    }
  });

  it("never lists a protected function", () => {
    for (const entry of manifest.retire) {
      expect(hardProtected, `${entry.slug} is protected`).not.toContain(entry.slug);
      expect(manifest.never_retire).not.toContain(entry.slug);
    }
  });

  it("records who approved each retirement and what replaced it", () => {
    // A slug alone is not an authorization. Every entry has to carry the
    // evidence that made it safe, because the run log is the only place anyone
    // will look afterwards.
    for (const entry of manifest.retire) {
      expect(entry.slug).toMatch(/^[a-z0-9-]+$/);
      expect(entry.replaced_by.length).toBeGreaterThan(0);
      expect(entry.approved_by.length).toBeGreaterThan(0);
      expect(entry.approved_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.reason.length).toBeGreaterThan(20);
      expect(Number.isInteger(entry.superseded_by_pr)).toBe(true);
    }
  });

  it("names no slug twice", () => {
    const slugs = manifest.retire.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("protection cannot be edited away in the file being reviewed", () => {
  it("duplicates every protected name into the script itself", () => {
    // never_retire is data in the same pull request as a retirement, so the
    // script keeps its own copy. `_shared` is not a function and only appears
    // in the manifest list.
    for (const slug of manifest.never_retire.filter((s) => s !== "_shared")) {
      expect(hardProtected, `${slug} is protected in the manifest but not in the script`)
        .toContain(slug);
    }
  });

  it("protects every webhook, which fails silently rather than loudly", () => {
    const webhooks = repoFunctions.filter((name) => name.endsWith("-webhook"));
    expect(webhooks.length).toBeGreaterThan(0);
    for (const hook of webhooks) {
      expect(hardProtected, `${hook} is not protected`).toContain(hook);
    }
  });

  it("protects the functions this retirement exists to unblock", () => {
    for (const slug of ["career-ai", "owner-control", "ai-search", "contact-form"]) {
      expect(hardProtected).toContain(slug);
    }
  });

  it("re-checks the guards immediately before the destructive call", () => {
    const applyBlock = script.slice(script.indexOf("# ── Apply"));
    expect(applyBlock).toContain("if is_protected \"$slug\" || [[ -d \"$FUNCTIONS_DIR/$slug\" ]]");
    expect(applyBlock).toContain("-X DELETE");
  });
});

describe("absence from the repository never authorizes a deletion", () => {
  it("collects unrecognised deployed functions into a report, not a delete list", () => {
    // The whole point. `drift` is everything deployed that the repository and
    // the manifest both fail to explain — which is the exact shape of the
    // career-ai-* orphans, and also of anything deployed by hand on purpose.
    expect(script).toContain("drift=()");
    expect(script).toContain("never deleted");

    const deleteLoop = script.slice(
      script.indexOf('for slug in "${to_delete[@]}"; do', script.indexOf("# ── Apply")),
    );
    expect(deleteLoop).not.toContain("drift");
  });

  it("builds the delete list only from the manifest", () => {
    const reconcile = script.slice(
      script.indexOf("# ── Reconcile"),
      script.indexOf("# ── Report"),
    );
    // to_delete is appended in exactly one place: the loop over manifest slugs.
    expect(reconcile.match(/to_delete\+=/g)).toHaveLength(1);
    const buildLoop = reconcile.slice(reconcile.indexOf('for slug in "${manifest_slugs'));
    expect(buildLoop).toContain("to_delete+=(\"$slug\")");
  });

  it("refuses to act on an empty function list", () => {
    // A malformed or partial API response that parsed to zero functions would
    // otherwise read as "everything is already retired" and pass silently.
    expect(script).toContain("refusing to act on that");
  });
});

describe("apply is unreachable by accident", () => {
  it("gives the workflow no automatic trigger", () => {
    // No push, schedule, or workflow_run. A merge can never delete anything.
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/^\s{2}(push|schedule|workflow_run|pull_request):/m);
  });

  it("defaults to plan", () => {
    expect(workflow).toMatch(/type: choice\s*\n\s*default: plan/);
  });

  it("requires the exact phrase in both the workflow and the script", () => {
    expect(workflow).toContain('!= "RETIRE-PRODUCTION-FUNCTIONS"');
    expect(script).toContain('readonly CONFIRM_PHRASE="RETIRE-PRODUCTION-FUNCTIONS"');
    expect(script).toContain('[[ "${CONFIRM:-}" == "$CONFIRM_PHRASE" ]]');
  });

  it("checks the phrase before contacting Supabase", () => {
    expect(workflow.indexOf("Verify the confirmation phrase"))
      .toBeLessThan(workflow.indexOf("SUPABASE_ACCESS_TOKEN"));
  });

  it("logs every retirement to the run summary", () => {
    expect(script).toContain("GITHUB_STEP_SUMMARY");
    expect(script).toContain("### Deletion log");
  });
});

describe("deploy and retire stay separate", () => {
  it("keeps deletion out of the deploy path", () => {
    // A failed build must leave production untouched, not reconcile it away.
    expect(deployScript).not.toContain("functions delete");
    expect(deployScript).not.toContain("-X DELETE");
    expect(deployScript).not.toContain("retirement-manifest");
  });

  it("does not redeploy from the retirement workflow", () => {
    expect(workflow).not.toContain("deploy-changed-supabase-functions.sh");
  });
});

describe("the career-ai retirement this manifest was created for", () => {
  const EXPECTED = [
    "career-ai-analyze", "career-ai-chat", "career-ai-coach",
    "career-ai-health-score", "career-ai-interview", "career-ai-match",
    "career-ai-resume", "career-ai-roadmap", "career-ai-salary",
    "career-ai-visa",
  ];

  it("lists exactly the ten consolidated by the router", () => {
    expect(manifest.retire.map((e) => e.slug).sort()).toEqual([...EXPECTED].sort());
  });

  it("points every one at the action the router serves it as", () => {
    const router = read("supabase/functions/career-ai/index.ts");
    for (const entry of manifest.retire) {
      const action = entry.replaced_by.match(/"action":\s*"([a-z_]+)"/)?.[1];
      expect(action, `${entry.slug} names no action`).toBeDefined();
      expect(router, `router does not serve ${action}`).toMatch(new RegExp(`\\b${action}\\b`));
    }
  });
});
