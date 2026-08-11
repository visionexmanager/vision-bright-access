import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Ten career-ai-* functions became one router. These pin that no service was
// lost, that dispatch is a closed allowlist rather than a lookup into a
// function table, and that the security path is unchanged.

const router = readFileSync("supabase/functions/career-ai/index.ts", "utf8");
const handler = readFileSync("supabase/functions/_shared/careerAiHandler.ts", "utf8");
const prompts = readFileSync("supabase/functions/_shared/careerPrompts.ts", "utf8");
const chat = readFileSync("supabase/functions/_shared/careerAiChat.ts", "utf8");
const match = readFileSync("supabase/functions/_shared/careerAiMatch.ts", "utf8");

/** The ten services that existed before consolidation. */
const EXPECTED_ACTIONS = [
  "analyze", "coach", "health_score", "interview",
  "resume", "roadmap", "salary", "visa",
  "chat", "match",
];

describe("no service was lost", () => {
  it("routes all ten", () => {
    for (const action of EXPECTED_ACTIONS) {
      expect(router, `action ${action} missing`).toMatch(new RegExp(`\\b${action}\\b`));
    }
  });

  it("makes every service in the prompt registry reachable", () => {
    // CareerAiService is the source of truth for what the handler can serve.
    // A member routed by neither table would be dead code with a prompt.
    // `match` is reachable as a custom action rather than a structured one,
    // because it queries real job/profile rows instead of taking free text.
    const declared = [...prompts.matchAll(/^\s*\|\s*"([a-z_]+)"/gm)].map((m) => m[1]);
    expect(declared.length).toBe(9);

    const structured = router.slice(
      router.indexOf("STRUCTURED_ACTIONS"),
      router.indexOf("CUSTOM_ACTIONS"),
    );
    const custom = router.slice(router.indexOf("const CUSTOM_ACTIONS"));

    for (const service of declared) {
      const reachable =
        structured.includes(`${service}: "${service}"`) ||
        new RegExp(`^\\s{2}${service}:`, "m").test(custom);
      expect(reachable, `CareerAiService "${service}" is not routed`).toBe(true);
    }
  });

  it("routes chat, which is an endpoint but not a CareerAiService", () => {
    // chat has its own prompt path (getCareerChatPrompt) and streams, so it is
    // deliberately outside the structured service union.
    expect(router).toMatch(/^\s{2}chat: handleCareerAiChat,/m);
    expect(prompts).not.toMatch(/\|\s*"chat"/);
  });

  it("removed the ten old functions", () => {
    const remaining = readdirSync("supabase/functions").filter((n) => n.startsWith("career-ai-"));
    expect(remaining).toEqual([]);
    expect(existsSync("supabase/functions/career-ai/index.ts")).toBe(true);
  });
});

describe("dispatch is a closed allowlist", () => {
  it("rejects an unknown action", () => {
    expect(router).toContain("Unknown action");
    expect(router).toContain("400");
  });

  it("never resolves an action into an arbitrary handler", () => {
    // No dynamic import, no eval, no constructing a function name.
    expect(router).not.toMatch(/await import\(|new Function|eval\(/);
    expect(router).not.toMatch(/functions\/v1\/\$\{/);
  });

  it("uses own-property checks, so inherited names cannot dispatch", () => {
    // A bare `in` or bracket lookup would match "constructor" or "toString".
    expect(router).toContain("Object.prototype.hasOwnProperty.call(CUSTOM_ACTIONS, action)");
    expect(router).toContain("Object.prototype.hasOwnProperty.call(STRUCTURED_ACTIONS, action)");
  });

  it("freezes the tables so they cannot be mutated at runtime", () => {
    expect(router).toContain("Object.freeze({");
  });
});

describe("security behaviour is unchanged", () => {
  it("still authenticates through the one shared path", () => {
    expect(handler).toContain("authenticateCareerAiRequest");
    expect(chat).toContain("authenticateCareerAiRequest");
    expect(match).toContain("authenticateCareerAiRequest");
  });

  it("keeps rate limiting in the shared authenticator", () => {
    expect(handler).toContain("checkRateLimit");
  });

  it("keeps input validation on the custom actions", () => {
    expect(chat).toContain("validateAndCleanInput");
    expect(match).toContain("validateAndCleanInput");
  });

  it("is not JWT-exempt — the Career Center requires a real session", () => {
    const config = readFileSync("supabase/config.toml", "utf8");
    const deploy = readFileSync("scripts/deploy-changed-supabase-functions.sh", "utf8");
    expect(config).not.toMatch(/\[functions\.career-ai\]/);
    expect(deploy).not.toMatch(/\[career-ai\]=1/);
  });
});

describe("the extracted handlers kept their contracts", () => {
  it("chat still returns an SSE stream", () => {
    expect(chat).toContain('"Content-Type": "text/event-stream"');
    expect(chat).toContain("runCareerAIChatStream");
  });

  it("match still scores against the real tables", () => {
    expect(match).toContain("runStructuredCareerAI");
    expect(match).toContain("CAREER_AI_RESPONSE_SCHEMA");
  });

  it("shared imports were rewritten for their new location", () => {
    for (const [name, source] of [["chat", chat], ["match", match]] as const) {
      expect(source, `${name} still imports from ../_shared`).not.toContain('from "../_shared/');
      expect(source).toContain('from "./careerAiHandler.ts"');
    }
  });
});
