// The experience contract: what a sender is told, everywhere, every time.
//
// Where they are, what they can do, how to go back, how to get home, how to
// stop, what is running, and what happened when it finished. These are the
// tests for the parts that are the same in every feature — the footer, the
// refusals, the lifecycle — plus the invariants that stop the next feature
// quietly inventing its own.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { Capability } from "../../supabase/functions/_shared/whatsappCatalog.ts";
import type { EngineContext } from "../../supabase/functions/_shared/whatsappEngine.ts";
import type { SessionState } from "../../supabase/functions/_shared/whatsappSession.ts";
import type { Lifecycle } from "../../supabase/functions/_shared/whatsappLifecycle.ts";

const catalog = await import("../../supabase/functions/_shared/whatsappCatalog.ts");
const engine = await import("../../supabase/functions/_shared/whatsappEngine.ts");
const router = await import("../../supabase/functions/_shared/whatsappRouter.ts");
const sessions = await import("../../supabase/functions/_shared/whatsappSession.ts");
const strings = await import("../../supabase/functions/_shared/whatsappStrings.ts");
const lifecycle = await import("../../supabase/functions/_shared/whatsappLifecycle.ts");
const ai = await import("../../supabase/functions/_shared/whatsappAssistant.ts");

const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");

const ALL: Capability[] = ["ai", "vision", "speech_to_text", "text_to_speech", "location", "bazaar"];
const NOW = Date.parse("2026-08-24T10:00:00Z");

const context = (over: Partial<EngineContext> = {}): EngineContext => ({
  language: "en",
  nowMs: NOW,
  timeoutMs: 30 * 60_000,
  available: ALL,
  isNewConversation: false,
  ...over,
});

const live = (over: Partial<SessionState> = {}): SessionState => ({
  ...sessions.freshSession(),
  updatedAt: new Date(NOW - 60_000).toISOString(),
  ...over,
});

const send = (text: string, state = live(), over: Partial<EngineContext> = {}) =>
  engine.runEngine({ text, kind: "text" }, state, context(over));

const noteOf = (outcome: ReturnType<typeof send>): string | undefined =>
  outcome.kind === "reply"
    ? (outcome.replies.find((r) => r.type === "menu") as { note?: string } | undefined)?.note
    : undefined;

// ── 1–3: the footer ─────────────────────────────────────────────────────────

describe("the way out of a menu", () => {
  // The footer used to teach a keypad — "0 Back · 00 Main menu · # Cancel" —
  // under every menu, every time, which a screen reader then read out at the
  // end of every menu. The exits are rows on the message now, so what is left
  // is one line telling somebody whose client refused the interactive version
  // what to reply with.

  it("1. names every exit that exists, and only where it exists", () => {
    for (const language of ["ar", "en", "fr"] as const) {
      const main = engine.renderMenu(catalog.ROOT_ID, language);
      const submenu = engine.renderMenu("services", language);
      const back = strings.say("back", language);
      const home = strings.say("mainMenu", language);

      // The main menu has nowhere to go back to, so it offers neither.
      expect(main, language).not.toContain(`• ${back}`);
      expect(main, language).not.toContain(`• ${home}`);

      // One level down, Back and Main menu are the same place: offering both
      // would be two rows that do the same thing, read aloud, every time.
      expect(submenu, language).toContain(`• ${back}`);
      expect(submenu, language).not.toContain(`• ${home}`);

      // Deeper than that they differ, and both are named, Back first.
      const deep = engine.renderMenu("assistant", language);
      expect(deep, language).toContain(`• ${back}`);
    }
  });

  it("2. reads in Arabic for an Arabic session", () => {
    expect(strings.say("back", "ar")).toBe("رجوع");
    expect(strings.say("mainMenu", "ar")).toBe("القائمة الرئيسية");
    const footer = strings.footerFor(false, "ar");
    expect(footer).toContain("رجوع");
    expect(footer).not.toMatch(/[A-Za-z]{3,}/);
  });

  it("3. reads in English for an English session, and teaches no keypad", () => {
    const footer = strings.footerFor(false, "en");
    expect(footer).toMatch(/back/i);
    expect(footer).toMatch(/name/i);
    expect(footer).not.toMatch(/(^|\s)0{1,2}(\s|$)/);
    expect(footer).not.toContain("#");
  });

  it("3b. is the same closing line everywhere, not one per feature", () => {
    const menus = catalog.CATALOG.filter((node) => node.kind === "menu" && node.id !== catalog.ROOT_ID);
    expect(menus.length).toBeGreaterThan(2);
    const footers = new Set(menus.map((node) => engine.renderMenu(node.id, "en").split("\n").at(-1)));
    expect(footers.size).toBe(1);
  });
});

// ── 4–10: navigation ────────────────────────────────────────────────────────

describe("navigation, everywhere the same", () => {
  it("4. answers an invalid number with the same menu and a plain sentence", () => {
    const outcome = send("9", live({ path: ["main", "support"] }));
    expect(outcome.reason).toBe("invalid_selection");
    expect(noteOf(outcome)).toBe(strings.say("invalidChoice", "en"));
    expect(outcome.session.path).toEqual(["main", "support"]);
  });

  it("5. treats an out-of-range number the same way, without a reset", () => {
    for (const text of ["99", "٩٩", "50"]) {
      const outcome = send(text, live({ path: ["main", "services"], context: { keep: 1 } }));
      expect(outcome.reason, text).toBe("invalid_selection");
      expect(outcome.session.path, text).toEqual(["main", "services"]);
      expect(outcome.session.context, text).toEqual({ keep: 1 });
    }
  });

  it("6. goes back one level with 0, from a menu and from inside a feature", () => {
    const fromMenu = send("0", live({ path: ["main", "services"] }));
    expect(fromMenu.session.path).toEqual(["main"]);

    const fromFeature = send("0", live({
      path: ["main", "assistant", "assistant.ask"],
      feature: "assistant.ask",
      step: ai.AI_TEXT_INPUT,
    }));
    expect(fromFeature.session.path).toEqual(["main", "assistant"]);
    expect(fromFeature.session.feature).toBeNull();
    expect(fromFeature.session.step).toBeNull();
  });

  it("7. goes home with 00 from every depth", () => {
    for (const path of [["main"], ["main", "services"], ["main", "assistant", "assistant.ask"]]) {
      const outcome = send("00", live({ path, feature: path.at(-1)! }));
      expect(outcome.session.path, path.join("/")).toEqual(["main"]);
    }
  });

  it("8. stops the running thing with #, and says so", () => {
    const busy = live({
      path: ["main", "assistant", "assistant.ask"],
      feature: "assistant.ask",
      step: ai.AI_PROCESSING,
      pending: { operation: ai.AI_TEXT_INPUT, startedAt: new Date(NOW - 2_000).toISOString() },
    });
    const outcome = send("#", busy);
    expect(outcome.reason).toBe("cancel_command");
    expect(noteOf(outcome)).toBe(strings.say("cancelled", "en"));
    expect(outcome.session.pending).toBeNull();
    expect(outcome.session.step).toBeNull();
  });

  it("9. walks main → AI → Ask AI → back → AI → back → main", () => {
    let session = live();
    session = send("1", session).session;
    expect(session.path).toEqual(["main", "assistant"]);
    session = send("1", session).session;
    expect(session.feature).toBe("assistant.ask");
    session = send("0", session).session;
    expect(session.path).toEqual(["main", "assistant"]);
    session = send("0", session).session;
    expect(session.path).toEqual(["main"]);
  });

  it("9b. walks main → Services → Weather → back → Services → back → main", () => {
    let session = live();
    session = send("8", session).session;
    expect(session.path).toEqual(["main", "services"]);
    const weather = send("1", session);
    expect(weather.kind).toBe("delegate");
    session = weather.session;
    expect(session.feature).toBe("services.weather");
    session = send("0", session).session;
    expect(session.path).toEqual(["main", "services"]);
    session = send("0", session).session;
    expect(session.path).toEqual(["main"]);
  });

  it("10. keeps answering 0 at the main menu instead of erroring", () => {
    let session = live();
    for (let i = 0; i < 3; i++) {
      const outcome = send("0", session);
      session = outcome.session;
      expect(session.path).toEqual(["main"]);
      expect(noteOf(outcome)).toBe(strings.say("atMainMenu", "en"));
    }
    // And repeated 00 is equally uneventful.
    for (let i = 0; i < 3; i++) session = send("00", session).session;
    expect(session.path).toEqual(["main"]);
  });

  it("10b. never reads a navigation command as feature input", () => {
    const inAsk = live({
      path: ["main", "assistant", "assistant.ask"],
      feature: "assistant.ask",
      step: ai.AI_TEXT_INPUT,
    });
    for (const text of ["0", "00", "#", "menu", "help", "رجوع", "قائمة", "إلغاء", "مساعدة", "٠٠"]) {
      const outcome = send(text, inAsk);
      expect(outcome.kind, text).toBe("reply");
      expect(outcome.reason, text).not.toBe("inside_feature");
    }
  });
});

// ── 11: stale sessions ──────────────────────────────────────────────────────

describe("a session nobody has touched for a while", () => {
  const stale = (over: Partial<SessionState> = {}) => live({
    updatedAt: new Date(NOW - 120 * 60_000).toISOString(),
    ...over,
  });

  it("11. starts the next message at the main menu, keeping nothing but preferences", () => {
    for (const where of [
      { path: ["main", "services"] },
      { path: ["main", "assistant", "assistant.ask"], feature: "assistant.ask", step: ai.AI_TEXT_INPUT },
      { path: ["main", "assistant", "assistant.voice"], feature: "assistant.voice", step: ai.AI_VOICE_INPUT },
      { path: ["main", "assistant", "assistant.ask"], feature: "assistant.ask", step: ai.AI_PROCESSING },
    ]) {
      const outcome = send("hello?", stale(where));
      expect(outcome.reason, JSON.stringify(where)).toBe("timeout_reset");
      expect(outcome.session.path).toEqual(["main"]);
      expect(outcome.session.feature).toBeNull();
      expect(noteOf(outcome)).toBe(strings.say("timedOut", "en"));
    }
    // Language lives outside the session entirely, so it cannot be lost here.
    expect(Object.keys(sessions.sessionColumns(live(), "now"))).not.toContain("preferred_language");
  });

  it("11b. does not execute the old action a stale session was pointing at", () => {
    const outcome = send("1", stale({ path: ["main", "services"] }));
    expect(outcome.kind).toBe("reply");
    expect(outcome.reason).toBe("timeout_reset");
    expect(outcome.session.feature).toBeNull();
  });
});

// ── 12–16: feature flags ────────────────────────────────────────────────────

describe("a feature that is switched off", () => {
  it("12. cannot be entered by number", () => {
    const outcome = send("8", live(), { disabled: ["services"] });
    expect(outcome.reason).toBe("disabled_feature");
    expect(outcome.session.feature).toBeNull();
    expect(noteOf(outcome)).toBe(strings.say("disabled", "en"));
  });

  it("13. cannot be entered by alias, in either language", () => {
    for (const [text, language] of [["weather", "en"], ["الطقس", "ar"]] as const) {
      const outcome = send(text, live(), { disabled: ["services.weather"], language });
      expect(outcome.reason, text).toBe("disabled_feature");
    }
  });

  it("14. takes its children with it", () => {
    // Reached from outside, by tapping the child directly: standing *inside* a
    // disabled parent is a different case, and case 16 covers it.
    const outcome = engine.runEngine(
      { text: "", kind: "interactive", selection: "services.weather" },
      live(),
      context({ disabled: ["services"] }),
    );
    expect(outcome.reason).toBe("disabled_feature");
    expect(catalog.isAvailable(catalog.nodeById("services.weather"), ["services"])).toBe(false);
  });
  it("15. can be switched off on its own without touching its siblings", () => {
    const off = ["services.weather"];
    expect(catalog.isAvailable(catalog.nodeById("services.weather"), off)).toBe(false);
    expect(catalog.isAvailable(catalog.nodeById("services.nearby"), off)).toBe(true);
    const sibling = send("3", live({ path: ["main", "services"] }), { disabled: off });
    expect(sibling.kind).toBe("delegate");
  });

  it("16. moves somebody standing inside it to the nearest place that still exists", () => {
    const inside = live({
      path: ["main", "services", "services.weather"],
      feature: "services.weather",
      step: "awaiting_place",
    });
    const outcome = send("Amman", inside, { disabled: ["services.weather"] });
    expect(outcome.reason).toBe("feature_withdrawn");
    expect(outcome.session.path).toEqual(["main", "services"]);
    expect(outcome.session.feature).toBeNull();
    expect(noteOf(outcome)).toBe(strings.say("withdrawn", "en"));

    // And when the whole branch is gone, they land at the main menu.
    const wholeBranch = send("Amman", inside, { disabled: ["services"] });
    expect(wholeBranch.session.path).toEqual(["main"]);
  });

  it("16b. does not execute the disabled feature on the way out", () => {
    const inside = live({
      path: ["main", "services", "services.weather"],
      feature: "services.weather",
    });
    const outcome = send("Amman", inside, { disabled: ["services.weather"] });
    expect(outcome.kind).toBe("reply");
    expect(outcome.kind === "reply" && outcome.replies.every((r) => r.type === "menu")).toBe(true);
  });
});

// ── 17–21: the lifecycle ────────────────────────────────────────────────────

describe("the shared lifecycle", () => {
  it("17. names every phase once, and knows which ones are finished", () => {
    expect(lifecycle.LIFECYCLE_PHASES).toEqual([
      "idle", "input", "processing", "success", "empty", "error", "cancelled",
    ]);
    for (const phase of ["success", "empty", "error", "cancelled"] as Lifecycle[]) {
      expect(lifecycle.isTerminal(phase), phase).toBe(true);
    }
    for (const phase of ["idle", "input", "processing"] as Lifecycle[]) {
      expect(lifecycle.isTerminal(phase), phase).toBe(false);
    }
  });

  it("18. reads each feature's own step names into the shared vocabulary", () => {
    expect(lifecycle.lifecycleOf(ai.AI_PROCESSING)).toBe("processing");
    expect(lifecycle.lifecycleOf(ai.AI_TEXT_INPUT)).toBe("input");
    expect(lifecycle.lifecycleOf(ai.AI_VOICE_INPUT)).toBe("input");
    expect(lifecycle.lifecycleOf(ai.AI_CONVERSATION)).toBe("success");
    expect(lifecycle.lifecycleOf(ai.AI_MENU)).toBe("idle");
    expect(lifecycle.lifecycleOf(null)).toBe("idle");
    // A step a future feature invents counts as waiting, which is the safe read.
    expect(lifecycle.lifecycleOf("ocr_awaiting_page")).toBe("input");
  });

  it("19. has a sentence for every phase that needs one, in both languages", () => {
    for (const language of ["ar", "en"] as const) {
      for (const phase of ["processing", "empty", "error", "cancelled"] as Lifecycle[]) {
        const notice = lifecycle.lifecycleNotice(phase, language);
        expect(notice, `${phase} ${language}`).toBeTruthy();
        expect(notice!.length, `${phase} ${language}`).toBeGreaterThan(10);
      }
      // Success says nothing: the answer is the message.
      expect(lifecycle.lifecycleNotice("success", language)).toBeNull();
      expect(lifecycle.lifecycleNotice("idle", language)).toBeNull();
    }
    expect(lifecycle.lifecycleNotice("processing", "ar")).toContain("عم عالج");
    expect(lifecycle.lifecycleNotice("processing", "en")).toMatch(/processing/i);
  });

  it("20. treats work that says it is still running, long after it could be, as stuck", () => {
    const started = new Date(NOW - 10 * 60_000).toISOString();
    expect(lifecycle.isStuck("processing", started, NOW)).toBe(true);
    expect(lifecycle.isStuck("processing", new Date(NOW - 5_000).toISOString(), NOW)).toBe(false);
    // A missing or unreadable timestamp is stuck: it cannot be shown to be live.
    expect(lifecycle.isStuck("processing", null, NOW)).toBe(true);
    expect(lifecycle.isStuck("processing", "not a date", NOW)).toBe(true);
    // Only processing can be stuck; waiting for a person is not a fault.
    expect(lifecycle.isStuck("input", started, NOW)).toBe(false);
  });

  it("20b. clears a stuck state on the next message rather than stranding anyone", () => {
    const stranded = live({
      path: ["main", "assistant", "assistant.ask"],
      feature: "assistant.ask",
      step: ai.AI_PROCESSING,
      pending: { operation: ai.AI_PROCESSING, startedAt: new Date(NOW - 30 * 60_000).toISOString() },
    });
    const outcome = send("are you there?", stranded);
    expect(outcome.session.step).not.toBe(ai.AI_PROCESSING);
    expect(outcome.session.pending).toBeNull();
    // Still in the feature: cleaning up the state is not the same as leaving.
    expect(outcome.session.feature).toBe("assistant.ask");
    expect(outcome.kind).toBe("delegate");
  });

  it("21. leaves an interactive feature in place and hands a one-shot back", () => {
    expect(lifecycle.restingPlace("success", { interactive: true })).toBe("stay");
    expect(lifecycle.restingPlace("success", { interactive: false })).toBe("parent_menu");
    expect(lifecycle.restingPlace("empty", { interactive: true })).toBe("stay");
    // A cancellation always goes back to somewhere they can choose again.
    expect(lifecycle.restingPlace("cancelled", { interactive: true })).toBe("parent_menu");
    // Nothing is finished, so nothing moves.
    expect(lifecycle.restingPlace("processing", { interactive: false })).toBe("stay");
  });

  it("21b. announces work only when it is likely to be slow", () => {
    expect(lifecycle.shouldAnnounce(500, 120)).toBe(true);
    expect(lifecycle.shouldAnnounce(10, 120)).toBe(false);
    expect(lifecycle.shouldAnnounce(9_999, 0)).toBe(false);
  });
});

// ── 22–25: reading, digits, language, secrecy ───────────────────────────────

describe("what a screen reader hears", () => {
  it("22. puts the meaning in the label, on every line of every menu", () => {
    // The number used to come first, because the number was what the sender
    // had to send back. Nothing is sent back now — the row is tapped — so the
    // label has to be the whole of what a screen reader announces.
    for (const node of catalog.CATALOG) {
      if (node.kind !== "menu") continue;
      for (const language of ["ar", "en", "tr", "ko"] as const) {
        const lines = engine.renderMenu(node.id, language).split("\n").filter((l) => l.startsWith("• "));
        // Every child, plus however many exits this depth has.
        expect(lines.length, `${node.id} ${language}`)
          .toBeGreaterThanOrEqual(catalog.childrenOf(node.id).length);
        for (const line of lines) {
          // A word, never a digit and never an emoji standing in for the label.
          const withoutEmoji = line.replace(/\p{Extended_Pictographic}️?/gu, "").trim();
          expect(withoutEmoji, line).toMatch(/^•\s+\p{L}/u);
          expect(withoutEmoji, line).not.toMatch(/^•\s+\d/);
        }
      }
    }
  });

  it("23. accepts Arabic-Indic and Persian digits as the same numbers", () => {
    expect(send("٣", live()).session.path).toEqual(["main", "ocr"]);
    expect(send("۳", live()).session.path).toEqual(["main", "ocr"]);
    expect(send("٠٠", live({ path: ["main", "ocr"] })).session.path).toEqual(["main"]);
    expect(router.normaliseAlias("٣")).toBe("3");
  });

  it("24. keeps the session's language whatever the menu is", () => {
    const arabic = engine.renderMenu("services", "ar");
    const english = engine.renderMenu("services", "en");
    expect(arabic).not.toBe(english);
    expect(arabic.replace(/Visionex|PDF/g, "")).not.toMatch(/[A-Za-z]{4,}/);
    // Navigating does not change which language was asked for.
    const outcome = engine.runEngine({ text: "1", kind: "text" }, live(), context({ language: "ar" }));
    expect(outcome.session.path).toEqual(["main", "assistant"]);
  });

  it("25. never puts anything technical in front of a sender", () => {
    for (const key of Object.keys(strings.UI_STRINGS) as Array<keyof typeof strings.UI_STRINGS>) {
      for (const language of ["ar", "en"] as const) {
        const value = strings.UI_STRINGS[key][language];
        expect(value.trim(), `${key}.${language}`).not.toBe("");
        expect(value, `${key}.${language}`).not.toMatch(
          /openai|mistral|gemini|groq|supabase|postgres|api[_ ]?key|token|stack|undefined|null|\b5\d\d\b/i,
        );
      }
      // Both languages, always, and never the same sentence twice — unless
      // there is no sentence. A few entries are pure layout: `nearbyLine` is
      // `• {name} ({category}) — {distance} {direction}` and contains no word
      // to translate, so identical Arabic and English is the correct answer
      // rather than a missing translation. Anything with a letter in it once
      // the placeholders are removed still has to differ.
      const words = (value: string) => value.replace(/\{[a-z]+\}/gi, "").replace(/[^\p{L}]/gu, "");
      if (words(strings.UI_STRINGS[key].en).length > 0) {
        expect(strings.UI_STRINGS[key].ar, key).not.toBe(strings.UI_STRINGS[key].en);
      }
    }
  });
});

// ── 26–30: the architecture holds ───────────────────────────────────────────

describe("nothing regressed and nothing was duplicated", () => {
  it("26. keeps provider logic out of the router and the strings", () => {
    for (const file of ["whatsappRouter.ts", "whatsappStrings.ts", "whatsappLifecycle.ts"]) {
      const source = readFileSync(`supabase/functions/_shared/${file}`, "utf8")
        .split("\n")
        .filter((line) => {
          const t = line.trim();
          return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
        })
        .join("\n");
      for (const forbidden of ["openai", "mistral", "fetch(", "Deno.env", "createClient", "transcribe"]) {
        expect(source.toLowerCase(), `${file}: ${forbidden}`).not.toContain(forbidden.toLowerCase());
      }
    }
  });

  it("27. has one resolver and one set of words", () => {
    const engineSource = readFileSync("supabase/functions/_shared/whatsappEngine.ts", "utf8");
    expect(engineSource).toContain("resolveSelection({");
    expect(engineSource).toContain("export const ENGINE_STRINGS = UI_STRINGS;");
    // The footer is not written out a second time anywhere.
    expect(engineSource).toContain('return menuMessage(nodeId, language, disabled)?.text ?? "";');
    expect(engineSource).not.toContain("footerFor(nodeId === ROOT_ID, language)");
    expect(webhook).not.toContain("Reply with a number");
    expect(webhook).not.toContain("0 Back");
  });

  it("28. leaves every AI state exactly where it was", () => {
    expect(ai.AI_STATES).toEqual([
      "ai_menu", "ai_text_input", "ai_voice_input", "ai_processing",
      "ai_conversation", "ai_new_conversation",
    ]);
    expect(webhook).toContain("session = { ...session, step: AI_PROCESSING };");
    expect(webhook).toContain("step: assistantOwnsInput(session.feature) ? AI_CONVERSATION : null");
  });

  it("29. leaves the voice pipeline alone", () => {
    expect(webhook.match(/voiceToText\(/g)?.length).toBe(1);
    expect(webhook.match(/askAssistant\(/g)?.length).toBe(1);
    expect(webhook).toContain("transcribe: (input) => transcribeVoice({ ...input, trace: correlationId }),");
  });

  it("30. leaves every existing feature reachable", () => {
    for (const surface of [
      "hub.verify_token", "x-hub-signature-256", "dupe.code", "rateLimitDecision(",
      "parseWeatherRequest(", "parseVisionMode(", "asksWhereAmI(", "asksWhatIsNearby(",
      "parseBazaarRequest(", "quickCategory(", "shouldEscalate(", "understandImage(",
      "understandDocument(", "understandVideo(", "handleOwnerCommand(",
    ]) {
      expect(webhook, surface).toContain(surface);
    }
    // And an ordinary question still reaches the assistant untouched.
    expect(send("how much is a subscription?", live()).kind).toBe("passthrough");
  });
});

describe("invariants the next feature must not break", () => {
  it("gives every visible node a stable id, unique, with no position in it", () => {
    const ids = catalog.CATALOG.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id, id).toMatch(/^[a-z][a-z_.]*$/);
  });

  it("numbers each menu once, from one, with no gaps", () => {
    for (const node of catalog.CATALOG) {
      if (node.kind !== "menu") continue;
      const numbers = catalog.childrenOf(node.id).map((c) => catalog.numberOf(c));
      expect(new Set(numbers).size, node.id).toBe(numbers.length);
      expect(numbers, node.id).toEqual(numbers.map((_, i) => i + 1));
    }
  });

  it("points every parent reference at something that exists", () => {
    for (const node of catalog.CATALOG) {
      if (node.id === catalog.ROOT_ID) continue;
      expect(catalog.nodeById(node.parent), node.id).not.toBeNull();
    }
  });

  it("gives every alias to exactly one feature", () => {
    const owners = new Map<string, string>();
    for (const node of catalog.CATALOG) {
      for (const language of ["ar", "en"] as const) {
        for (const alias of catalog.aliasesOf(node, language)) {
          const key = `${language}:${router.normaliseAlias(alias)}`;
          expect(owners.get(key) ?? node.id, `"${alias}"`).toBe(node.id);
          owners.set(key, node.id);
        }
      }
    }
  });

  it("never builds a navigation stack that is not a real path", () => {
    // Every reachable node, entered from scratch, must produce a contiguous
    // root-first path — and one that survives a round trip through the columns.
    for (const node of catalog.CATALOG) {
      if (node.hidden) continue;
      const entered = sessions.enter(live(), node.id);
      expect(entered.path[0], node.id).toBe(catalog.ROOT_ID);
      for (let i = 1; i < entered.path.length; i++) {
        expect(catalog.nodeById(entered.path[i])?.parent, node.id).toBe(entered.path[i - 1]);
      }
      const columns = sessions.sessionColumns(entered, new Date(NOW).toISOString());
      expect(sessions.readSession(columns).path, node.id).toEqual(entered.path);
    }
  });

  it("keeps a disabled parent's descendants unreachable, all the way down", () => {
    for (const node of catalog.CATALOG) {
      if (!node.parent || node.parent === catalog.ROOT_ID) continue;
      expect(catalog.isAvailable(node, [node.parent]), node.id).toBe(false);
    }
  });
});
