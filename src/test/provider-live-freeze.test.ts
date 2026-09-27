import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Phase 0: only providers and models that work today take live traffic.
// A parked model stays in its chains — configuration is not deleted — but the
// router never tries it, and a direct call to it is refused before any request.

const env: Record<string, string | undefined> = {};
const stubDeno = () => vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });
stubDeno();

const ai = await import("../../supabase/functions/_shared/aiProvider.ts");
const assistants = await import("../../supabase/functions/_shared/assistants.ts");
const generators = await import("../../supabase/functions/_shared/generators.ts");

const FLASH = { provider: "gemini", model: "gemini-flash-latest" } as const;
const LITE = { provider: "gemini", model: "gemini-flash-lite-latest" } as const;
const OPENAI = { provider: "openai", model: "gpt-4.1" } as const;
const source = (path: string) => readFileSync(path, "utf8");

// whatsappUnderstand.ts imports npm:pdf-parse, which the suite cannot load; its chain is read from source.
function whatsappVisionTargets() {
  const text = source("supabase/functions/_shared/whatsappUnderstand.ts");
  const start = text.indexOf("export const VISION_TARGETS");
  const chain = text.slice(start, text.indexOf("];", start));
  return [...chain.matchAll(/provider: "([a-z]+)", model: "([^"]+)"/g)].map((m) => ({ provider: m[1], model: m[2] }));
}

function fetchSpy() {
  const spy = vi.fn(async () => new Response("{}", { status: 500 }));
  vi.stubGlobal("fetch", spy);
  return spy;
}

beforeEach(() => {
  stubDeno();
  for (const k of Object.keys(env)) delete env[k];
  Object.assign(env, { OPENAI_API_KEY: "sk-test", GEMINI_API_KEY: "g-test", GROQ_API_KEY: "gsk-test", MISTRAL_API_KEY: "m-test" });
  ai.resetProviderCooldowns();
  ai.setProviderRegistryView(null);
});
afterEach(() => vi.unstubAllGlobals());

describe("parked models", () => {
  it("parks exactly the models that failed provider-smoke, each with its evidence", () => {
    expect([...ai.PAUSED_MODELS.keys()].sort()).toEqual([
      "gemini/gemini-flash-latest",
      "mistral/mistral-large-latest",
      "mistral/mistral-medium-latest",
      "mistral/mistral-small-2506",
      "mistral/mistral-small-latest",
    ]);
    for (const reason of ai.PAUSED_MODELS.values()) expect(reason).toMatch(/provider-smoke 2026-09-27/);
  });

  it("parks a model, not its provider: flash-lite and every other Gemini model stay routable", () => {
    expect(ai.pausedReason(FLASH)).toMatch(/429/);
    expect(ai.pausedReason(LITE)).toBeNull();
    expect(ai.pausedReason({ provider: "mistral", model: "ministral-14b-latest" })).toBeNull();
  });

  it("orderTargets drops a parked model and keeps the rest in order", () => {
    expect(ai.orderTargets([FLASH, LITE, OPENAI], "chat")).toEqual([LITE, OPENAI]);
  });

  it("a direct call to a parked model is refused with a 503 before any request is sent", async () => {
    const spy = fetchSpy();
    const error = await ai.structuredCompletion({
      ...FLASH, system: "s", userText: "u", schema: { type: "object" }, toolName: "t",
    }).catch((e) => e) as InstanceType<typeof ai.ProviderError>;
    expect(error).toBeInstanceOf(ai.ProviderError);
    expect(error.status).toBe(503);
    const streamed = await ai.streamChatCompletion({ ...FLASH, system: "s", messages: [{ role: "user", content: "hi" }] }).catch((e) => e);
    expect(streamed.status).toBe(503);
    expect(spy).not.toHaveBeenCalled();
  });

  it("a chain with nothing live left answers a controlled 503, without calling anyone", async () => {
    const spy = fetchSpy();
    const params = { system: "s", messages: [{ role: "user" as const, content: "hi" }], targets: [FLASH] };
    const error = await ai.streamChatCompletionWithFallback(params).catch((e) => e);
    expect(error).toBeInstanceOf(ai.ProviderError);
    expect(error.status).toBe(503);
    expect(error.message).toBe("No AI provider is available right now");
    expect(spy).not.toHaveBeenCalled();
  });

  it("a chain whose providers were tried and failed still says so (the 503 is only for 'nothing tried')", async () => {
    fetchSpy();
    const error = await ai.streamChatCompletionWithFallback({
      system: "s", messages: [{ role: "user", content: "hi" }], targets: [OPENAI],
    }).catch((e) => e);
    expect(error.message).not.toBe("No AI provider is available right now");
  });
});

describe("no live chain is left without a working model", () => {
  const live = (targets: ReadonlyArray<{ provider: string; model: string }>) =>
    targets.filter((t) => !ai.pausedReason(t as never));

  it("every assistant, generator and WhatsApp understanding chain keeps at least two live targets", () => {
    const chains: Array<[string, ReadonlyArray<{ provider: string; model: string }>]> = [
      ...Object.values(assistants.ASSISTANTS).map((a) => [a.id, a.targets] as [string, typeof a.targets]),
      ...["travel-itinerary", "content-writer", "no-such-generator"].map((id) => [id, generators.generatorTargets(id)] as [string, ReturnType<typeof generators.generatorTargets>]),
      ["whatsapp vision", whatsappVisionTargets()],
    ];
    for (const [id, targets] of chains) expect(live(targets).length, id).toBeGreaterThanOrEqual(2);
  });

  it("flash-lite follows flash-latest where Gemini is a fallback, and never leads a chain", () => {
    for (const id of ["legal-advisor", "social-guide", "no-such-assistant"]) {
      const models = assistants.assistantTargets(id).map((t) => t.model);
      expect(models.indexOf("gemini-flash-lite-latest"), id).toBe(models.indexOf("gemini-flash-latest") + 1);
    }
    // Where Gemini leads, it is not swapped for flash-lite: the chain moves on to Groq.
    const travel = assistants.assistantTargets("travel-agency");
    expect(travel.map((t) => t.model)).not.toContain("gemini-flash-lite-latest");
    expect(live(travel)[0].provider).toBe("groq");
  });

  it("site image analysis is led by gpt-4o while flash-latest is parked, with flash-lite behind it", () => {
    const analysts = source("supabase/functions/_shared/visionAnalysts.ts");
    const chain = analysts.slice(analysts.indexOf("const VISION_TARGETS"), analysts.indexOf("];", analysts.indexOf("const VISION_TARGETS")));
    const order = [...chain.matchAll(/model: "([^"]+)"/g)].map((m) => m[1]);
    expect(order).toEqual(["gemini-flash-latest", "gpt-4o", "gemini-flash-lite-latest"]);
  });
});

describe("providers with no credential are skipped, not tried", () => {
  it("providerHasCredential reads presence only", () => {
    expect(ai.providerHasCredential("openai")).toBe(true);
    expect(ai.providerHasCredential("anthropic")).toBe(false);
    env.ANTHROPIC_API_KEY = "   ";
    expect(ai.providerHasCredential("anthropic")).toBe(false);
  });

  it("Career AI skips a provider without a key, and a parked model, in both loops", () => {
    const career = source("supabase/functions/_shared/careerAiOrchestrator.ts");
    expect(career).toMatch(/function careerTargetLive\(provider: CareerAiProvider, model: string\): boolean \{\s*return providerHasCredential\(provider\) && !pausedReason\(\{ provider, model \}\);/);
    expect(career.match(/const model = MODEL_MATRIX\[provider\]\[tier\];\s*if \(!careerTargetLive\(provider, model\)\) continue;/g)).toHaveLength(2);
    // Anthropic keeps its place and its model: parked, not deleted.
    expect(career).toContain('["openai", "groq", "mistral", "anthropic"]');
  });
});

describe("health-check tells parked from healthy", () => {
  const health = source("supabase/functions/health-check/index.ts");

  it("probes the Gemini model the chains reach, not the parked one", () => {
    const gemini = health.slice(health.indexOf("  gemini: {"), health.indexOf("envKey: \"GEMINI_API_KEY\""));
    expect(gemini).toContain('model: "gemini-flash-lite-latest"');
    expect(gemini).not.toContain('model: "gemini-flash-latest"');
  });

  it("lists every parked model and every switched-off registry row as paused, admin-only", () => {
    const admin = health.slice(health.indexOf("if (isAdmin) {"));
    expect(admin).toContain("for (const [target, reason] of PAUSED_MODELS)");
    expect(admin).toContain('row.status === "inactive" || row.status === "error"');
    expect(admin).toContain('status: "paused"');
    // A row still marked active whose secret is missing is not reported as fine.
    expect(admin).toContain('state:  "missing_credentials"');
  });

  it("no longer reports ElevenLabs as ok when its key is missing", () => {
    const eleven = health.slice(health.indexOf("async function checkElevenLabs"), health.indexOf("async function checkElevenLabs") + 900);
    expect(eleven).toContain('status: hasMistral ? "paused" : "warning"');
    expect(eleven).not.toMatch(/status: hasMistral \? "ok"/);
  });

  it("never reads a secret's value into a report", () => {
    expect(health).not.toMatch(/detail:[^\n]*Deno\.env\.get\(/);
    expect(health).not.toMatch(/detail:[^\n]*apiKey\b/);
  });
});
