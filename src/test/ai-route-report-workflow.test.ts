import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The AI route report reads production function logs into a public job
// summary. It is safe only while it publishes counts of two exact line shapes
// and nothing else — these pin that, and pin the shapes to the lines
// aiProvider.ts actually prints.

const wf = readFileSync(".github/workflows/ai-route-report.yml", "utf8");
const provider = readFileSync("supabase/functions/_shared/aiProvider.ts", "utf8");
const pattern = (name: string) => new RegExp(wf.match(new RegExp(`${name}='([^']+)'`))![1]);

describe("ai-route-report", () => {
  it("is manual, read-only and bounded", () => {
    expect(wf).toContain("workflow_dispatch:");
    expect(wf).not.toMatch(/^\s*(schedule|push|pull_request):/m);
    expect(wf).toContain("permissions:\n  contents: read");
    expect(wf).toMatch(/sql=select event_message from function_logs where regexp_contains/);
    expect(wf).not.toMatch(/\b(insert|update|delete|drop|alter)\b/i);
    expect(wf).toContain('[[ "$HOURS" -gt 24 ]] && HOURS=24');
  });

  it("publishes only lines that match one of two anchored shapes", () => {
    const route = pattern("ROUTE");
    const fallback = pattern("FALLBACK");
    expect(route.source.startsWith("^") && route.source.endsWith("$")).toBe(true);
    expect(fallback.source.startsWith("^") && fallback.source.endsWith("$")).toBe(true);
    expect(route.test("[ai-route] chat/stream answered=openai/gpt-4.1 attempt=2 fallback=true ms=812")).toBe(true);
    expect(route.test("[ai-route] chat/stream answered=openai/gpt-4.1 attempt=2 fallback=true ms=812 and a user's words")).toBe(false);
    expect(fallback.test("[ai-provider] groq/openai/gpt-oss-20b unavailable; trying fallback")).toBe(true);
    expect(fallback.test("[ai-provider] sk-live-123 unavailable; trying fallback extra")).toBe(false);
    // Nothing prints a raw event_message: every jq program selects by pattern and emits counts.
    expect(wf).not.toMatch(/\.event_message\s*\|\s*(tee|@text)|echo[^\n]*event_message/);
  });

  it("matches every line shape aiProvider.ts prints", () => {
    const route = pattern("ROUTE");
    const fallback = pattern("FALLBACK");
    expect(provider).toContain("`[ai-route] ${kind}/${mode} answered=${target.provider}/${target.model} attempt=${attempt} fallback=${attempt > 1} ms=${ms}`");
    expect(route.test("[ai-route] vision/structured answered=gemini/gemini-flash-lite-latest attempt=1 fallback=false ms=90")).toBe(true);
    const phrases = [...provider.matchAll(/console\.warn\(`\[ai-provider\] \$\{target\.provider\}\/\$\{target\.model\} ([^`]+)`\)/g)].map((m) => m[1]);
    expect(phrases.length).toBeGreaterThanOrEqual(4);
    for (const phrase of phrases) {
      expect(fallback.test(`[ai-provider] groq/openai/gpt-oss-20b ${phrase}`), phrase).toBe(true);
    }
  });
});
