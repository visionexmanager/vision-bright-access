import { describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ACCESS_MESSAGE_KEYS, AI_FUNCTIONS_WITHOUT_SECTION, AI_FUNCTION_SECTIONS, decideAccess, EDGE_POLICY, isEntitledPlan, operationById, OPERATIONS,
  type Guard,
} from "@/lib/access/policy";
import { planAllows, sectionForPath, TRIAL_SECTIONS } from "@/lib/billing/plans";
import { CACHE_KEY_VERSION, CACHE_MAX_AGE_DAYS, CACHE_MODEL, findSavedResponse, textModeCacheKey, textModeInput } from "../../supabase/functions/_shared/librarySavedAnswers";

const FUNCTIONS = "supabase/functions";
const read = (p: string) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const dirSource = (name: string) =>
  readdirSync(join(FUNCTIONS, name)).filter((f) => f.endsWith(".ts")).map((f) => read(join(FUNCTIONS, name, f))).join("\n");

/** Evidence that a function reaches a paid external provider, directly. */
const PROVIDER = /aiProvider|streamChatCompletion|structuredCompletion|meteredFetch\(|api\.openai\.com|api\.groq\.com|generativelanguage|api\.mistral|openrouter\.ai|elevenlabs|lumalabs|createPrediction|generateImage|transcribeWithWhisper/;
/** The call sites, as opposed to an import line. */
const PROVIDER_CALL = /structuredCompletion\(|streamChatCompletion\(|meteredFetch\(|fetch\(\s*["'`]https:\/\/api\.(openai|groq|mistral)|fetch\(\s*["'`]https:\/\/generativelanguage|transcribeWithWhisper\(|generateImage\(|createPrediction\(|generateWithFal\(|generateSpeech\(/;

const GUARD_EVIDENCE: Record<Guard, RegExp | null> = {
  none: null,
  unverified: null,
  token: /\.eq\("(manage_)?token"/,
  jwt: /getUser\(/,
  signature: /signature|constructEvent|hmac/i,
  cron: /CRON_SECRET/,
  admin: /has_role|user_roles|isAdmin|callerIsAdmin/,
  owner: /getUser\(/,
  ai_gate: /subscriptionGate\(/,
  voice_guard: /guardVoiceRequest\(/,
  webhook_gate: /requireActiveSubscription\(/,
  paid_plan: /hasActivePaidPlan\(/,
  claim: /bazaar_notify_claim/,
};
/** Functions whose gate lives in a shared handler rather than their own file. */
const GATED_VIA: Record<string, RegExp> = { "career-ai": /handleStructuredCareerAiRequest/ };

describe("the Edge Function table", () => {
  const dirs = readdirSync(FUNCTIONS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "_shared").map((d) => d.name).sort();

  it("classifies every Edge Function, and nothing that does not exist", () => {
    expect(Object.keys(EDGE_POLICY).sort()).toEqual(dirs);
  });

  it("never lets a function that reaches a paid provider be classified A, B or C (only the free moderation endpoint is excepted)", () => {
    const offenders = dirs.filter((d) => PROVIDER.test(dirSource(d)) && ["A", "B", "C"].includes(EDGE_POLICY[d].cls));
    expect(offenders).toEqual(["moderate-content"]);
    expect(dirSource("moderate-content")).toMatch(/moderations/);
  });

  it("closes every paid-provider function to the trial", () => {
    for (const [name, p] of Object.entries(EDGE_POLICY)) {
      if (p.cls === "D" || p.cls === "R") expect(p.trial, name).toBe(false);
    }
  });

  it("gives every D function a real guard, and the source of that function shows it", () => {
    for (const [name, p] of Object.entries(EDGE_POLICY)) {
      if (p.cls !== "D") continue;
      expect(["ai_gate", "voice_guard", "webhook_gate", "paid_plan", "claim", "admin", "cron", "owner"], `${name}: guard ${p.guard}`).toContain(p.guard);
      const evidence = GUARD_EVIDENCE[p.guard]!;
      const source = dirSource(name);
      const ok = evidence.test(source) || (GATED_VIA[name]?.test(source) ?? false);
      expect(ok, `${name} claims guard ${p.guard} but its source shows none`).toBe(true);
    }
  });

  it("states a guard for every other class too, and no function is left 'unverified'", () => {
    for (const [name, p] of Object.entries(EDGE_POLICY)) {
      const evidence = GUARD_EVIDENCE[p.guard];
      if (evidence && p.cls !== "D") expect(evidence.test(dirSource(name)), `${name} (${p.guard})`).toBe(true);
    }
    const unverified = Object.entries(EDGE_POLICY).filter(([, p]) => p.guard === "unverified").map(([n]) => n);
    expect(unverified).toEqual([]);
    // Nothing is left open: the one that was (bazaar-notify-seller, no send limit) now claims a limit before it sends.
    const open = Object.entries(EDGE_POLICY).filter(([, p]) => p.open).map(([n]) => n);
    expect(open).toEqual([]);
  });

  it("runs the subscription gate BEFORE the first provider call in every ai_gate function", () => {
    for (const [name, p] of Object.entries(EDGE_POLICY)) {
      if (p.guard !== "ai_gate" || GATED_VIA[name]) continue;
      // Code only: a comment that mentions a call is not a call.
      const lines = read(join(FUNCTIONS, name, "index.ts")).split("\n");
      const code = lines.filter((l) => !/^\s*(\/\/|\*|\/\*|import )/.test(l)).join("\n");
      // Helper functions are defined above the handler and run only when it calls them.
      const handler = Math.max(code.indexOf("Deno.serve"), code.search(/^serve\(/m));
      const src = handler > -1 ? code.slice(handler) : code;
      const gate = src.indexOf("subscriptionGate(");
      const call = src.search(PROVIDER_CALL);
      expect(gate, `${name}: no gate call`).toBeGreaterThan(-1);
      if (call > -1) expect(gate, `${name}: a provider call comes before the gate`).toBeLessThan(call);
    }
  });

  it("keeps cron and admin provider functions off the user path: they refuse without their secret or role", () => {
    for (const name of ["news-generate", "library-process-background-jobs", "provider-hub", "social-publish"]) {
      expect(dirSource(name), name).toMatch(/CRON_SECRET/);
    }
    for (const name of ["analytics-insights", "enrich-product", "kids-course-generate", "embed-content", "career-system-health"]) {
      expect(dirSource(name), name).toMatch(/has_role|user_roles/);
    }
  });

  it("LiveKit: the plan is checked before the body is read or a token is signed, and a trial cannot reach it", () => {
    const src = dirSource("livekit-token");
    expect(src.indexOf("hasActivePaidPlan(")).toBeGreaterThan(-1);
    expect(src.indexOf("hasActivePaidPlan(")).toBeLessThan(src.indexOf("await req.json()"));
    expect(src.indexOf("hasActivePaidPlan(")).toBeLessThan(src.indexOf("new AccessToken("));
    expect(EDGE_POLICY["livekit-token"]).toMatchObject({ cls: "D", trial: false });
    expect(decideAccess(operationById("voice.rooms"), { signedIn: true, plan: "free_trial" })).toMatchObject({ allow: false, reason: "trial_excluded" });
    expect(decideAccess(operationById("voice.rooms"), { signedIn: true, plan: "kids" })).toMatchObject({ allow: true });
  });

  it("career-system-health refuses before it probes the provider or writes (cron secret or admin)", () => {
    const src = dirSource("career-system-health");
    const guard = src.indexOf("CRON_SECRET");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(src.indexOf("checkGemini()", src.indexOf("Deno.serve")));
    expect(guard).toBeLessThan(src.indexOf(".insert(rows)"));
    expect(src).toMatch(/has_role/);
    expect(src).toMatch(/Unauthorized/);
  });

  it("library-librarian-daily-plan returns the caller's own stored plan BEFORE the gate and the limit, and force still pays", () => {
    const src = dirSource("library-librarian-daily-plan");
    const handler = src.indexOf("Deno.serve");
    const stored = src.indexOf(".from(\"library_librarian_daily_plans\").select(\"*\")", handler);
    const gate = src.indexOf("subscriptionGate(serviceClient", handler);
    const limit = src.indexOf("check_ai_rate_limit", handler);
    const call = src.indexOf("structuredCompletion({", handler);
    expect(stored).toBeGreaterThan(-1);
    expect(stored).toBeLessThan(gate);
    expect(gate).toBeLessThan(limit);
    expect(limit).toBeLessThan(call);
    expect(src.slice(stored - 200, stored + 120)).toMatch(/!body.force/);
    expect(src.slice(stored, gate)).toMatch(/\.eq\("user_id", user\.id\)/);
  });

  it("bazaar-notify-seller: authorise the event, claim the limit, and only then create or send anything", () => {
    const src = dirSource("bazaar-notify-seller");
    const handler = src.indexOf("Deno.serve");
    const at = (needle: string, from = handler) => { const i = src.indexOf(needle, from); expect(i, needle).toBeGreaterThan(-1); return i; };
    const internalOnly = at("INTERNAL_ONLY_EVENTS.has(payload.eventType)");
    const orderCheck = at('.from("bazaar_orders")');
    const claim = at('rpc("bazaar_notify_claim"');
    const inApp = at('.from("notifications").insert');
    const email = at("https://api.resend.com/emails");
    const whatsapp = at("/messages`");
    expect(internalOnly).toBeLessThan(claim);
    expect(orderCheck).toBeLessThan(claim);
    expect(claim).toBeLessThan(inApp);
    expect(inApp).toBeLessThan(email);
    expect(claim).toBeLessThan(whatsapp);
    // the paid channels are sent only when the claim granted them
    expect(src).toMatch(/if \(external && shop\.email_notifications !== false\)/);
    expect(src).toMatch(/if \(external && shop\.whatsapp_notifications && shop\.whatsapp_number\)/);
    // a user's e-mail address is never put in a seller's notification
    // (the seller's own address, `owner.data.user?.email`, is what the e-mail is sent TO, and is exempt)
    expect(src).not.toMatch(/(?<![.\w])user!?\??\.email/);
    // fails closed
    expect(src).toMatch(/claimError \|\| !claim/);
    // platform calls are the only unlimited path
    expect(src).toMatch(/if \(!isInternal\) \{[\s\S]*bazaar_notify_claim/);
  });

  it("keeps webhooks behind the sender gate before any provider call", () => {
    for (const name of ["whatsapp-webhook", "meta-messaging-webhook"]) {
      const src = read(join(FUNCTIONS, name, "index.ts"));
      expect(src, name).toMatch(/requireActiveSubscription\(/);
    }
  });
});

describe("the operation registry", () => {
  it("only declares edge functions that exist in the table", () => {
    for (const o of OPERATIONS) for (const e of o.edge) expect(EDGE_POLICY[e], `${o.id} -> ${e}`).toBeDefined();
  });

  it("never lets a trial-allowed operation touch a paid provider, except through a stored answer served first", () => {
    for (const o of OPERATIONS.filter((x) => x.trialAllowed)) {
      expect(o.paidProvider, o.id).toBe(false);
      for (const e of o.edge) {
        const cls = EDGE_POLICY[e].cls;
        if (cls === "D") expect(o.localFallback, `${o.id} -> ${e} is a paid-provider function`).toBe(true);
        expect(cls, `${o.id} -> ${e}`).not.toBe("R");
      }
    }
  });

  it("opens to the trial only sections that hold no paid-provider operation of their own", () => {
    for (const section of TRIAL_SECTIONS) {
      const ops = OPERATIONS.filter((o) => o.section === section && o.paidProvider && o.trialAllowed);
      expect(ops.map((o) => o.id), section).toEqual([]);
    }
  });

  it("marks every paid-provider operation as needing a paid plan and closed to the trial", () => {
    for (const o of OPERATIONS.filter((x) => x.paidProvider)) {
      expect(o.needsPaidPlan, o.id).toBe(true);
      expect(o.trialAllowed, o.id).toBe(false);
    }
  });
});

describe("decideAccess", () => {
  const trial = { signedIn: true, plan: "free_trial", vxBalance: 0 };
  const basic = { signedIn: true, plan: "basic", vxBalance: 5000 };
  const anon = { signedIn: false, plan: "none" };
  const op = (id: string) => operationById(id);

  it("3. lets a trial user play a local game and read local lessons", () => {
    expect(sectionForPath("/games/hangman")).toBe("arcade");
    expect(planAllows("free_trial", "arcade")).toBe(true);
    const d = decideAccess(op("arcade.play"), trial);
    expect(d).toMatchObject({ allow: true, source: "internal", providerCalled: false });
    expect(decideAccess(op("academy.content"), trial)).toMatchObject({ allow: true, providerCalled: false });
  });

  it("2. plays stored audio in the trial without any external TTS", () => {
    const o = op("library.audio_playback")!;
    expect(o.edge).toEqual([]);
    expect(o.paidProvider).toBe(false);
    expect(decideAccess(o, trial)).toMatchObject({ allow: true, source: "internal", providerCalled: false });
  });

  it("1/11. serves a saved library answer to a trial user and never marks a provider as called", () => {
    const d = decideAccess(op("library.ai_generate"), trial, { savedAvailable: true });
    expect(d).toMatchObject({ allow: true, source: "saved", providerCalled: false, messageKey: ACCESS_MESSAGE_KEYS.saved });
  });

  it("4. blocks an anonymous caller from a paid operation before the provider", () => {
    for (const o of OPERATIONS.filter((x) => x.paidProvider)) {
      expect(decideAccess(o, anon, { providerAvailable: true }), o.id).toMatchObject({ allow: false, reason: "sign_in", providerCalled: false });
    }
  });

  it("5. blocks a trial user from an excluded paid operation, and names the trial as the reason", () => {
    for (const o of OPERATIONS.filter((x) => x.paidProvider && x.id !== "whatsapp.ai")) {
      const d = decideAccess(o, trial, { providerAvailable: true, vxCost: 10 });
      expect(d.allow, o.id).toBe(false);
      expect("reason" in d && d.reason, o.id).toBe("trial_excluded");
      expect(d.providerCalled).toBe(false);
    }
  });

  it("6. lets a subscribed user with the entitlement and VX run the operation", () => {
    expect(decideAccess(op("assistant.chat"), basic, { providerAvailable: true })).toMatchObject({ allow: true, source: "provider" });
    expect(decideAccess(op("library.ai_generate"), basic, { providerAvailable: true })).toMatchObject({ allow: true, source: "provider" });
  });

  it("7. refuses a subscribed user without enough VX on a charged operation", () => {
    const d = decideAccess(op("image.generate"), { signedIn: true, plan: "business", vxBalance: 10 }, { vxCost: 60, providerAvailable: true });
    expect(d).toMatchObject({ allow: false, reason: "insufficient_vx", providerCalled: false });
    expect(decideAccess(op("image.generate"), { signedIn: true, plan: "business" }, { vxCost: 60 })).toMatchObject({ allow: false, reason: "insufficient_vx" });
  });

  it("8. an unavailable provider is a refusal, never a fall-through to another one", () => {
    const d = decideAccess(op("assistant.chat"), basic, { providerAvailable: false });
    expect(d).toMatchObject({ allow: false, reason: "unavailable", providerCalled: false });
    // and the order matters: an entitled-looking caller who is not entitled is refused for that, before availability is even asked
    expect(decideAccess(op("assistant.chat"), trial, { providerAvailable: false })).toMatchObject({ reason: "trial_excluded" });
  });

  it("a plan that does not open the section is told so, not told to subscribe", () => {
    expect(decideAccess(op("assistant.chat"), { signedIn: true, plan: "kids", vxBalance: 0 }, { providerAvailable: true }))
      .toMatchObject({ allow: false, reason: "plan_not_included", messageKey: "access.planNotIncluded" });
  });

  it("14. treats an unknown or review-only operation as closed", () => {
    expect(decideAccess(undefined, basic)).toMatchObject({ allow: false, reason: "review", providerCalled: false });
    const reviewOnly = { ...op("assistant.chat")!, id: "x.review", cls: "R" as const };
    expect(decideAccess(reviewOnly, { signedIn: true, plan: "business" })).toMatchObject({ allow: false, reason: "review" });
  });

  it("admins pass the plan checks but are still subject to identity", () => {
    expect(decideAccess(op("assistant.chat"), { signedIn: true, plan: "admin" }, { providerAvailable: true })).toMatchObject({ allow: true });
    expect(isEntitledPlan("admin")).toBe(true);
    expect(isEntitledPlan("free_trial")).toBe(false);
    expect(isEntitledPlan("none")).toBe(false);
  });
});

describe("saved library answers (no provider, no gate)", () => {
  /** A client that records every table it is asked about and answers from a fixed set. */
  function stub(rows: Record<string, Record<string, unknown> | null>, boom = false) {
    const touched: string[] = [];
    const client = {
      from(table: string) {
        touched.push(table);
        if (boom) throw new Error("db down");
        const chain: Record<string, unknown> = {};
        for (const m of ["select", "eq", "is", "gte"]) chain[m] = () => chain;
        chain.maybeSingle = async () => ({ data: rows[table] ?? null, error: null });
        return chain;
      },
    };
    return { client, touched };
  }
  const EXPLAIN = { explain: "Explain", simplify: "Simplify" } as Record<string, string>;

  it("1. returns a stored summary from library_ai_summaries and touches nothing else", async () => {
    const { client, touched } = stub({ library_ai_summaries: { content: "A stored summary.", created_at: "2026-10-01T00:00:00Z" } });
    const r = await findSavedResponse(client, { mode: "smart-summary", book_id: "b1", scope: "book", length: "medium" }, "student", EXPLAIN);
    expect(r).toMatchObject({ kind: "summary", result: { summary: "A stored summary.", cached: true, source: "saved", saved_at: "2026-10-01T00:00:00Z" } });
    expect(touched).toEqual(["library_ai_summaries"]);
  });

  it("11. returns a stored translation or explanation from the content cache, labelled as saved", async () => {
    const { client, touched } = stub({ library_ai_content_cache: { result_text: "Hola", created_at: "2026-09-01T00:00:00Z" } });
    const t = await findSavedResponse(client, { mode: "translate-paragraph", text: "Hello", targetLanguage: "Spanish" }, "student", EXPLAIN, client, "user-a");
    expect(t).toMatchObject({ kind: "text", result: { translated_text: "Hola", source: "saved" } });
    const e = await findSavedResponse(client, { mode: "explain-paragraph", text: "Hello" }, "student", EXPLAIN, client, "user-a");
    expect(e).toMatchObject({ kind: "text", result: { explanation: "Hola", source: "saved" } });
    expect(new Set(touched)).toEqual(new Set(["library_ai_content_cache"]));
  });

  it("returns null on a miss, for a mode that is never stored, and for an incomplete request", async () => {
    const { client } = stub({});
    expect(await findSavedResponse(client, { mode: "smart-summary", book_id: "b1" }, "student", EXPLAIN)).toBeNull();
    expect(await findSavedResponse(client, { mode: "answer-question", book_id: "b1" }, "student", EXPLAIN)).toBeNull();
    expect(await findSavedResponse(client, { mode: "translate-paragraph", text: "x" }, "student", EXPLAIN)).toBeNull();
    expect(await findSavedResponse(client, { mode: "smart-summary", scope: "chapter", book_id: "b1" }, "student", EXPLAIN)).toBeNull();
  });

  it("cache privacy: a summary written in one reader's style is never served to a reader of another style", async () => {
    const { client, touched } = stub({ library_ai_summaries: { content: "STORED-SUMMARY", created_at: "2026-10-01T00:00:00Z" } });
    for (const mode of ["child", "professional", "beginner", "teacher"]) {
      expect(await findSavedResponse(client, { mode: "smart-summary", book_id: "b1", scope: "book", length: "medium" }, mode, EXPLAIN)).toBeNull();
    }
    expect(touched).toEqual([]);
    expect(await findSavedResponse(client, { mode: "smart-summary", book_id: "b1", scope: "book", length: "medium" }, "student", EXPLAIN)).not.toBeNull();
    const fn = read("supabase/functions/library-ai-assistant/index.ts");
    expect(fn).toMatch(/if \(readingMode === SHARED_SUMMARY_READING_MODE\) \{\s*await serviceClient\.from\("library_ai_summaries"\)\.upsert/);
  });

  it("14. a database failure is a miss (it falls to the gate), never an answer or a throw", async () => {
    const { client } = stub({}, true);
    await expect(findSavedResponse(client, { mode: "smart-summary", book_id: "b1" }, "student", EXPLAIN)).resolves.toBeNull();
  });

  it("keys the stored answer exactly as the writer does (same builder, same hash), per user", async () => {
    const body = { mode: "translate-paragraph", text: "Hello", targetLanguage: "French" };
    const input = textModeInput(body, EXPLAIN);
    expect(input).toBe("Translate the following into French:\n\nHello");
    const a = await textModeCacheKey(body, "student", EXPLAIN, "user-a");
    const b = await textModeCacheKey({ ...body }, "student", EXPLAIN, "user-a");
    const c = await textModeCacheKey({ ...body, targetLanguage: "German" }, "student", EXPLAIN, "user-a");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("cache privacy: two accounts submitting identical text get different keys, so nobody can read or probe another account's entry", async () => {
    const body = { mode: "explain-paragraph", text: "A private passage a user pasted", instruction: "explain" };
    const a = await textModeCacheKey(body, "student", EXPLAIN, "user-a");
    const b = await textModeCacheKey(body, "student", EXPLAIN, "user-b");
    expect(a).not.toBe(b);
    // no caller id, no key: the per-user cache is simply not read
    expect(await textModeCacheKey(body, "student", EXPLAIN, "")).toBeNull();
    const { client, touched } = stub({ library_ai_content_cache: { result_text: "x", created_at: new Date().toISOString() } });
    expect(await findSavedResponse(client, body, "student", EXPLAIN, client, "")).toBeNull();
    expect(touched).toEqual([]);
  });

  it("cache invalidation: the model and the key version are part of the key, the age limit is applied, and the model matches the one the function calls", async () => {
    const body = { mode: "translate-paragraph", text: "Hello", targetLanguage: "French" };
    const base = await textModeCacheKey(body, "student", EXPLAIN, "u");
    expect(base).not.toBe(await textModeCacheKey(body, "teacher", EXPLAIN, "u"));
    const lib = read("supabase/functions/_shared/librarySavedAnswers.ts");
    expect(lib).toMatch(/CACHE_KEY_VERSION,\s*\n\s*CACHE_MODEL,/);
    expect(CACHE_KEY_VERSION).toBe("v2");
    expect(CACHE_MAX_AGE_DAYS).toBe(90);
    expect(lib).toMatch(/\.gte\("created_at"/);
    const fn = read("supabase/functions/library-ai-assistant/index.ts");
    const modelsUsedForCachedModes = fn.slice(fn.indexOf("const isCacheableTextMode"), fn.indexOf("const finalResult")).match(/model: "([^"]+)"/g) ?? [];
    expect(modelsUsedForCachedModes).toContain(`model: "${CACHE_MODEL}"`);
    // a refreshed entry gets a fresh date, so an expired one is replaced rather than ignored for ever
    expect(fn).toMatch(/result_text: resultText, created_at: new Date\(\)\.toISOString\(\)/);
  });

  it("11. the Edge Function reads the stored answer BEFORE the subscription gate, the daily limit and every provider call", () => {
    const src = read("supabase/functions/library-ai-assistant/index.ts");
    const saved = src.indexOf("findSavedResponse(userClient");
    const gate = src.indexOf("subscriptionGate(serviceClient");
    const limit = src.indexOf('rpc("check_ai_rate_limit"');
    const call = src.search(/structuredCompletion\(\{/);
    expect(saved).toBeGreaterThan(-1);
    expect(saved).toBeLessThan(gate);
    expect(gate).toBeLessThan(limit);
    expect(limit).toBeLessThan(call);
    // a hit returns on the spot
    const hit = src.slice(saved, gate);
    expect(hit).toMatch(/if \(saved\)[\s\S]*return json\(/);
    // serviceClient appears exactly once: as the client for the key-only cache lookup (20261080).
    expect(hit.match(/serviceClient/g)?.length).toBe(1);
    expect(hit).toMatch(/EXPLAIN_INSTRUCTIONS, serviceClient, user\.id\)/);
    expect(hit).not.toMatch(/structuredCompletion|billedRequest|meter\(|\.rpc\(/);
  });

  it("11. a miss still reaches the gate; the lookup reads through the caller's own session, never the service role", () => {
    const src = read("supabase/functions/library-ai-assistant/index.ts");
    expect(src).toMatch(/findSavedResponse\(userClient,/);
    expect(src).not.toMatch(/findSavedResponse\(serviceClient/);
    const lib = read("supabase/functions/_shared/librarySavedAnswers.ts");
    expect(lib).not.toMatch(/SERVICE_ROLE|service_role|structuredCompletion|fetch\(/);
  });

  it("never rewrites a stored answer: the cache is written only after a new provider answer", () => {
    const src = read("supabase/functions/library-ai-assistant/index.ts");
    const write = src.indexOf('from("library_ai_content_cache").upsert');
    expect(write).toBeGreaterThan(src.search(/structuredCompletion\(\{/));
  });
});

describe("section-level authorization of AI functions", () => {
  const gated = Object.entries(EDGE_POLICY).filter(([, p]) => p.guard === "ai_gate" || p.guard === "voice_guard").map(([n]) => n).sort();
  const sectionEvidence = (name: string, section: string) => {
    const files = name === "career-ai" ? [read("supabase/functions/_shared/careerAiHandler.ts")] : [dirSource(name)];
    return files.some((f) => new RegExp(`(requireSection|maySeeSection)\\([^)]*"${section}"`).test(f));
  };

  it("every gated AI function is either mapped to a section or listed, with a reason, as gate-only: none is forgotten", () => {
    const mapped = Object.keys(AI_FUNCTION_SECTIONS);
    const unmapped = Object.keys(AI_FUNCTIONS_WITHOUT_SECTION);
    expect(mapped.filter((n) => unmapped.includes(n))).toEqual([]);
    expect([...mapped, ...unmapped].filter((n) => !gated.includes(n))).toEqual([]);
    expect(gated.filter((n) => !mapped.includes(n) && !unmapped.includes(n))).toEqual([]);
    for (const [n, why] of Object.entries(AI_FUNCTIONS_WITHOUT_SECTION)) expect(why.length, n).toBeGreaterThan(20);
  });

  it("the gate-only list can shrink but not grow (14 today; adding to it is a product decision)", () => {
    expect(Object.keys(AI_FUNCTIONS_WITHOUT_SECTION).length).toBeLessThanOrEqual(14);
  });

  it("every mapped function checks THAT section on the server, after the subscription gate and before any provider call", () => {
    for (const [name, section] of Object.entries(AI_FUNCTION_SECTIONS)) {
      expect(sectionEvidence(name, section), `${name} does not check the ${section} section`).toBe(true);
    }
    for (const name of Object.keys(AI_FUNCTION_SECTIONS)) {
      const file = name === "career-ai" ? "supabase/functions/_shared/careerAiHandler.ts" : join(FUNCTIONS, name, "index.ts");
      const code = read(file).split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|import )/.test(l)).join("\n");
      const handler = Math.max(code.indexOf("Deno.serve"), code.search(/^serve\(/m), 0);
      const src = code.slice(handler);
      const gate = src.indexOf("subscriptionGate(");
      const section = src.search(/requireSection\(|maySeeSection\(/);
      const call = src.search(PROVIDER_CALL);
      expect(gate, `${name}: gate`).toBeGreaterThan(-1);
      expect(section, `${name}: section check`).toBeGreaterThan(-1);
      if (name !== "library-ai-assistant" && name !== "library-librarian-daily-plan") expect(section, `${name}: section check must follow the gate`).toBeGreaterThan(gate);
      if (call > -1) expect(section, `${name}: a provider call comes before the section check`).toBeLessThan(call);
    }
  });

  it("table-driven: for every plan and every mapped function the server answer equals plans.ts (the canonical rules)", () => {
    const plans = ["free_trial", "none", "kids", "basic", "pro", "business"] as const;
    for (const plan of plans) {
      for (const [fn, section] of Object.entries(AI_FUNCTION_SECTIONS)) {
        const paying = isEntitledPlan(plan);
        const sectionOpen = planAllows(plan, section);
        const d = decideAccess(
          { id: fn, section, cls: "D", requiresAuth: true, trialAllowed: false, paidProvider: true, needsPaidPlan: true, vx: "none", localFallback: false, edge: [fn], limits: "" },
          { signedIn: true, plan, vxBalance: 0 },
          { providerAvailable: true },
        );
        expect(d.allow, `${plan} → ${fn}`).toBe(paying && sectionOpen);
      }
    }
  });

  it("the plan-by-section matrix the tests rely on (free week, expired, Kids, paid) is exactly the one plans.ts declares", () => {
    const row = (plan: string) => ["library", "academy", "arcade", "kids", "assistant", "career", "mediaStudio", "professional", "messages"].filter((s) => planAllows(plan, s as never));
    expect(row("free_trial")).toEqual(["library", "academy", "arcade"]);
    expect(row("none")).toEqual([]);
    expect(row("kids")).toEqual(["library", "academy", "arcade", "kids"]);
    expect(row("basic")).toEqual(["library", "academy", "arcade", "assistant"]);
    expect(row("pro")).toEqual(["library", "academy", "arcade", "kids", "assistant", "career", "messages"]);
    expect(row("business")).toEqual(["library", "academy", "arcade", "kids", "assistant", "career", "mediaStudio", "professional", "messages"]);
  });

  it("an admin is explicit and server-verified: the admin plan is in the entitled set and user_sections answers it from the role, never from a client value", () => {
    expect(isEntitledPlan("admin")).toBe(true);
    const sql = read("supabase/migrations/20261063000000_trial_is_not_full_access.sql");
    expect(sql).toMatch(/IF _plan = 'admin' THEN/);
    expect(sql).toMatch(/has_role\(_user_id, 'admin'\)/);
    // no function reads a plan, a role or a section from the request
    for (const name of Object.keys(AI_FUNCTION_SECTIONS)) {
      expect(dirSource(name), name).not.toMatch(/req\.headers\.get\(["'](x-plan|x-role|x-section|x-subscription)/i);
    }
  });
});

describe("messages in every language", () => {
  const locales = readdirSync("src/i18n").filter((n) => /^[a-z]{2}\.ts$/.test(n));
  const keys = [...new Set(Object.values(ACCESS_MESSAGE_KEYS))];

  it("covers all twenty locales", () => {
    expect(locales).toHaveLength(20);
  });

  for (const file of locales) {
    it(`${file}: has every access message, none left in English`, () => {
      const src = read(`src/i18n/${file}`);
      const en = read("src/i18n/en.ts");
      for (const key of keys) {
        const re = new RegExp(`"${key.replace(/\./g, "\\.")}":\\s*"((?:[^"\\\\]|\\\\.)*)"`);
        const v = re.exec(src)?.[1];
        expect(v, `${file} is missing ${key}`).toBeTruthy();
        if (file !== "en.ts" && key.startsWith("access.")) {
          expect(v, `${file} ${key} is still English`).not.toBe(re.exec(en)?.[1]);
        }
      }
    });
  }
});

describe("the policy does not become a second source of truth", () => {
  it("holds no price, no VX amount and no plan table", () => {
    const src = read("src/lib/access/policy.ts");
    expect(src).not.toMatch(/price_monthly|vx_credits_monthly|\bprice:\s*\d|vxMonthly\s*:/);
    expect(src).toMatch(/from "@\/lib\/billing\/plans"/);
  });

  it("is a pure module: no network, no client, no spy needed", () => {
    const src = read("src/lib/access/policy.ts");
    const code = src.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    expect(code).not.toMatch(/fetch\(|from "@\/integrations|supabase-js|Deno\./);
    expect(vi.isMockFunction(decideAccess)).toBe(false);
  });
});

describe("hasActivePaidPlan", () => {
  const db = (reply: { data: unknown; error: unknown }) => ({ rpc: vi.fn(async () => reply) });

  it("allows only a literal true, asks the AI-entitlement predicate, and fails closed", async () => {
    const { hasActivePaidPlan } = await import("../../supabase/functions/_shared/entitlements");
    const yes = db({ data: true, error: null });
    await expect(hasActivePaidPlan(yes, "u")).resolves.toEqual({ allowed: true });
    expect(yes.rpc).toHaveBeenCalledWith("ai_user_entitled", { _user_id: "u" });
    await expect(hasActivePaidPlan(db({ data: false, error: null }), "u")).resolves.toEqual({ allowed: false });
    await expect(hasActivePaidPlan(db({ data: "true", error: null }), "u")).resolves.toEqual({ allowed: false });
    await expect(hasActivePaidPlan(db({ data: null, error: { code: "x" } }), "u")).resolves.toEqual({ allowed: false, unavailable: true });
  });
});
