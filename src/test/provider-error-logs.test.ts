// Provider error bodies are never logged — only their short codes.
//
// On 2026-09-26 a CI run of the OpenRouter adapter printed a 429 body into a
// public log, and the body carried the OpenRouter account's user_id. The same
// console.error(…, errText) pattern ran in every provider path. Edge Function
// logs are not public, but they are not the place for account identifiers or
// echoed prompts either.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { providerErrorSummary } from "../../supabase/functions/_shared/providerInput.ts";

describe("providerErrorSummary", () => {
  it("keeps OpenRouter's codes and drops its account id and sentences", () => {
    const body = JSON.stringify({
      error: {
        message: "Rate limit exceeded: free-models-per-day. Add 10 credits",
        code: 429,
        metadata: { limit_source: "openrouter_free_tier_daily", remedy_hint: "Wait for the daily reset", headers: { "X-RateLimit-Limit": "50" } },
      },
      user_id: "user_EXAMPLE0000000000000000",
    });
    const out = providerErrorSummary(body);
    expect(out).toBe("code=429 limit=openrouter_free_tier_daily");
    expect(out).not.toMatch(/user_|Rate limit|credits|reset/);
  });

  it("keeps OpenAI-style type and code, never the message", () => {
    const out = providerErrorSummary(JSON.stringify({ error: { message: "Your prompt said: my phone is 555", type: "invalid_request_error", code: "context_length_exceeded" } }));
    expect(out).toBe("code=context_length_exceeded type=invalid_request_error");
  });

  it("refuses anything that is not a short code, and never echoes a non-JSON body", () => {
    expect(providerErrorSummary("<html>Bad Gateway for user@example.com</html>")).toBe("non-json body");
    expect(providerErrorSummary(JSON.stringify({ error: { code: "has spaces and an email a@b.co" } }))).toBe("no code");
    expect(providerErrorSummary(JSON.stringify({ error: { code: "x".repeat(49) } }))).toBe("no code");
    expect(providerErrorSummary(JSON.stringify({ status: "RESOURCE_EXHAUSTED" }))).toBe("status=RESOURCE_EXHAUSTED");
  });
});

describe("no provider path logs a raw error body", () => {
  function tsFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? tsFiles(join(dir, e.name)) : e.name.endsWith(".ts") ? [join(dir, e.name)] : []);
  }

  it("every console line that logs a provider status passes the body through providerErrorSummary", () => {
    const offenders: string[] = [];
    for (const f of tsFiles("supabase/functions")) {
      const lines = readFileSync(f, "utf8").split(/\r?\n/);
      lines.forEach((line, i) => {
        if (/console\.(error|warn|log)\(.*(res|response)\.status,\s*(errText|errBody|errorText|await res\.text\(\))\s*\)/.test(line)) {
          offenders.push(`${f}:${i + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it("the shared chat layer and Gemini use it", () => {
    for (const f of ["aiProvider.ts", "geminiProvider.ts"]) {
      const src = readFileSync(`supabase/functions/_shared/${f}`, "utf8");
      expect(src, f).toContain('import { providerErrorSummary } from "./providerInput.ts";');
      expect(src, f).not.toMatch(/res\.status, errText\)/);
    }
  });
});
