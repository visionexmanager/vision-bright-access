// Phase 5 — the guards, and proof they are load-bearing.
//
// A test that asserts a guard passes on good input tells you nothing: it passes
// just as happily when the guard has been deleted. So every guard here is
// checked twice — once that it lets the legitimate case through, and once that
// the bypass it exists to stop is actually refused. Where the guard is a single
// function, there is a third check: the same input run against the *unguarded*
// equivalent, showing the bypass would succeed without it.
//
// Everything drives the real production modules. Nothing here mocks a router.

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { Capability } from "../../supabase/functions/_shared/whatsappCatalog.ts";
import type { EngineContext } from "../../supabase/functions/_shared/whatsappEngine.ts";
import type { SessionState } from "../../supabase/functions/_shared/whatsappSession.ts";

const safety = await import("../../supabase/functions/_shared/whatsappSafety.ts");
const knowledge = await import("../../supabase/functions/_shared/whatsappKnowledge.ts");
const catalog = await import("../../supabase/functions/_shared/whatsappCatalog.ts");
const router = await import("../../supabase/functions/_shared/whatsappRouter.ts");
const engine = await import("../../supabase/functions/_shared/whatsappEngine.ts");
const sessions = await import("../../supabase/functions/_shared/whatsappSession.ts");
const ai = await import("../../supabase/functions/_shared/whatsappAssistant.ts");
const ask = await import("../../supabase/functions/_shared/whatsappAsk.ts");
const profile = await import("../../supabase/functions/_shared/whatsappProfile.ts");
const languages = await import("../../supabase/functions/_shared/whatsappLanguages.ts");
const onboarding = await import("../../supabase/functions/_shared/whatsappOnboarding.ts");
const countries = await import("../../supabase/functions/_shared/whatsappCountries.ts");
const interactive = await import("../../supabase/functions/_shared/whatsappInteractive.ts");

const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");

const ALL: Capability[] = ["ai", "vision", "speech_to_text", "text_to_speech", "location", "bazaar"];
const NOW = Date.parse("2026-08-25T10:00:00Z");
const limits = ai.assistantLimits(() => undefined);

const live = (over: Partial<SessionState> = {}): SessionState => ({
  ...sessions.freshSession(),
  updatedAt: new Date(NOW - 60_000).toISOString(),
  ...over,
});

const context = (over: Partial<EngineContext> = {}): EngineContext => ({
  language: "en",
  nowMs: NOW,
  timeoutMs: 30 * 60_000,
  available: ALL,
  isNewConversation: false,
  ...over,
});

const route = (over: Partial<Parameters<typeof router.resolveSelection>[0]> = {}) =>
  router.resolveSelection({
    menuId: catalog.ROOT_ID,
    text: "",
    language: "en",
    available: ALL,
    ...over,
  });

// ── 1. Failing closed on unverifiable configuration ──────────────────────────

describe("feature configuration fails closed", () => {
  it("runs a feature normally when the configuration was read", () => {
    expect(route({ selection: "services", configVerified: true }).kind).toBe("feature");
  });

  it("refuses every feature when the configuration could not be read", () => {
    const refused = route({ selection: "services", configVerified: false });
    expect(refused.kind).toBe("unavailable");
    expect(refused.kind === "unavailable" && refused.reason).toBe("unverified");
  });

  it("MUTATION: dropping the flag is what lets the feature through", () => {
    // The same call with the guard's input removed. If this ever stops
    // differing from the case above, the flag has stopped being consulted.
    expect(route({ selection: "services" }).kind).toBe("feature");
    expect(route({ selection: "services", configVerified: false }).kind).toBe("unavailable");
  });

  it("refuses a feature reached by every route, not only by tapping", () => {
    for (const input of [
      { selection: "services.weather" },
      { text: "1" },
      { text: "AI Assistant" },
      { text: "weather" },
    ]) {
      const refused = route({ ...input, configVerified: false, menuId: "services" });
      expect(refused.kind === "unavailable" || refused.kind === "invalid" || refused.kind === "passthrough").toBe(true);
      if (refused.kind === "unavailable") expect(refused.reason).toBe("unverified");
    }
  });

  it("still lets somebody navigate and get out", () => {
    const unverified = context({ configVerified: false });
    for (const command of ["0", "00", "help"]) {
      const outcome = engine.runEngine({ text: command, kind: "text" }, live(), unverified);
      expect(outcome.kind).toBe("reply");
    }
    const back = engine.runEngine({ text: "", kind: "interactive", selection: "back" }, live(), unverified);
    expect(back.kind).toBe("reply");
    expect(back.reason).toBe("back_command");
  });

  it("refuses through the engine too, leaving the sender where they were", () => {
    const at = live({ path: ["main"] });
    const outcome = engine.runEngine(
      { text: "", kind: "interactive", selection: "services" },
      at,
      context({ configVerified: false }),
    );
    expect(outcome.kind).toBe("reply");
    expect(outcome.reason).toBe("unverified_config");
    expect(outcome.session.path).toEqual(["main"]);
  });

  it("names the case in the log, and never as a permissive empty list", () => {
    expect(webhook).toContain("verified: false");
    expect(webhook).toContain("features fail closed for this delivery");
  });
});

// ── 2. What a tapped id may be ───────────────────────────────────────────────

describe("interactive ids are validated against the menu", () => {
  it("classifies each interaction's ids as its own", () => {
    expect(safety.selectionScope("back")).toBe("control");
    expect(safety.selectionScope("main_menu")).toBe("control");
    expect(safety.selectionScope("services.weather")).toBe("catalog");
    expect(safety.selectionScope(languages.languageRowId("fr"))).toBe("language");
    expect(safety.selectionScope(languages.languagePageId(2))).toBe("language");
    expect(safety.selectionScope(onboarding.genderRowId("male"))).toBe("profile");
    expect(safety.selectionScope(countries.countryRowId("JO"))).toBe("profile");
  });

  it("keeps its prefix table in step with the modules that issue the ids", () => {
    // Written out in `whatsappSafety.ts` rather than imported, so this is what
    // makes a rename over there a build failure rather than a silent
    // reclassification of a language row as a feature id.
    expect(safety.LANGUAGE_SELECTION_PREFIX).toBe(languages.LANGUAGE_ID_PREFIX);
    expect(safety.PROFILE_SELECTION_PREFIXES).toContain(onboarding.GENDER_ID_PREFIX);
    expect(safety.PROFILE_SELECTION_PREFIXES).toContain(countries.COUNTRY_ID_PREFIX);
    expect(safety.CONTROL_SELECTION_IDS).toContain(interactive.BACK_ID);
    expect(safety.CONTROL_SELECTION_IDS).toContain(interactive.MAIN_MENU_ID);
  });

  it("refuses a language row as a feature", () => {
    const routed = route({ selection: languages.languageRowId("fr") });
    expect(routed.kind).toBe("stale");
  });

  it("refuses a profile row as a feature", () => {
    expect(route({ selection: onboarding.genderRowId("male") }).kind).toBe("stale");
    expect(route({ selection: countries.countryRowId("JO") }).kind).toBe("stale");
  });

  it("refuses the hidden root, which is on no menu", () => {
    expect(route({ selection: catalog.ROOT_ID }).kind).toBe("stale");
  });

  it("MUTATION: the root resolves fine without the offered check", () => {
    // `nodeById` — what the engine used to call directly — happily returns it.
    expect(catalog.nodeById(catalog.ROOT_ID)).not.toBeNull();
    expect(catalog.isOffered(catalog.nodeById(catalog.ROOT_ID))).toBe(false);
  });

  it("only offers rows that fit inside Meta's ten-row ceiling", () => {
    const walk = (nodeId: string) => {
      const offered = catalog.offeredChildrenOf(nodeId, []);
      const controls = catalog.controlRowCount(nodeId);
      expect(offered.length + controls).toBeLessThanOrEqual(catalog.LIST_LIMITS.rows);
      for (const child of offered) if (child.kind === "menu") walk(child.id);
    };
    walk(catalog.ROOT_ID);
  });

  it("executes exactly what the rendered menu offers, and nothing else", () => {
    // The two answers come from the same function, which is the point.
    for (const nodeId of ["main", "assistant", "ocr", "services", "support", "more"]) {
      const message = interactive.menuMessage(nodeId, "en", []);
      const rendered = (message?.interactive.type === "list"
        ? message.interactive.action.sections[0].rows
        : message?.interactive.action.buttons.map((b) => ({ id: b.reply.id })) ?? [])
        .map((r) => r.id)
        .filter((id) => safety.selectionScope(id) === "catalog");
      for (const id of rendered) {
        expect(catalog.isOffered(catalog.nodeById(id)), id).toBe(true);
        // A row the catalog has declared but not built yet stays on the menu
        // and says so when opened — removing Academy would tell the audience
        // waiting for it that it had been cancelled. So the offered set is
        // "reaches the gate", and the gate answers `feature` or a refusal that
        // names why; what it must never answer for a rendered row is `stale`.
        const routed = route({ selection: id, menuId: nodeId });
        expect(["feature", "unavailable"], id).toContain(routed.kind);
        if (routed.kind === "unavailable") {
          expect(catalog.nodeById(id)?.enabled, id).toBe(false);
        }
      }
    }
  });

  it("still refuses a switched-off feature with the right words, not as stale", () => {
    // A flagged-off row is a real row people have seen; it deserves "that
    // service is closed" rather than "that option has moved".
    const refused = route({ selection: "services.weather", disabled: ["services.weather"] });
    expect(refused.kind).toBe("unavailable");
    expect(refused.kind === "unavailable" && refused.reason).toBe("disabled");
  });

  it("refuses a malformed or oversized id safely", () => {
    for (const bad of [
      "   ",
      "a".repeat(safety.MAX_SELECTION_ID_CHARS + 1),
      "services.weather; drop table",
      "services/../../admin",
      "<script>alert(1)</script>",
      "services weather",
      "services" + String.fromCharCode(0) + "weather",
      "الطقس",
    ]) {
      expect(safety.selectionScope(bad), bad.slice(0, 20)).toBe("malformed");
      expect(route({ selection: bad }).kind, bad.slice(0, 20)).toBe("stale");
    }
  });

  it("treats an empty id as no tap at all, not as a broken one", () => {
    // An empty string is what a payload with no interactive part looks like.
    // There is nothing to refuse: the message is read as text, exactly as a
    // typed message is, which is what keeps a caption on a photo working.
    expect(safety.selectionScope("")).toBe("malformed");
    expect(route({ selection: "", text: "hello there" }).kind).toBe("passthrough");
  });

  it("never throws on a hostile id, whatever it is", () => {
    for (const bad of ["__proto__", "constructor", "toString", "..", "%2e%2e"]) {
      expect(() => route({ selection: bad })).not.toThrow();
    }
  });

  it("answers a hostile id through the engine with a menu, not an error", () => {
    const outcome = engine.runEngine(
      { text: "", kind: "interactive", selection: "__proto__" },
      live(),
      context(),
    );
    expect(outcome.kind).toBe("reply");
    expect(outcome.reason).toBe("stale_selection");
  });

  it("keeps Back and Main menu working, since they are the way out", () => {
    expect(route({ selection: "back" })).toEqual({ kind: "command", command: "back" });
    expect(route({ selection: "main_menu" })).toEqual({ kind: "command", command: "home" });
  });
});

// ── 3. One resolver, no second door ──────────────────────────────────────────

describe("there is exactly one place a tap becomes a feature", () => {
  const engineSource = readFileSync("supabase/functions/_shared/whatsappEngine.ts", "utf8");
  const code = engineSource
    .split(String.fromCharCode(10))
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join(String.fromCharCode(10));

  it("routes a tap through the router rather than resolving it again", () => {
    expect(code).toContain("resolveSelection({");
    // The engine used to call `nodeById(message.selection)` itself, which was
    // the second resolver — and the one that skipped every check the router
    // later grew.
    expect(code).not.toContain("nodeById(message.selection)");
  });

  it("puts a tap through the same gate as a number and a word", () => {
    const disabled = ["services.weather"];
    const byTap = route({ selection: "services.weather", disabled, menuId: "services" });
    const byName = route({ text: "weather", disabled, menuId: "services" });
    expect(byTap.kind).toBe("unavailable");
    expect(byName.kind).toBe("unavailable");
  });
});

// ── 4. Provider errors never carry a body ────────────────────────────────────

describe("provider errors are sanitised", () => {
  it("keeps a status and a label, and drops everything else", () => {
    const error = Object.assign(new Error("Bad request: prompt was 'my card is 4111111111111111'"), {
      status: 400,
      body: { prompt: "secret" },
    });
    const safe = safety.sanitiseError(error);
    expect(safe).toEqual({ code: "bad_request", status: 400 });
    expect(JSON.stringify(safe)).not.toContain("4111");
    expect(safety.describeError(error)).toBe("bad_request/400");
  });

  it("names each failure it can actually tell apart", () => {
    expect(safety.sanitiseError({ status: 429 }).code).toBe("rate_limited");
    expect(safety.sanitiseError({ status: 401 }).code).toBe("unauthorized");
    expect(safety.sanitiseError({ status: 403 }).code).toBe("forbidden");
    expect(safety.sanitiseError({ status: 404 }).code).toBe("not_found");
    expect(safety.sanitiseError({ status: 503 }).code).toBe("upstream_error");
    expect(safety.sanitiseError({ code: "PGRST205" }).code).toBe("database_error");
    expect(safety.sanitiseError(Object.assign(new Error("x"), { name: "AbortError" })).code).toBe("aborted");
    expect(safety.sanitiseError(new TypeError("fetch failed")).code).toBe("transport_error");
    expect(safety.sanitiseError("a string").code).toBe("unknown");
    expect(safety.sanitiseError(null).code).toBe("unknown");
    expect(safety.sanitiseError(undefined).code).toBe("unknown");
  });

  it("never returns anything but a known code and a number", () => {
    const hostile = [
      new Error("x".repeat(50_000)),
      { status: "429" },
      { status: Number.NaN },
      { message: { toString() { throw new Error("nope"); } } },
      Object.create(null),
    ];
    for (const error of hostile) {
      const safe = safety.sanitiseError(error);
      expect(typeof safe.code).toBe("string");
      expect(Number.isFinite(safe.status)).toBe(true);
      expect(safety.describeError(error).length).toBeLessThan(40);
    }
  });

  it("MUTATION: the raw message is what would have leaked", () => {
    const error = Object.assign(new Error("prompt echoed: my email is a@b.com"), { status: 400 });
    expect(error.message).toContain("a@b.com");
    expect(safety.describeError(error)).not.toContain("a@b.com");
  });

  it("logs no raw error object anywhere in the webhook", () => {
    expect(webhook).not.toContain("e instanceof Error ? e.message");
    expect(webhook).not.toContain("error.message");
  });

  it("logs no raw error object in ANY shared WhatsApp module", () => {
    // Deliberately the whole directory rather than a list. A hand-written list
    // is a list of the modules somebody remembered, and the one that leaked
    // longest — the vision reader, whose provider error quotes the document it
    // was asked to read — was the one nobody had put on it.
    const modules = readdirSync("supabase/functions/_shared").filter((f) => f.startsWith("whatsapp"));
    expect(modules.length).toBeGreaterThan(10);

    for (const file of modules) {
      const source = readFileSync(`supabase/functions/_shared/${file}`, "utf8");
      const logs = source.split(String.fromCharCode(10)).filter((l) => l.includes("console."));
      for (const line of logs) {
        expect(line, `${file}: ${line.trim()}`).not.toMatch(/\.message\b/);
        expect(line, `${file}: ${line.trim()}`).not.toMatch(/\bJSON\.stringify\(\s*e[,)]/);
      }
    }
  });

  it("logs no raw error object in the webhook either", () => {
    for (const line of webhook.split(String.fromCharCode(10)).filter((l) => l.includes("console."))) {
      expect(line, line.trim()).not.toMatch(/\.message\b/);
    }
  });

  it("carries no provider message out of the ask, only a reason and a status", async () => {
    const outcome = await ask.askAssistant(
      { systemParts: ["s"], question: "q" },
      async () => { throw Object.assign(new Error("leaked prompt text"), { status: 500 }); },
    );
    expect(outcome.status).toBe("failed");
    expect(JSON.stringify(outcome)).not.toContain("leaked prompt text");
  });
});

// ── 5. Prompt injection from the sender ──────────────────────────────────────

describe("hostile input is bounded and stripped", () => {
  // ── Sanitising must not corrupt the message ───────────────────────────────
  //
  // The strip class was briefly wide enough to include the joiners, and the
  // wider version was wrong in a way that mattered to exactly this audience:
  // it silently rewrote Persian and took every ZWJ emoji apart. Nothing caught
  // it — no lone surrogate is produced, so every surrogate assertion passed —
  // until a performance test made it visible for an unrelated reason.
  //
  // A guard that quietly rewrites somebody's language is worse than the thing
  // it was guarding against, so these are here permanently.
  const ZWNJ = String.fromCharCode(0x200c);
  const ZWJ = String.fromCharCode(0x200d);

  it("keeps the zero-width non-joiner that Persian and Urdu need", () => {
    const persian = `می${ZWNJ}روم`; // "I go" — without the ZWNJ it is a different word
    expect(safety.stripInvisible(persian)).toBe(persian);
    expect(knowledge.sanitisePassage(persian)).toBe(persian);
    const checked = ai.checkQuestion(persian, limits);
    expect(checked.ok && checked.question).toBe(persian);
  });

  it("keeps the zero-width joiner that holds an emoji together", () => {
    const family = `👨${ZWJ}👩${ZWJ}👧${ZWJ}👦`;
    const astronaut = `👩🏽${ZWJ}🚀`;
    for (const emoji of [family, astronaut]) {
      expect(safety.stripInvisible(emoji), emoji).toBe(emoji);
      expect(knowledge.sanitisePassage(emoji), emoji).toBe(emoji);
      expect(safety.graphemeLength(emoji), emoji).toBe(1);
    }
  });

  it("keeps the bidirectional marks that mixed Arabic and Latin text uses", () => {
    const mixed = `الطقس ${String.fromCharCode(0x200e)}Visionex${String.fromCharCode(0x200f)} اليوم`;
    expect(safety.stripInvisible(mixed)).toBe(mixed);
  });

  it("still removes the overrides, which are what actually disguise text", () => {
    for (const code of [0x200b, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2069, 0xfeff]) {
      const hidden = `real${String.fromCharCode(code)}text`;
      expect(safety.stripInvisible(hidden), code.toString(16)).toBe("realtext");
      expect(knowledge.sanitisePassage(hidden), code.toString(16)).toBe("realtext");
    }
  });

  it("survives a round trip through every language's own script", () => {
    // A sanitiser that mangles a script is a sanitiser that has broken the
    // channel for whoever writes in it.
    const samples = [
      "مرحبا بك في Visionex",     // Arabic
      `اردو میں${ZWNJ} خوش آمدید`, // Urdu, with a ZWNJ
      "नमस्ते दुनिया",              // Hindi
      "こんにちは世界",              // Japanese
      "안녕하세요",                  // Korean
      "Xin chào thế giới",       // Vietnamese
      "স্বাগতম",                    // Bengali
      `فارسی می${ZWNJ}گویم`,       // Persian, with a ZWNJ
    ];
    for (const text of samples) {
      expect(safety.stripInvisible(text), text).toBe(text);
      expect(safety.boundText(text, 1_000), text).toBe(text);
    }
  });

  it("strips control characters and bidirectional overrides from a question", () => {
    const hidden = `real question${String.fromCharCode(0x202e)}${String.fromCharCode(1)}hidden`;
    const checked = ai.checkQuestion(hidden, limits);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(checked.question).not.toContain(String.fromCharCode(0x202e));
    expect(checked.question).not.toContain(String.fromCharCode(1));
    expect(checked.question).toContain("real question");
  });

  it("keeps the formatting a person meant", () => {
    const checked = ai.checkQuestion("line one\nline two\tindented", limits);
    expect(checked.ok && checked.question).toContain("\n");
    expect(checked.ok && checked.question).toContain("\t");
  });

  it("refuses an oversized question before a provider reads it", () => {
    expect(ai.checkQuestion("x".repeat(limits.maxQuestionChars + 1), limits))
      .toEqual({ ok: false, problem: "too_long" });
  });

  it("refuses an empty or whitespace-only question", () => {
    expect(ai.checkQuestion("", limits).ok).toBe(false);
    expect(ai.checkQuestion("   \n\t  ", limits).ok).toBe(false);
    expect(ai.checkQuestion(null, limits).ok).toBe(false);
    expect(ai.checkQuestion(undefined, limits).ok).toBe(false);
  });

  it("never throws on hostile input, whatever shape it takes", () => {
    for (const hostile of [
      String.fromCharCode(0).repeat(100),
      "\uD800",
      "x".repeat(200_000),
      "﻿".repeat(50),
    ]) {
      expect(() => ai.checkQuestion(hostile, limits)).not.toThrow();
      expect(() => ai.splitAnswer(hostile, limits)).not.toThrow();
    }
  });
});

// ── 6. Every field that reaches a provider is bounded ────────────────────────

describe("prompts, histories and responses are bounded", () => {
  // ── Bounded in time as well as in size ────────────────────────────────────
  //
  // These are not micro-benchmarks. The first version of these helpers
  // segmented the *whole* input to find a boundary near one end of it, and CI
  // spent four hundred and sixty seconds bounding a single 500,000-character
  // string. That is the same code path a long provider response takes in
  // production — so it was not a slow test, it was a webhook that never answers
  // and a message Meta redelivers.
  //
  // The budgets are loose in absolute terms — a shared CI runner is slow and
  // unpredictable — but they are two orders of magnitude below the numbers a
  // linear implementation produces, which is what makes them a real gate. Every
  // one of these completes in single-digit milliseconds when it is correct.
  //
  // A first attempt at the fix bounded the work with a window of `limit ×
  // WIDEST_CHARACTER`, which for a four-thousand ceiling is a quarter of a
  // million characters and barely a bound at all: it still took CI eighty
  // seconds, and this test is what said so. `Intl.Segmenter` iteration is lazy,
  // so the answer was to stop consuming rather than to pre-slice.
  const HUGE = "x".repeat(500_000);
  const HUGE_EMOJI = "👩🏽‍🚀".repeat(50_000);

  const within = (budgetMs: number, label: string, work: () => unknown) => {
    const started = Date.now();
    work();
    const took = Date.now() - started;
    expect(took, `${label} took ${took}ms`).toBeLessThan(budgetMs);
  };

  it("bounds a huge string in time proportional to the ceiling, not the input", () => {
    within(1_000, "boundText", () => safety.boundText(HUGE, 4_000));
    within(1_000, "boundText/emoji", () => safety.boundText(HUGE_EMOJI, 4_000));
    within(1_000, "sliceGraphemes", () => safety.sliceGraphemes(HUGE, 4_000));
    within(1_000, "clampUnits", () => safety.clampUnits(HUGE_EMOJI, 4_000));
    within(1_000, "stripInvisible", () => safety.stripInvisible(HUGE));
    within(1_000, "safeCut", () => safety.safeCut(HUGE_EMOJI, 4_000));
    within(1_000, "graphemeLength", () => safety.graphemeLength(HUGE, 4_000));
  });

  it("assembles a huge prompt without segmenting all of it", () => {
    within(2_000, "boundSystemPrompt", () =>
      ask.buildRequest({
        systemParts: ["rules", HUGE, HUGE_EMOJI],
        summary: HUGE,
        turns: [{ role: "user", content: HUGE }, { role: "assistant", content: HUGE_EMOJI }],
        question: HUGE,
      }));
  });

  it("splits a huge answer without segmenting all of it", () => {
    within(2_000, "splitAnswer", () => ai.splitAnswer(HUGE_EMOJI, limits));
  });

  it("hands the segmenter work proportional to the ceiling, not to the input", () => {
    // ── Why this counts instead of timing ─────────────────────────────────
    //
    // The first version of this test measured wall time against an eager
    // segmenter, and it was vacuous on a fast machine: a deliberately
    // regressed implementation passed it, because segmenting half a million
    // characters takes 68ms here and the budget was two seconds. It would have
    // failed only on CI — which is not a guard, it is a coin toss.
    //
    // What it should have asserted is the invariant itself. `Intl.Segmenter`
    // iterates lazily on Node 24 and eagerly on the Node 20 CI runs, so "stop
    // consuming at the limit" is fast here and took forty seconds there. The
    // implementation must therefore never *hand* the segmenter more than it
    // needs, whatever the engine then does with it — and that is a number this
    // test can read directly.
    const prototype = (Intl as unknown as {
      Segmenter: { prototype: { segment(input: string): Iterable<unknown> } };
    }).Segmenter.prototype;
    const real = prototype.segment;
    let handed = 0;
    prototype.segment = function (input: string) {
      handed += input.length;
      return real.call(this, input);
    };

    const measured = (work: () => unknown): number => {
      handed = 0;
      work();
      return handed;
    };

    try {
      const LIMIT = 4_000;
      // The widest realistic character is about a dozen code units and the
      // window doubles, so a correct implementation hands over at most a few
      // multiples of the ceiling — measured, the worst of these is fourteen
      // times it, and `boundText` is under two hundred units flat because its
      // ceiling is counted in code units and needs no segmentation at all.
      // A linear implementation hands over 500,000.
      const ceiling = LIMIT * 20;

      for (const [label, work] of [
        ["boundText/ascii", () => safety.boundText(HUGE, LIMIT)],
        ["boundText/emoji", () => safety.boundText(HUGE_EMOJI, LIMIT)],
        ["sliceGraphemes", () => safety.sliceGraphemes(HUGE, LIMIT)],
        ["sliceGraphemes/emoji", () => safety.sliceGraphemes(HUGE_EMOJI, LIMIT)],
        ["graphemeLength", () => safety.graphemeLength(HUGE, LIMIT)],
        ["safeCut", () => safety.safeCut(HUGE_EMOJI, LIMIT)],
      ] as Array<[string, () => unknown]>) {
        const units = measured(work);
        expect(units, `${label}` + " handed the segmenter " + units + " code units")
          .toBeLessThan(ceiling);
        // And it must be far below the input, or nothing has been bounded.
        expect(units, label).toBeLessThan(HUGE.length / 4);
      }

      // The whole prompt assembly, which is where the forty seconds actually
      // went: several huge fields, each bounded separately.
      const assembling = measured(() => ask.buildRequest({
        systemParts: ["rules", HUGE, HUGE_EMOJI],
        summary: HUGE,
        turns: [{ role: "user", content: HUGE }, { role: "assistant", content: HUGE_EMOJI }],
        question: HUGE,
      }));
      expect(assembling, "buildRequest handed over " + assembling + " code units")
        .toBeLessThan(safety.MAX_SYSTEM_PROMPT_CHARS * 40);
    } finally {
      prototype.segment = real;
    }
  });

  it("names every ceiling as an exported constant", () => {
    expect(safety.MAX_SYSTEM_PROMPT_CHARS).toBeGreaterThan(0);
    expect(safety.MAX_SUMMARY_CHARS).toBeGreaterThan(0);
    expect(safety.MAX_TURN_CHARS).toBeGreaterThan(0);
    expect(safety.MAX_PROVIDER_RESPONSE_CHARS).toBeGreaterThan(0);
  });

  it("bounds a system prompt however long its parts are", () => {
    const built = ask.buildRequest({
      systemParts: ["rules first", "y".repeat(500_000), "reference material last"],
      question: "q",
    });
    expect(built.system.length).toBeLessThanOrEqual(safety.MAX_SYSTEM_PROMPT_CHARS);
  });

  it("keeps the rules and drops the reference material under pressure", () => {
    const built = ask.buildRequest({
      systemParts: ["THE RULES", "z".repeat(safety.MAX_SYSTEM_PROMPT_CHARS), "REFERENCE"],
      question: "q",
    });
    expect(built.system).toContain("THE RULES");
    expect(built.system).not.toContain("REFERENCE");
  });

  it("bounds the summary", () => {
    const built = ask.buildRequest({
      systemParts: ["s"],
      summary: "m".repeat(500_000),
      question: "q",
    });
    const summaryTurn = built.messages[0].content;
    expect(summaryTurn.length).toBeLessThan(safety.MAX_SUMMARY_CHARS + 500);
  });

  it("bounds every replayed turn", () => {
    const built = ask.buildRequest({
      systemParts: ["s"],
      turns: [
        { role: "user", content: "t".repeat(500_000) },
        { role: "assistant", content: "a".repeat(500_000) },
      ],
      question: "q",
    });
    for (const message of built.messages) {
      expect(message.content.length).toBeLessThanOrEqual(safety.MAX_TURN_CHARS);
    }
  });

  it("bounds what comes back from a provider", async () => {
    const outcome = await ask.askAssistant(
      { systemParts: ["s"], question: "q" },
      async () => ({ text: "r".repeat(500_000), provider: "p", model: "m" }),
    );
    expect(outcome.status).toBe("answered");
    if (outcome.status !== "answered") return;
    expect(outcome.text.length).toBeLessThanOrEqual(safety.MAX_PROVIDER_RESPONSE_CHARS);
  });

  it("MUTATION: an unbounded response is what would have reached the splitter", () => {
    expect("r".repeat(500_000).length).toBeGreaterThan(safety.MAX_PROVIDER_RESPONSE_CHARS);
  });

  it("strips control characters from every field on the way out", () => {
    const dirty = `clean${String.fromCharCode(0)}${String.fromCharCode(0x202e)}`;
    const built = ask.buildRequest({ systemParts: [dirty], question: dirty });
    expect(built.system).not.toContain(String.fromCharCode(0));
    expect(built.system).not.toContain(String.fromCharCode(0x202e));
  });
});

// ── 7. Splitting never cuts a character in half ──────────────────────────────

describe("Unicode graphemes survive being split", () => {
  const EMOJI = "👩🏽‍🚀";               // person + skin tone + ZWJ + rocket
  const FAMILY = "👨‍👩‍👧‍👦";
  const ARABIC = "بَيْتٌ";              // letters with vowel marks
  const FLAG = "🇯🇴";

  it("counts what a reader would count", () => {
    expect(safety.graphemeLength(EMOJI)).toBe(1);
    expect(safety.graphemeLength(FAMILY)).toBe(1);
    expect(safety.graphemeLength(FLAG)).toBe(1);
    expect(EMOJI.length).toBeGreaterThan(1); // and UTF-16 does not
  });

  it("never produces a lone surrogate when slicing", () => {
    const text = EMOJI.repeat(200);
    for (let limit = 1; limit < 60; limit++) {
      const cut = safety.sliceGraphemes(text, limit);
      expect(cut).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
      expect(cut).not.toMatch(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
    }
  });

  it("splits a long emoji answer into whole characters", () => {
    const answer = `${EMOJI} `.repeat(4_000);
    for (const part of ai.splitAnswer(answer, limits)) {
      expect(part).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
      expect(part).not.toMatch(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
      expect(part.length).toBeLessThanOrEqual(limits.maxMessageChars);
    }
  });

  it("splits a long Arabic answer without orphaning a vowel mark", () => {
    const answer = `${ARABIC} `.repeat(3_000);
    for (const part of ai.splitAnswer(answer, limits)) {
      // A part must never open with a combining mark: that mark belonged to a
      // letter that stayed in the previous message.
      expect(part.charCodeAt(0)).not.toBeGreaterThanOrEqual(0x064b);
      expect(part.length).toBeLessThanOrEqual(limits.maxMessageChars);
    }
  });

  it("splits a family emoji without breaking the joiners", () => {
    const answer = FAMILY.repeat(2_000);
    const parts = ai.splitAnswer(answer, limits);
    for (const part of parts) {
      expect(part).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
      // No part ends on a zero-width joiner with nothing after it.
      expect(part.endsWith(String.fromCharCode(0x200d))).toBe(false);
    }
  });

  it("clamps a reply without cutting a character in half", () => {
    const clamped = ask.buildRequest({ systemParts: [EMOJI.repeat(100_000)], question: "q" }).system;
    expect(clamped).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });

  it("agrees exactly with the definition, at every index of every nasty string", () => {
    // `safeCut` is fast because it segments a window rather than the whole
    // string, and a window cannot see everything: a flag is two regional
    // indicators that pair from the *start* of a run, so a window opening one
    // indicator late reads two flags as four letters and offers a cut down the
    // middle of one. That produces no lone surrogate, so every surrogate check
    // passes — this property check against the exact definition is what caught
    // it, and is why it is here rather than a spot assertion.
    // Reached through a cast for the same reason the production module does it:
    // this project's `lib` is ES2021 and `Intl.Segmenter` is ES2022.
    const Segmenter = (Intl as unknown as {
      Segmenter: new (locale?: string, options?: unknown) => {
        segment(input: string): Iterable<{ segment: string }>;
      };
    }).Segmenter;
    const segmenter = new Segmenter(undefined, { granularity: "grapheme" });
    const definition = (text: string, index: number): number => {
      if (index <= 0) return 0;
      if (index >= text.length) return text.length;
      let at = 0;
      let best = 0;
      for (const { segment } of segmenter.segment(text)) {
        if (at > index) break;
        best = at;
        if (at === index) return at;
        at += segment.length;
      }
      return best;
    };

    const nasty = [
      "plain ascii text here",
      EMOJI.repeat(30),
      FAMILY.repeat(20),
      `${ARABIC} `.repeat(30),
      `${FLAG}🇺🇸🇬🇧`.repeat(20),
      `a${EMOJI}b${FAMILY}c`.repeat(15),
      "ȩ́".repeat(40),
      `${"x".repeat(300)}${EMOJI}${"y".repeat(300)}`,
    ];

    for (const text of nasty) {
      for (let i = 0; i <= text.length; i++) {
        expect(safety.safeCut(text, i), `${text.slice(0, 12)}… @${i}`).toBe(definition(text, i));
      }
    }
  });

  it("MUTATION: a plain slice at the same index does break one", () => {
    const text = EMOJI.repeat(50);
    const BROKEN = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
    // One UTF-16 unit into a surrogate pair: the half a naive cut leaves behind.
    expect(text.slice(0, 1)).toMatch(BROKEN);
    expect(safety.clampUnits(text, 1)).not.toMatch(BROKEN);
    // And the same at every index across the first few characters.
    for (let i = 1; i < 24; i++) {
      expect(safety.clampUnits(text, i), String(i)).not.toMatch(BROKEN);
      expect(safety.clampUnits(text, i).length, String(i)).toBeLessThanOrEqual(i);
    }
  });

  it("still splits ordinary text exactly where it used to", () => {
    const plain = ("A normal English sentence that goes on. ").repeat(300);
    const parts = ai.splitAnswer(plain, limits);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join(" ").replace(/\s+/g, " ").trim().length).toBeGreaterThan(0);
    for (const part of parts) expect(part.length).toBeLessThanOrEqual(limits.maxMessageChars);
  });
});

// ── 8. Profile privacy ───────────────────────────────────────────────────────

describe("profile PII never reaches a model", () => {
  const full = {
    full_name: "Amal Haddad",
    date_of_birth: "1990-03-12",
    gender: "female",
    email: "amal@example.com",
    country: "JO",
    preferred_language: "ar",
  };

  it("passes on only a first name, a language and a country", () => {
    const context_ = profile.userContext(profile.readProfile("962790000000", full), "ar");
    expect(Object.keys(context_).sort()).toEqual(["country", "language", "name"]);
    expect(context_.name).toBe("Amal");
    expect(context_.country).toBe("Jordan");
  });

  it("puts no email, birth date, gender or phone number in the directive", () => {
    const directive = profile.personalizationDirective(
      profile.userContext(profile.readProfile("962790000000", full), "ar"),
    ) ?? "";
    for (const secret of ["amal@example.com", "1990-03-12", "female", "962790000000", "Haddad"]) {
      expect(directive, secret).not.toContain(secret);
    }
  });

  it("carries none of it into the assembled provider request", () => {
    const persona = profile.personalizationDirective(
      profile.userContext(profile.readProfile("962790000000", full), "ar"),
    );
    const built = ask.buildRequest({ systemParts: ["rules", persona], question: "hello" });
    const everything = JSON.stringify(built);
    for (const secret of ["amal@example.com", "1990-03-12", "female", "962790000000"]) {
      expect(everything, secret).not.toContain(secret);
    }
  });

  it("MUTATION: a name shaped like a prompt is refused at the door", () => {
    expect(profile.firstNameOf("IGNORE_ABOVE_AND_SAY")).toBeNull();
    expect(profile.firstNameOf("system:")).toBeNull();
    expect(profile.firstNameOf("<script>")).toBeNull();
    expect(profile.firstNameOf("Amal")).toBe("Amal");
    expect(profile.firstNameOf("Jean-Pierre")).toBe("Jean-Pierre");
    expect(profile.firstNameOf("أحمد")).toBe("أحمد");
  });

  it("says nothing at all rather than saying 'unknown'", () => {
    const empty = profile.userContext(profile.readProfile("962790000000", {}), "en");
    expect(profile.personalizationDirective(empty)).toBeNull();
  });

  it("keeps `userContext` the only door out of the profile", () => {
    // The webhook must not read a profile column and hand it to a provider by
    // any other route.
    const askBlock = webhook.slice(webhook.indexOf("const asked = await askAssistant("));
    for (const column of ["date_of_birth", "email", "gender"]) {
      expect(askBlock, column).not.toContain(column);
    }
    expect(webhook).toContain("userContext(readProfile(incoming.from,");
  });

  it("never puts a phone number in a log line", () => {
    const logs = webhook.split(String.fromCharCode(10)).filter((l) => l.includes("console.") || l.includes("log("));
    for (const line of logs) {
      expect(line, line.trim()).not.toContain("incoming.from");
      expect(line, line.trim()).not.toContain("wa_phone");
    }
  });
});
