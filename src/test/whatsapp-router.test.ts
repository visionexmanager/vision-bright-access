// The universal router.
//
// One resolver turns a number, a tapped row or a spoken word into one stable
// feature id, and one gate decides whether that feature may run. These tests
// drive the real resolver; the property tests at the bottom exist to fail the
// day somebody adds a second one.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { Capability } from "../../supabase/functions/_shared/whatsappCatalog.ts";
import type { EngineContext } from "../../supabase/functions/_shared/whatsappEngine.ts";
import type { SessionState } from "../../supabase/functions/_shared/whatsappSession.ts";
import type { Routing } from "../../supabase/functions/_shared/whatsappRouter.ts";

const catalog = await import("../../supabase/functions/_shared/whatsappCatalog.ts");
const router = await import("../../supabase/functions/_shared/whatsappRouter.ts");
const engine = await import("../../supabase/functions/_shared/whatsappEngine.ts");
const sessions = await import("../../supabase/functions/_shared/whatsappSession.ts");
const ai = await import("../../supabase/functions/_shared/whatsappAssistant.ts");

const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
const routerSource = readFileSync("supabase/functions/_shared/whatsappRouter.ts", "utf8");

/** The router with its prose removed: these guards are about what it *does*. */
const routerCode = routerSource
  .split(String.fromCharCode(10))
  .filter((line) => {
    const trimmed = line.trim();
    return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
  })
  .join(String.fromCharCode(10));


const ALL: Capability[] = ["ai", "vision", "speech_to_text", "text_to_speech", "location", "bazaar"];
const NOW = Date.parse("2026-08-24T09:00:00Z");

const route = (over: Partial<Parameters<typeof router.resolveSelection>[0]> = {}) =>
  router.resolveSelection({
    menuId: catalog.ROOT_ID,
    text: "",
    language: "en",
    disabled: [],
    available: ALL,
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

const live = (over: Partial<SessionState> = {}): SessionState => ({
  ...sessions.freshSession(),
  updatedAt: new Date(NOW - 60_000).toISOString(),
  ...over,
});

// ── The main menu ───────────────────────────────────────────────────────────

describe("the main menu", () => {
  it("renders named options, in every language", () => {
    // Named, not numbered. The name is what a sender replies with when Meta
    // refuses the tappable version, and what the router resolves against the
    // menu in view — so the line has to carry the meaning on its own.
    for (const language of ["ar", "en", "fr", "ja"] as const) {
      const menu = engine.renderMenu(catalog.ROOT_ID, language);
      const rows = menu.split("\n").filter((line) => line.startsWith("• "));
      expect(rows.length, language).toBe(catalog.childrenOf(catalog.ROOT_ID).length);
      for (const line of rows) {
        expect(line, language).not.toMatch(/^• \d/);
        expect(line.replace(/\p{Extended_Pictographic}️?/gu, ""), language).toMatch(/^• \s*\p{L}/u);
      }
    }
    // The labels differ by language: nothing is hard-coded English.
    expect(engine.renderMenu(catalog.ROOT_ID, "ar")).not.toBe(engine.renderMenu(catalog.ROOT_ID, "en"));
    expect(engine.renderMenu(catalog.ROOT_ID, "fr")).not.toBe(engine.renderMenu(catalog.ROOT_ID, "en"));
  });

  it("resolves each number to the feature id in that position, not to a name", () => {
    const children = catalog.childrenOf(catalog.ROOT_ID);
    children.forEach((child, index) => {
      const routed = route({ text: String(index + 1) });
      const featureId = routed.kind === "feature" || routed.kind === "unavailable" ? routed.featureId : null;
      expect(featureId, `number ${index + 1}`).toBe(child.id);
    });
  });

  it("reads a number against the menu in view, never against the main one", () => {
    // "1" means three different features depending on where the sender stands.
    expect(idOf(route({ menuId: "main", text: "1" }))).toBe("assistant");
    expect(idOf(route({ menuId: "assistant", text: "1" }))).toBe("assistant.ask");
    expect(idOf(route({ menuId: "services", text: "1" }))).toBe("services.weather");
    expect(idOf(route({ menuId: "ocr", text: "1" }))).toBe("ocr.read");
  });

  it("keeps ids stable when the printed order changes", () => {
    // The number is presentation. Reordering is an edit to `order`, and the id
    // a session persisted yesterday still names the same feature.
    const weather = catalog.nodeById("services.weather")!;
    const before = catalog.numberOf(weather);
    const siblings = catalog.childrenOf("services").map((n) => n.id);
    expect(siblings[before - 1]).toBe("services.weather");
    // Ids never contain a position.
    for (const node of catalog.CATALOG) expect(node.id).not.toMatch(/\d/);
  });
});

const idOf = (routed: Routing): string | null =>
  routed.kind === "feature" || routed.kind === "unavailable" ? routed.featureId : null;

// ── Nested navigation ───────────────────────────────────────────────────────

describe("moving through the tree", () => {
  it("goes main → feature → submenu → child, and back out again", () => {
    let session = live();

    const toAssistant = engine.runEngine({ text: "1", kind: "text" }, session, context());
    session = toAssistant.session;
    expect(session.path).toEqual(["main", "assistant"]);

    const toAsk = engine.runEngine({ text: "1", kind: "text" }, session, context());
    session = toAsk.session;
    expect(toAsk.kind).toBe("delegate");
    expect(session.feature).toBe("assistant.ask");

    const back = engine.runEngine({ text: "0", kind: "text" }, session, context());
    session = back.session;
    expect(session.path).toEqual(["main", "assistant"]);
    expect(session.feature).toBeNull();

    const home = engine.runEngine({ text: "0", kind: "text" }, session, context());
    expect(home.session.path).toEqual(["main"]);
  });

  it("sends 00 home from any depth, and # cancels without losing the place", () => {
    const deep = live({
      path: ["main", "assistant", "assistant.ask"],
      feature: "assistant.ask",
      step: ai.AI_PROCESSING,
      pending: { operation: ai.AI_TEXT_INPUT, startedAt: new Date(NOW - 1_000).toISOString() },
    });
    expect(engine.runEngine({ text: "00", kind: "text" }, deep, context()).session.path).toEqual(["main"]);

    const cancelled = engine.runEngine({ text: "#", kind: "text" }, deep, context());
    expect(cancelled.reason).toBe("cancel_command");
    expect(cancelled.session.pending).toBeNull();
    expect(cancelled.session.path).toEqual(["main", "assistant", "assistant.ask"]);
  });

  it("treats every universal command as a command, never as a feature", () => {
    for (const text of ["0", "00", "#", "menu", "help", "رجوع", "قائمة", "إلغاء", "مساعدة"]) {
      const routed = route({ text, menuId: "services" });
      expect(routed.kind, text).toBe("command");
    }
  });
});

// ── Persistence across deliveries ───────────────────────────────────────────

describe("navigation across separate webhook requests", () => {
  const delivery = (row: Record<string, unknown> | null, text: string) => {
    const state = sessions.readSession(row);
    const outcome = engine.runEngine({ text, kind: "text" }, state, context());
    return { outcome, row: sessions.sessionColumns(outcome.session, new Date(NOW).toISOString()) };
  };

  it("reconstructs where the sender is from columns alone", () => {
    // Request one: "5" opens Services.
    const first = delivery({ session_updated_at: new Date(NOW - 60_000).toISOString() }, "5");
    expect(first.row.nav_path).toEqual(["main", "services"]);

    // Request two is a separate process with nothing but those columns, and "1"
    // means the first row of *Services*, not of the main menu.
    const second = delivery({ ...first.row, session_updated_at: new Date(NOW - 30_000).toISOString() }, "1");
    expect(second.outcome.kind).toBe("delegate");
    if (second.outcome.kind !== "delegate") return;
    expect(second.outcome.node.id).toBe("services.weather");
  });

  it("needs no memory of its own between calls", () => {
    // Two engines, same columns, same answer: nothing is cached in the module.
    const row = { nav_path: ["main", "ocr"], session_updated_at: new Date(NOW - 1_000).toISOString() };
    const a = delivery(row, "2");
    const b = delivery(row, "2");
    expect(a.row).toEqual(b.row);
    expect(idOf(route({ menuId: "ocr", text: "2" }))).toBe("ocr.describe");
  });
});

// ── Feature flags ───────────────────────────────────────────────────────────

describe("feature flags, applied after resolution", () => {
  it("refuses a disabled feature by number, and does not enter it", () => {
    const routed = route({ text: "5", disabled: ["services"] });
    expect(routed.kind).toBe("unavailable");
    if (routed.kind !== "unavailable") return;
    expect(routed.featureId).toBe("services");
    expect(routed.reason).toBe("disabled");
  });

  it("takes children down with the parent", () => {
    const child = route({ menuId: "services", text: "1", disabled: ["services"] });
    expect(child.kind).toBe("unavailable");
    expect(catalog.isAvailable(catalog.nodeById("services.weather"), ["services"])).toBe(false);
  });

  it("refuses the same feature when it is named instead of numbered", () => {
    // This is the whole point of resolving before gating: a word must not be a
    // way around a flag.
    for (const [text, language] of [["weather", "en"], ["الطقس", "ar"]] as const) {
      const open = route({ text, language });
      expect(idOf(open), text).toBe("services.weather");

      const shut = route({ text, language, disabled: ["services.weather"] });
      expect(shut.kind, text).toBe("unavailable");
      expect(idOf(shut), text).toBe("services.weather");
    }
  });

  it("refuses a feature whose capability is missing, without naming the reason", () => {
    // 2 is Image & text, the row that needs the vision capability.
    const routed = route({ text: "2", available: ["ai"] });
    expect(routed.kind).toBe("unavailable");
    if (routed.kind !== "unavailable") return;
    expect(routed.reason).toBe("capability");
    // The engine's notice for this says nothing about keys or providers.
    expect(engine.ENGINE_STRINGS.unavailable.en).not.toMatch(/key|provider|capab/i);
  });

  it("marks a declared feature as not open, and hides one a flag switched off", () => {
    // Two different states that used to look the same. A feature Visionex has
    // announced and not built keeps its row and says so — taking VisionKids off
    // the menu would tell the people waiting for it that it was cancelled.
    // Academy used to be that row; IVX opens behind it now, so VisionKids is
    // the declared-not-built one.
    const menu = engine.renderMenu("explore", "en");
    expect(menu).toContain("VisionKids");
    expect(menu).toMatch(/VisionKids.*isn't open yet/);

    // A live flag is the other thing entirely: turned at three in the morning
    // because a provider is down, and a row that answers a tap with "not
    // available" is a row that wasted somebody's time.
    const flagged = engine.renderMenu(catalog.ROOT_ID, "en", ["services"]);
    expect(flagged).not.toContain("Visionex Services");
  });
});

// ── Aliases ─────────────────────────────────────────────────────────────────

describe("words that name a feature", () => {
  it("resolves Arabic and English aliases to one id", () => {
    const cases: Array<[string, "ar" | "en", string]> = [
      ["الطقس", "ar", "services.weather"],
      ["الجو", "ar", "services.weather"],
      ["weather", "en", "services.weather"],
      ["forecast", "en", "services.weather"],
      ["وين أنا", "ar", "services.where"],
      ["where am I", "en", "services.where"],
      ["السوق", "ar", "services.bazaar"],
      ["bazaar", "en", "services.bazaar"],
      ["موظف", "ar", "support.human"],
      ["human", "en", "support.human"],
      ["اقرأ", "ar", "ocr.read"],
      ["read text", "en", "ocr.read"],
    ];
    for (const [text, language, expected] of cases) {
      expect(router.resolveAlias(text, language)?.id, `${text} (${language})`).toBe(expected);
    }
  });

  it("folds what a keyboard added and the sender did not mean", () => {
    for (const text of ["الطقس", " الطقس ", "الطقس؟", "الــطقس", "ٱلطقس"]) {
      expect(router.resolveAlias(text, "ar")?.id, text).toBe("services.weather");
    }
    for (const text of ["Weather", "  WEATHER!", "weather."]) {
      expect(router.resolveAlias(text, "en")?.id, text).toBe("services.weather");
    }
  });

  it("does not read a sentence that merely contains the word", () => {
    // "شو رأيك بالطقس بالسويد" is a conversation, and answering it with a
    // forecast card would be the router overriding the assistant.
    for (const text of [
      "شو رأيك بالطقس بالسويد",
      "the weather app on my phone is broken",
      "can you tell me about the bazaar and how it works",
    ]) {
      expect(router.resolveAlias(text, text.startsWith("شو") ? "ar" : "en"), text).toBeNull();
    }
  });


  it("lets the open feature keep the floor when a word names another one", () => {
    // Somebody inside Ask AI who types "weather" asked the assistant about the
    // weather. A router that grabbed that word would be interrupting a
    // conversation it is not part of.
    const inAsk = live({
      path: ["main", "assistant", "assistant.ask"],
      feature: "assistant.ask",
      step: ai.AI_TEXT_INPUT,
    });
    const outcome = engine.runEngine({ text: "weather", kind: "text" }, inAsk, context());
    expect(outcome.kind).toBe("delegate");
    expect(outcome.reason).toBe("inside_feature");
    if (outcome.kind !== "delegate") return;
    expect(outcome.node.id).toBe("assistant.ask");
    // A *number*, though, is still navigation: that is how you get out.
    const two = engine.runEngine({ text: "2", kind: "text" }, inAsk, context());
    expect(two.kind).toBe("delegate");
    if (two.kind !== "delegate") return;
    expect(two.node.id).toBe("assistant.voice");
  });

  it("does not let a word preempt the feature holding the floor", () => {
    // Somebody inside Ask AI who types "weather" asked the assistant about the
    // weather. The feature keeps the floor until they leave it.
    const inAssistant = live({ path: ["main", "assistant", "assistant.ask"], feature: "assistant.ask" });
    const outcome = engine.runEngine({ text: "weather", kind: "text" }, inAssistant, context());
    expect(outcome.kind).toBe("delegate");
    expect(outcome.reason).toBe("inside_feature");
    expect(outcome.session.path).toEqual(["main", "assistant", "assistant.ask"]);
  });

  it("opens a row the sender names off the menu in front of them", () => {
    // This is the other half of removing the numbers: the text copy of a menu
    // says "reply with the name of what you need", and that has to be true.
    const inServices = live({ path: ["main", "services"] });
    const outcome = engine.runEngine({ text: "Weather", kind: "text" }, inServices, context());
    expect(outcome.kind).toBe("delegate");
    expect(outcome.session.feature).toBe("services.weather");

    // A word naming nothing on this menu is still not navigation.
    const idle = engine.runEngine({ text: "how much is a subscription?", kind: "text" }, inServices, context());
    expect(idle.kind).toBe("passthrough");
  });
});

// ── Recovery ────────────────────────────────────────────────────────────────

describe("recovering from things that should not happen", () => {
  it("answers an invalid number with the same menu, not a reset", () => {
    const routed = route({ menuId: "services", text: "9" });
    expect(routed.kind).toBe("invalid");
    if (routed.kind !== "invalid") return;
    expect(routed.menuId).toBe("services");
  });

  it("reads a number against the main menu when the stored menu is gone", () => {
    // A node renamed under a live session: the number still means something.
    const routed = route({ menuId: "menu.that.was.removed", text: "1" });
    expect(idOf(routed)).toBe("assistant");
  });

  it("recovers an unknown persisted feature to its nearest living ancestor", () => {
    const state = sessions.readSession({
      nav_path: ["main", "services", "services.retired"],
      current_feature: "services.retired",
    });
    expect(state.path).toEqual(["main", "services"]);
    expect(state.feature).toBeNull();
  });

  it("answers a tap on a row this build no longer has", () => {
    const routed = route({ selection: "menu_of_a_previous_release" });
    expect(routed.kind).toBe("stale");
  });
});

// ── AI and voice stay behind the router ─────────────────────────────────────

describe("the features the router must not have absorbed", () => {
  it("routes into the AI assistant without owning any of its states", () => {
    expect(idOf(route({ text: "1" }))).toBe("assistant");
    expect(idOf(route({ menuId: "assistant", text: "1" }))).toBe("assistant.ask");
    expect(idOf(route({ menuId: "assistant", text: "2" }))).toBe("assistant.voice");
    expect(idOf(route({ menuId: "assistant", text: "3" }))).toBe("assistant.new");
    // Every AI state is still declared by the assistant, and named nowhere here.
    for (const state of ai.AI_STATES) expect(routerSource, state).not.toContain(state);
  });

  it("keeps the voice path where it was", () => {
    // One transcription call, and every ask in the webhook — not in the
    // router. What matters here is the router's ignorance of both, not how
    // many places the webhook itself asks a model.
    expect(webhook.match(/voiceToText\(/g)?.length).toBe(1);
    expect(routerCode).not.toContain("askAssistant");
    for (const word of ["transcribe", "speakReply", "audio", "Whisper"]) {
      expect(routerCode, word).not.toContain(word);
    }
  });

  it("leaves ordinary conversation alone", () => {
    const outcome = engine.runEngine(
      { text: "how much does the subscription cost?", kind: "text" },
      live(),
      context(),
    );
    expect(outcome.kind).toBe("passthrough");
    expect(route({ text: "how much does the subscription cost?" }).kind).toBe("passthrough");
  });
});

// ── Contract guards ─────────────────────────────────────────────────────────
//
// These exist to fail the day somebody adds a second routing system.

describe("the shape of the architecture", () => {
  it("has one id per feature, and no id encodes a position", () => {
    const ids = catalog.CATALOG.map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id, id).toMatch(/^[a-z][a-z_.]*$/);
  });

  it("has no menu item pointing at a missing feature, and no orphan", () => {
    for (const node of catalog.CATALOG) {
      if (node.id === catalog.ROOT_ID) continue;
      expect(catalog.nodeById(node.parent), `${node.id} has no parent`).not.toBeNull();
      expect(catalog.nodeById(node.parent)?.kind, `${node.id} hangs off an action`).toBe("menu");
    }
    for (const node of catalog.CATALOG) {
      if (node.kind === "menu") expect(catalog.childrenOf(node.id).length, node.id).toBeGreaterThan(0);
    }
  });

  it("numbers each menu uniquely, from 1, with no gaps", () => {
    for (const node of catalog.CATALOG) {
      if (node.kind !== "menu") continue;
      const numbers = catalog.childrenOf(node.id).map((child) => catalog.numberOf(child));
      expect(new Set(numbers).size, node.id).toBe(numbers.length);
      expect(numbers, node.id).toEqual(numbers.map((_, index) => index + 1));
    }
  });

  it("gives every alias to exactly one feature", () => {
    const seen = new Map<string, string>();
    for (const node of catalog.CATALOG) {
      for (const language of ["ar", "en"] as const) {
        for (const alias of catalog.aliasesOf(node, language)) {
          const key = `${language}:${router.normaliseAlias(alias)}`;
          const owner = seen.get(key);
          expect(owner ?? node.id, `alias "${alias}" is claimed by ${owner} and ${node.id}`).toBe(node.id);
          seen.set(key, node.id);
        }
      }
    }
    expect(seen.size).toBeGreaterThan(20);
  });

  it("never lets an alias reach a feature the gate would refuse", () => {
    // Every alias in the catalog, checked against a flag on its own feature and
    // against a flag on its parent.
    for (const node of catalog.CATALOG) {
      for (const language of ["ar", "en"] as const) {
        for (const alias of catalog.aliasesOf(node, language)) {
          for (const off of [node.id, node.parent ?? catalog.ROOT_ID]) {
            const routed = route({ text: alias, language, disabled: [off] });
            expect(routed.kind, `${alias} with ${off} disabled`).not.toBe("feature");
          }
        }
      }
    }
  });

  it("keeps feature logic out of the router", () => {
    // The router reads text and returns an identifier. Anything else belongs to
    // the feature it names.
    for (const forbidden of [
      "openai", "mistral", "gemini", "groq", "provider", "streamChat",
      "transcribe", "speakReply", "fetch(", "Deno.env", "supabase", "createClient",
      "weather", "bazaar", "pending_vision", "API_KEY", "token",
    ]) {
      expect(routerCode.toLowerCase(), forbidden).not.toContain(forbidden.toLowerCase());
    }
  });

  it("has exactly one resolver, used by the engine", () => {
    const engineSource = readFileSync("supabase/functions/_shared/whatsappEngine.ts", "utf8");
    expect(engineSource).toContain("resolveSelection({");
    // The engine must not have kept its own copy of the resolution rules.
    expect(engineSource).not.toContain("childAt(menuId, choice)");
    expect(routerSource.match(/export function resolveSelection/g)?.length).toBe(1);
    // And the webhook must not resolve anything itself.
    expect(webhook).not.toContain("childAt(");
    expect(webhook).not.toContain("resolveAlias(");
  });

  it("keeps one command vocabulary for the engine and the router", () => {
    const commands = readFileSync("supabase/functions/_shared/whatsappCommands.ts", "utf8");
    expect(commands).toContain("export function parseCommand");
    expect(commands).toContain("export function parseChoice");
    // Neither the engine nor the router re-declares the words.
    const engineSource = readFileSync("supabase/functions/_shared/whatsappEngine.ts", "utf8");
    for (const source of [engineSource, routerSource]) {
      expect(source).not.toMatch(/const HOME_WORDS\b/);
      expect(source).not.toMatch(/const BACK_WORDS\b/);
    }
  });
});
