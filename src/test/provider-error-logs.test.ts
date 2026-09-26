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

  it("a response body never reaches a log, an Error or a response unless it passes through providerErrorSummary", () => {
    // Data flow, not spelling: the first pattern missed `const t = await response.text()`.
    const offenders: string[] = [];
    for (const f of tsFiles("supabase/functions")) {
      const src = readFileSync(f, "utf8");
      const vars = [...src.matchAll(/const (\w+) = await (?:res|response|r)\.text\(\)/g)].map((m) => m[1]);
      src.split(/\r?\n/).forEach((line, i) => {
        const sink = /console\.(error|warn|log|info)\(|throw new Error\(|lastError =|JSON\.stringify\(\{ error/.test(line);
        if (!sink) return;
        if (/await (res|response|r)\.text\(\)/.test(line) && !/providerErrorSummary\(await (res|response|r)\.text\(\)\)/.test(line)) {
          offenders.push(`${f}:${i + 1} (inline body)`);
        }
        for (const v of vars) {
          const used = new RegExp(`\\$\\{${v}\\}|[,(]\\s*${v}\\s*[,)]|${v}\\.slice\\(`).test(line);
          const wrapped = new RegExp(`providerErrorSummary\\(${v}\\)`).test(line);
          if (used && !wrapped) offenders.push(`${f}:${i + 1} (${v})`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it("the eval scripts that print to public CI logs keep provider codes only", () => {
    for (const f of ["scripts/ai-eval/providers.mjs", "scripts/ai-eval/list-models.mjs"]) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/body\.slice\(/);
      expect(src, f).toMatch(/providerErrorSummary\(body\)/);
    }
  });

  it("no log line carries an email address", () => {
    const offenders: string[] = [];
    for (const f of tsFiles("supabase/functions")) {
      readFileSync(f, "utf8").split(/\r?\n/).forEach((line, i) => {
        if (/console\.(error|warn|log|info)\(.*\.email\b/.test(line)) offenders.push(`${f}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it("publicMediaFailure logs a category and a code or a length — never the provider's sentence", () => {
    const src = readFileSync("supabase/functions/_shared/providerInput.ts", "utf8");
    const fn = src.slice(src.indexOf("export function publicMediaFailure"), src.indexOf("export function providerErrorSummary"));
    expect(fn).toContain('console.error(`[${tag}] provider failure:`, category, code);');
    expect(fn).not.toMatch(/text\.slice\(0, 300\)/);
  });

  it("realtime-session answers the browser with a fixed sentence, not OpenAI's message", () => {
    const src = readFileSync("supabase/functions/realtime-session/index.ts", "utf8");
    expect(src).not.toMatch(/openaiError|JSON\.parse\(err\)\?\.error\?\.message/);
    expect(src).toContain("The voice session could not be started. Please try again shortly.");
  });

  it("the shared chat layer and Gemini use it", () => {
    for (const f of ["aiProvider.ts", "geminiProvider.ts"]) {
      const src = readFileSync(`supabase/functions/_shared/${f}`, "utf8");
      expect(src, f).toContain('import { providerErrorSummary } from "./providerInput.ts";');
      expect(src, f).not.toMatch(/res\.status, errText\)/);
    }
  });
});
