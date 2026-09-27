import { readdirSync, readFileSync } from "node:fs";
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
    expect(career).toMatch(/function careerTargetLive\(provider: CareerAiProvider, model: string\): boolean \{\s*return !parkedProviderReason\(provider\) && providerHasCredential\(provider\) && !pausedReason\(\{ provider, model \}\);/);
    expect(career.match(/const model = MODEL_MATRIX\[provider\]\[tier\];\s*if \(!careerTargetLive\(provider, model\)\) continue;/g)).toHaveLength(2);
    // Anthropic keeps its place and its model: parked, not deleted.
    expect(career).toContain('["openai", "groq", "mistral", "anthropic"]');
  });
});

describe("Phase 1: a key is not a production approval", () => {
  const state = () => import("../../supabase/functions/_shared/providerState.ts");
  const ANTHROPIC = { provider: "anthropic", model: "claude-haiku-4-5-20251001" } as const;
  const ROUTER = { provider: "openrouter", model: "google/gemma-4-26b-a4b-it:free" } as const;

  it("parks exactly the providers whose only switch was their secret", async () => {
    expect([...(await state()).PARKED_PROVIDERS.keys()].sort()).toEqual(["anthropic", "elevenlabs", "luma", "replicate"]);
  });

  it("a parked provider is never selected from a chain, even with its key present", () => {
    env.ANTHROPIC_API_KEY = "sk-ant-test";
    expect(ai.orderTargets([ANTHROPIC, OPENAI], "chat")).toEqual([OPENAI]);
  });

  it("a direct call to a parked provider fails closed, key or not, before any request", async () => {
    env.ANTHROPIC_API_KEY = "sk-ant-test";
    const spy = fetchSpy();
    const error = await ai.streamChatCompletion({ ...ANTHROPIC, system: "s", messages: [{ role: "user", content: "hi" }] })
      .catch((e) => e) as InstanceType<typeof ai.ProviderError>;
    expect(error.status).toBe(503);
    expect(spy).not.toHaveBeenCalled();
  });

  it("a direct call to an activation-gated provider fails closed until the registry switches it on", async () => {
    env.OPENROUTER_API_KEY = "sk-or-test";
    const spy = fetchSpy();
    const call = () => ai.structuredCompletion({ ...ROUTER, system: "s", userText: "u", schema: { type: "object" }, toolName: "t" });
    expect(((await call().catch((e) => e)) as InstanceType<typeof ai.ProviderError>).status).toBe(503);
    expect(spy).not.toHaveBeenCalled();
    // Switched on by the registry, the same call reaches the provider.
    ai.setProviderRegistryView({ verdict: () => "ready", extras: () => [] });
    await call().catch(() => undefined);
    expect(spy).toHaveBeenCalled();
  });

  it("every selection point that used to trust a key alone now consults the parked list", () => {
    const at = (path: string) => source(`supabase/functions/${path}`);
    expect(at("_shared/careerAiOrchestrator.ts")).toContain("!parkedProviderReason(provider) && providerHasCredential(provider)");
    expect(at("news-generate/index.ts")).toContain('parkedProviderReason("anthropic") ? undefined : Deno.env.get("ANTHROPIC_API_KEY")');
    expect(at("_shared/contentMedia.ts")).toMatch(/export function mediaVideoKey\(\): string \| undefined \{\s*if \(parkedProviderReason\("luma"\)\) return undefined;/);
    expect(at("video-studio/index.ts")).toContain('parkedProviderReason("luma") ? undefined : Deno.env.get("LUMA_API_KEY")');
    expect(at("voice-studio/index.ts")).toContain('parkedProviderReason("elevenlabs") ? undefined : Deno.env.get("ELEVENLABS_API_KEY")');
    expect(at("speech-generate/index.ts")).toContain("if (parkedProviderReason(name)) throw");
    expect(at("_shared/whatsappVoiceChoice.ts")).toContain('parkedProviderReason("elevenlabs")) return null;');
    expect(at("image-tools-generate/index.ts")).toContain('parkedProviderReason("replicate") || !Deno.env.get("REPLICATE_API_TOKEN")');
  });

  it("no other code reads a parked provider's secret to decide whether to use it", () => {
    // The adapters and health-check read them; nothing else may.
    const allowed = new Set([
      "health-check/index.ts", "career-system-health/index.ts", "_shared/aiProvider.ts", "_shared/voice/tts.ts", "image-tools-generate/index.ts",
      "news-generate/index.ts", "video-studio/index.ts", "voice-studio/index.ts", "_shared/contentMedia.ts",
    ]);
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(path);
        else if (entry.name.endsWith(".ts") && !entry.name.includes("test")) {
          const rel = path.replace("supabase/functions/", "");
          // Code only: comments and strings that merely name a secret are not reads of it.
          const code = readFileSync(path, "utf8").split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
          const reads = /Deno\.env\.get\(\s*"(ANTHROPIC_API_KEY|REPLICATE_API_TOKEN|LUMA_API_KEY|ELEVENLABS_API_KEY)"|env\.get\("(LUMA_API_KEY|ELEVENLABS_API_KEY)"\)|checkEnvVar\("ANTHROPIC_API_KEY"\)|KEY_FOR\[/;
          if (reads.test(code) && !allowed.has(rel)) {
            offenders.push(rel);
          }
        }
      }
    };
    walk("supabase/functions");
    expect(offenders).toEqual([]);
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
