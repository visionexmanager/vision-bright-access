// The WhatsApp navigation engine.
//
// The engine is pure — (message, session, clock) in, a decision out — so every
// case below runs the real thing rather than a mock of it. The webhook's part
// is asserted against its source, which is the only way to pin "this branch
// exists and is reached in this order" without a Meta account.
//
// The twenty-one scenarios the specification asks for are all here, named as
// they were asked for, plus the ones the implementation itself made necessary.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { Capability } from "../../supabase/functions/_shared/whatsappCatalog.ts";
import type {
  EngineContext,
  EngineMessage,
  EngineOutcome,
} from "../../supabase/functions/_shared/whatsappEngine.ts";
import type { SessionState } from "../../supabase/functions/_shared/whatsappSession.ts";

const catalog = await import("../../supabase/functions/_shared/whatsappCatalog.ts");
const session = await import("../../supabase/functions/_shared/whatsappSession.ts");
const engine = await import("../../supabase/functions/_shared/whatsappEngine.ts");
const vision = await import("../../supabase/functions/_shared/whatsappVisionModes.ts");
const weather = await import("../../supabase/functions/_shared/whatsappWeather.ts");
const geo = await import("../../supabase/functions/_shared/whatsappLocation.ts");
const bazaar = await import("../../supabase/functions/_shared/whatsappBazaar.ts");
const helpers = await import("../../supabase/functions/_shared/whatsapp.ts");

const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");

const NOW = Date.parse("2026-08-23T12:00:00Z");
const EVERYTHING: Capability[] = [
  "ai", "vision", "speech_to_text", "text_to_speech", "location", "bazaar",
];

function context(over: Partial<EngineContext> = {}): EngineContext {
  return {
    language: "en",
    nowMs: NOW,
    timeoutMs: 30 * 60_000,
    available: EVERYTHING,
    isNewConversation: false,
    ...over,
  };
}

function live(over: Partial<SessionState> = {}): SessionState {
  return {
    ...session.freshSession(),
    updatedAt: new Date(NOW - 60_000).toISOString(),
    ...over,
  };
}

const send = (
  text: string,
  state = live(),
  ctx: Partial<EngineContext> = {},
  extra: Partial<EngineMessage> = {},
) => engine.runEngine({ text, kind: "text", ...extra }, state, context(ctx));

/** The menu node a "reply" outcome is showing, for readability below. */
const shownMenu = (outcome: EngineOutcome): string | null =>
  outcome.kind === "reply"
    ? (outcome.replies.find((r) => r.type === "menu") as { nodeId: string } | undefined)?.nodeId ?? null
    : null;

// ── 1–5: getting in ─────────────────────────────────────────────────────────

describe("arriving", () => {
  it("1. sends a new user the main menu when they say hello", () => {
    const outcome = send("Hi", live({ updatedAt: null }), { isNewConversation: true });
    expect(outcome.kind).toBe("reply");
    expect(outcome.reason).toBe("greeting");
    expect(shownMenu(outcome)).toBe(catalog.ROOT_ID);
    expect(outcome.session.path).toEqual([catalog.ROOT_ID]);
  });

  it("1b. answers a new user who opened with a real question, rather than a menu", () => {
    // Replying to "how much is the subscription" with ten numbered options is
    // the kind of helpfulness nobody wants.
    const outcome = send("how much is the subscription?", live({ updatedAt: null }), {
      isNewConversation: true,
    });
    expect(outcome.kind).toBe("passthrough");
  });

  it("2. keeps an existing user where they left off", () => {
    const state = live({ path: ["main", "ocr"] });
    const outcome = send("what is this", state);
    // Not navigation, so the conversational pipeline answers — and the place
    // in the tree is untouched.
    expect(outcome.kind).toBe("passthrough");
    expect(outcome.session.path).toEqual(["main", "ocr"]);
  });

  it("3. opens option 1 from the main menu", () => {
    const outcome = send("1");
    // The AI Assistant is a menu of its own since the assistant phase: Ask,
    // Voice question, New conversation.
    expect(outcome.kind).toBe("reply");
    expect(outcome.session.path).toEqual(["main", "assistant"]);
    expect(catalog.childrenOf("assistant").length).toBe(3);
  });

  it("4. opens option 2 from the main menu", () => {
    const outcome = send("2");
    expect(outcome.kind).toBe("delegate");
    if (outcome.kind !== "delegate") return;
    expect(outcome.node.id).toBe("voice");
  });

  it("5. opens option 3 and lands inside its submenu", () => {
    const outcome = send("3");
    expect(outcome.kind).toBe("reply");
    expect(shownMenu(outcome)).toBe("ocr");
    expect(outcome.session.path).toEqual(["main", "ocr"]);
    expect(outcome.session.feature).toBeNull();
  });

  it("5b. numbers a submenu from 1 again, so the sender never has to count", () => {
    const inOcr = live({ path: ["main", "ocr"] });
    const outcome = send("1", inOcr);
    expect(outcome.kind).toBe("delegate");
    if (outcome.kind !== "delegate") return;
    expect(outcome.node.id).toBe("ocr.read");
  });
});

// ── 6–11: the universal commands ────────────────────────────────────────────

describe("navigation commands", () => {
  it("6. shows the same menu again for an invalid number, and does not reset", () => {
    const inOcr = live({ path: ["main", "ocr"], context: { keep: "this" } });
    const outcome = send("99", inOcr);
    expect(outcome.kind).toBe("reply");
    expect(outcome.reason).toBe("invalid_selection");
    expect(shownMenu(outcome)).toBe("ocr");
    // The session is exactly as it was: a typo is not a reason to lose your place.
    expect(outcome.session.path).toEqual(["main", "ocr"]);
    expect(outcome.session.context).toEqual({ keep: "this" });
    if (outcome.kind !== "reply") return;
    const note = outcome.replies.find((r) => r.type === "menu") as { note?: string };
    expect(note.note).toBe(engine.ENGINE_STRINGS.invalidChoice.en);
  });

  it("7. goes back one level with 0, and stays put at the main menu", () => {
    const inOcr = live({ path: ["main", "ocr"] });
    const back = send("0", inOcr);
    expect(back.session.path).toEqual(["main"]);
    expect(shownMenu(back)).toBe("main");

    const atRoot = send("0", live());
    expect(atRoot.session.path).toEqual(["main"]);
    expect(shownMenu(atRoot)).toBe("main");
    expect(atRoot.reason).toBe("back_command");
  });

  it("7b. leaves a feature with 0 rather than trapping the sender inside it", () => {
    const inside = live({ path: ["main", "ocr", "ocr.read"], feature: "ocr.read", step: "awaiting_image" });
    const outcome = send("0", inside);
    expect(outcome.session.path).toEqual(["main", "ocr"]);
    expect(outcome.session.feature).toBeNull();
    expect(outcome.session.step).toBeNull();
  });

  it("8. returns to the main menu with 00 from anywhere", () => {
    const deep = live({ path: ["main", "ocr", "ocr.read"], feature: "ocr.read", context: { a: 1 } });
    const outcome = send("00", deep);
    expect(outcome.reason).toBe("menu_command");
    expect(outcome.session.path).toEqual(["main"]);
    expect(outcome.session.feature).toBeNull();
    expect(outcome.session.context).toEqual({});
  });

  it("9. cancels a pending operation with #, and stays where it is", () => {
    const busy = live({
      path: ["main", "ocr", "ocr.read"],
      feature: "ocr.read",
      step: "awaiting_image",
      pending: { operation: "awaiting_image", startedAt: new Date(NOW - 5_000).toISOString() },
    });
    const outcome = send("#", busy);
    expect(outcome.reason).toBe("cancel_command");
    expect(outcome.session.pending).toBeNull();
    expect(outcome.session.step).toBeNull();
    // Still in the feature it was cancelled from, not thrown back to the top.
    expect(outcome.session.path).toEqual(["main", "ocr", "ocr.read"]);
    if (outcome.kind !== "reply") return;
    const shown = outcome.replies.find((r) => r.type === "menu") as { note?: string };
    expect(shown.note).toBe(engine.ENGINE_STRINGS.cancelled.en);
  });

  it("9b. says so plainly when there was nothing to cancel", () => {
    const outcome = send("cancel", live());
    if (outcome.kind !== "reply") return;
    const shown = outcome.replies.find((r) => r.type === "menu") as { note?: string };
    expect(shown.note).toBe(engine.ENGINE_STRINGS.nothingToCancel.en);
  });


  it("9c. cancels the armed camera mode as well as the session's own pending state", () => {
    // The vision modes predate this engine and keep their own column with its
    // own clock. A cancel that left that armed would answer the next unrelated
    // photograph as if it were this request.
    expect(webhook).toMatch(
      /outcome\.reason === "cancel_command"[\s\S]{0,400}pending_vision_mode: null/,
    );
  });

  it("10. treats \"menu\" as the main menu, whatever the capitalisation", () => {
    for (const text of ["menu", "MENU", " Menu ", "Main Menu", "00", "قائمة", "الرئيسية"]) {
      const outcome = send(text, live({ path: ["main", "ocr"] }));
      expect(outcome.session.path, text).toEqual(["main"]);
      expect(shownMenu(outcome), text).toBe("main");
    }
  });

  it("11. explains the commands for \"help\", and leaves the sender where they are", () => {
    const inOcr = live({ path: ["main", "ocr"] });
    const outcome = send("HELP", inOcr);
    expect(outcome.kind).toBe("reply");
    expect(outcome.reason).toBe("help_command");
    expect(outcome.session.path).toEqual(["main", "ocr"]);
    if (outcome.kind !== "reply") return;
    const text = (outcome.replies[0] as { text: string }).text;
    for (const command of ["0", "00", "#", "help"]) expect(text).toContain(command);
  });

  it("11b. recognises every command in Arabic too", () => {
    expect(engine.parseCommand("رجوع")).toBe("back");
    expect(engine.parseCommand("قائمة")).toBe("home");
    expect(engine.parseCommand("إلغاء")).toBe("cancel");
    expect(engine.parseCommand("مساعدة")).toBe("help");
    // And an ordinary sentence containing one of those words is not a command.
    expect(engine.parseCommand("بدي مساعدة بالفاتورة تبعي")).toBeNull();
    expect(engine.parseCommand("رجوع الفاتورة القديمة")).toBeNull();
  });
});

// ── 12–16: the awkward cases ────────────────────────────────────────────────

describe("the awkward cases", () => {
  it("12. resets stale working state on timeout but keeps the sender's settings", () => {
    const abandoned = live({
      path: ["main", "ocr", "ocr.read"],
      feature: "ocr.read",
      step: "awaiting_image",
      pending: { operation: "awaiting_image", startedAt: new Date(NOW - 90 * 60_000).toISOString() },
      context: { half: "finished" },
      updatedAt: new Date(NOW - 90 * 60_000).toISOString(),
    });
    const outcome = send("hello?", abandoned);
    expect(outcome.reason).toBe("timeout_reset");
    expect(outcome.session.path).toEqual(["main"]);
    expect(outcome.session.pending).toBeNull();
    expect(outcome.session.context).toEqual({});
    // Language and voice preference are columns of their own and are not part
    // of the session at all — which is what makes this guarantee structural.
    expect(Object.keys(session.freshSession())).not.toContain("language");
    expect(Object.keys(session.freshSession())).not.toContain("voice_mode");
  });

  it("12b. reads the timeout from the environment, with a sane default", () => {
    expect(session.sessionTimeoutMs(() => undefined)).toBe(session.DEFAULT_SESSION_TIMEOUT_MINUTES * 60_000);
    expect(session.sessionTimeoutMs(() => "5")).toBe(5 * 60_000);
    // Nonsense and hostile values fall back rather than disabling the timeout.
    expect(session.sessionTimeoutMs(() => "abc")).toBe(session.DEFAULT_SESSION_TIMEOUT_MINUTES * 60_000);
    expect(session.sessionTimeoutMs(() => "-1")).toBe(session.DEFAULT_SESSION_TIMEOUT_MINUTES * 60_000);
    expect(session.sessionTimeoutMs(() => "999999")).toBe(24 * 60 * 60_000);
    expect(webhook).toContain("timeoutMs: sessionTimeoutMs()");
  });

  it("13. relies on the unique message id for duplicate webhook events", () => {
    // Meta redelivers anything that is not a prompt 200. The insert is the
    // idempotency key: the second copy hits the unique index and stops there,
    // before the engine, before the model and before any reply.
    expect(webhook).toContain("wa_message_id: incoming.messageId");
    expect(webhook).toMatch(/if \(dupe\) \{[\s\S]*?dupe\.code === "23505"[\s\S]*?continue;/);
    const insertAt = webhook.indexOf("wa_message_id: incoming.messageId");
    expect(insertAt).toBeGreaterThan(-1);
    expect(insertAt).toBeLessThan(webhook.indexOf("const outcome = runEngine("));
  });

  it("14. hands an unsupported message kind to the pipeline rather than guessing", () => {
    const outcome = engine.runEngine({ text: "", kind: "unknown" }, live(), context());
    expect(outcome.kind).toBe("passthrough");
    // And the webhook's own notice for a type nothing can read still exists.
    expect(webhook).toContain("unsupportedTypeNotice(language, incoming.unsupportedType)");
  });

  it("15. announces a disabled feature instead of opening it", () => {
    // Academy, Kids, News and Sports are declared and not built.
    const outcome = send("4");
    expect(outcome.kind).toBe("reply");
    expect(outcome.reason).toBe("disabled_feature");
    expect(shownMenu(outcome)).toBe(catalog.ROOT_ID);
    // Not entered: the session must not point at something that cannot run.
    expect(outcome.session.feature).toBeNull();
    if (outcome.kind !== "reply") return;
    const shown = outcome.replies.find((r) => r.type === "menu") as { note?: string };
    expect(shown.note).toBe(engine.ENGINE_STRINGS.disabled.en);
  });

  it("15b. refuses a feature whose capability is missing, without naming the reason", () => {
    const outcome = send("3", live(), { available: ["ai"] });
    expect(outcome.reason).toBe("missing_capability");
    if (outcome.kind !== "reply") return;
    const shown = outcome.replies.find((r) => r.type === "menu") as { note?: string };
    expect(shown.note).toBe(engine.ENGINE_STRINGS.unavailable.en);
    // "the vision provider has no key" is a fact about Visionex's billing.
    expect(shown.note).not.toMatch(/key|provider|OPENAI/i);
  });

  it("16. keeps a failing feature inside its own try/catch, with a clean message", () => {
    expect(webhook).toContain("await reply(featureErrorNotice(noticeLanguage), \"unsupported\");");
    expect(webhook).toMatch(/catch \(e\) \{[\s\S]*?feature \$\{node\.id\} failed/);
    for (const language of ["ar", "en"] as const) {
      const notice = engine.featureErrorNotice(language);
      expect(notice.length).toBeGreaterThan(30);
      // No stack, no provider, no code.
      expect(notice).not.toMatch(/error|stack|500|api|token/i);
    }
  });
});

// ── 17–21: language, voice and pictures ─────────────────────────────────────

describe("language and other message kinds", () => {
  it("17. answers Arabic input in Arabic, menus included", () => {
    const outcome = send("٣", live(), { language: "ar" });
    expect(outcome.kind).toBe("reply");
    expect(shownMenu(outcome)).toBe("ocr");
    const menu = engine.renderMenu("ocr", "ar");
    expect(menu).toContain("اقرأ لي");
    expect(menu).not.toMatch(/[A-Za-z]{4,}/); // no English leaking into an Arabic menu
  });

  it("18. answers English input in English", () => {
    const menu = engine.renderMenu("ocr", "en");
    expect(menu).toContain("Read the text");
    expect(menu).toContain("0");
  });

  it("19. takes the language from the session, not from the message", () => {
    // The engine is handed a language and uses only that, so a single English
    // word inside an Arabic conversation cannot flip a menu mid-session.
    const arabic = engine.runEngine({ text: "1", kind: "text" }, live(), context({ language: "ar" }));
    const english = engine.runEngine({ text: "1", kind: "text" }, live(), context({ language: "en" }));
    expect(arabic.session.path).toEqual(english.session.path);
    expect(session.sessionLanguage("ar", "en")).toBe("ar");
    expect(session.sessionLanguage(null, "en")).toBe("en");
    expect(webhook).toContain("language: noticeLanguage,");
  });

  it("20. lets a voice note choose a number and stay in the feature", () => {
    // The transcript is what the engine sees, so "three" spoken lands exactly
    // where "3" typed does — and the audio path in front of it is untouched.
    const outcome = engine.runEngine({ text: "3", kind: "audio" }, live(), context());
    expect(shownMenu(outcome)).toBe("ocr");

    const inside = live({ path: ["main", "assistant"], feature: "assistant" });
    const spoken = engine.runEngine({ text: "what is my balance", kind: "audio" }, inside, context());
    expect(spoken.kind).toBe("delegate");
    if (spoken.kind !== "delegate") return;
    expect(spoken.node.id).toBe("assistant");
    expect(spoken.session.feature).toBe("assistant");

    // The transcription runs before the engine, which is what makes both true.
    expect(webhook.indexOf("voiceToText(")).toBeLessThan(webhook.indexOf("const outcome = runEngine("));
  });

  it("21. gives an image to the feature that is open", () => {
    const inside = live({ path: ["main", "ocr", "ocr.read"], feature: "ocr.read" });
    const outcome = engine.runEngine({ text: "", kind: "image" }, inside, context());
    expect(outcome.kind).toBe("delegate");
    if (outcome.kind !== "delegate") return;
    expect(outcome.node.id).toBe("ocr.read");
    expect(outcome.node.accepts).toContain("image");
    // With no feature open an image is not navigation, and the existing vision
    // pipeline answers it exactly as it did before.
    const loose = engine.runEngine({ text: "", kind: "image" }, live(), context());
    expect(loose.kind).toBe("passthrough");
  });
});

// ── The catalog ─────────────────────────────────────────────────────────────

describe("the catalog", () => {
  it("routes every phrase-backed leaf to the code that already answers it", () => {
    const expectations: Record<string, (phrase: string) => boolean> = {
      "ocr.read": (p) => vision.parseVisionMode(p)?.mode === "read_text",
      "ocr.describe": (p) => vision.parseVisionMode(p)?.mode === "describe",
      "ocr.find": (p) => vision.parseVisionMode(p)?.mode === "find_object",
      "ocr.product": (p) => vision.parseVisionMode(p)?.mode === "product",
      "ocr.translate": (p) => vision.parseVisionMode(p)?.mode === "translate",
      "services.weather": (p) => !!weather.parseWeatherRequest(p),
      "services.where": (p) => geo.asksWhereAmI(p),
      "services.nearby": (p) => geo.asksWhatIsNearby(p),
      "services.bazaar": (p) => bazaar.parseBazaarRequest(p)?.intent === "browse",
      "services.sell": (p) => bazaar.parseBazaarRequest(p)?.intent === "sell",
      "support.human": (p) => helpers.userAskedForHuman(p),
    };

    for (const node of catalog.CATALOG) {
      if (!node.phrase) continue;
      const check = expectations[node.id];
      expect(check, `no expectation declared for ${node.id}`).toBeTypeOf("function");
      for (const language of ["ar", "en"] as const) {
        const phrase = catalog.localized(node.phrase, language);
        expect(check(phrase), `${node.id} ${language}: "${phrase}"`).toBe(true);
      }
    }
  });

  it("gives every node a handler or a phrase, so no number is a dead end", () => {
    for (const node of catalog.CATALOG) {
      if (node.kind !== "action") continue;
      expect(!!(node.handler || node.phrase), `${node.id} does nothing`).toBe(true);
    }
  });

  it("keeps the tree consistent: unique ids, real parents, no orphans", () => {
    const ids = catalog.CATALOG.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const node of catalog.CATALOG) {
      if (node.id === catalog.ROOT_ID) {
        expect(node.parent).toBeNull();
        continue;
      }
      expect(catalog.nodeById(node.parent), `${node.id} has no parent`).not.toBeNull();
      expect(catalog.nodeById(node.parent)?.kind, `${node.id} hangs off an action`).toBe("menu");
    }
    // Every menu has something in it: an empty menu is a dead end with a name.
    for (const node of catalog.CATALOG) {
      if (node.kind === "menu") expect(catalog.childrenOf(node.id).length, node.id).toBeGreaterThan(0);
    }
  });

  it("numbers each menu from 1 with no gaps", () => {
    for (const node of catalog.CATALOG) {
      if (node.kind !== "menu") continue;
      const numbers = catalog.childrenOf(node.id).map((child) => catalog.numberOf(child));
      expect(numbers, node.id).toEqual(numbers.map((_, index) => index + 1));
    }
  });

  it("stays inside every limit Meta rejects an interactive message for", () => {
    for (const node of catalog.CATALOG) {
      if (node.kind !== "menu") continue;
      for (const language of ["ar", "en"] as const) {
        const list = catalog.listMessageFor(node.id, language);
        expect(list, `${node.id} ${language}`).not.toBeNull();
        if (!list) continue;
        const rows = list.action.sections.flatMap((section) => section.rows);
        expect(rows.length, node.id).toBeLessThanOrEqual(catalog.LIST_LIMITS.rows);
        expect(list.action.button.length).toBeLessThanOrEqual(catalog.LIST_LIMITS.button);
        expect(list.header.text.length).toBeLessThanOrEqual(catalog.LIST_LIMITS.header);
        expect(list.body.text.length).toBeLessThanOrEqual(catalog.LIST_LIMITS.body);
        expect(list.footer.text.length).toBeLessThanOrEqual(catalog.LIST_LIMITS.footer);
        for (const row of rows) {
          expect(row.title.length, row.title).toBeLessThanOrEqual(catalog.LIST_LIMITS.rowTitle);
          expect(row.description.length, row.description).toBeLessThanOrEqual(catalog.LIST_LIMITS.rowDescription);
          // Clipping exists as a seatbelt; nothing in the catalog should reach it.
          expect(row.title, row.title).not.toContain("…");
          expect(row.description, row.description).not.toContain("…");
        }
        expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
      }
    }
  });

  it("says everything in both languages", () => {
    for (const node of catalog.CATALOG) {
      for (const field of ["title", "description"] as const) {
        expect(node[field].ar.trim(), `${node.id}.${field}.ar`).not.toBe("");
        expect(node[field].en.trim(), `${node.id}.${field}.en`).not.toBe("");
        expect(node[field].ar, `${node.id}.${field} is not translated`).not.toBe(node[field].en);
      }
    }
  });

  it("reads correctly with the emoji stripped, because many senders never hear them", () => {
    for (const node of catalog.CATALOG) {
      // The emoji is decoration: the title carries the meaning on its own.
      expect(node.title.en.replace(/[^\p{L}\p{N}\s&.-]/gu, "").trim().length).toBeGreaterThan(2);
      expect(node.title.ar.replace(/[^\p{L}\p{N}\s&.-]/gu, "").trim().length).toBeGreaterThan(2);
    }
    const menu = engine.renderMenu(catalog.ROOT_ID, "en");
    for (const line of menu.split("\n").filter((l) => /^\d+\./.test(l))) {
      const withoutEmoji = line.replace(/\p{Extended_Pictographic}️?/gu, "").trim();
      expect(withoutEmoji).toMatch(/^\d+\.\s+\S/);
      expect(withoutEmoji).toContain("—");
    }
  });
});

// ── The session ─────────────────────────────────────────────────────────────

describe("session state", () => {
  it("survives a round trip through the columns it is stored in", () => {
    const before = live({
      path: ["main", "ocr", "ocr.read"],
      feature: "ocr.read",
      step: "awaiting_image",
      pending: { operation: "awaiting_image", startedAt: "2026-08-23T11:59:00Z" },
      context: { target: "keys" },
    });
    const columns = session.sessionColumns(before, new Date(NOW).toISOString());
    const after = session.readSession({
      nav_path: columns.nav_path,
      current_feature: columns.current_feature,
      current_step: columns.current_step,
      pending_operation: columns.pending_operation,
      session_context: columns.session_context,
      session_updated_at: columns.session_updated_at,
    });
    expect(after.path).toEqual(before.path);
    expect(after.feature).toBe(before.feature);
    expect(after.step).toBe(before.step);
    expect(after.pending?.operation).toBe("awaiting_image");
    expect(after.context).toEqual({ target: "keys" });
  });

  it("falls back to the main menu rather than throwing on a path it cannot read", () => {
    // A menu reorganised under somebody mid-conversation, or a corrupted column.
    for (const nav of [null, "not an array", [], ["nope"], ["ocr", "main"], ["main", "services", "ocr.read"]]) {
      const state = session.readSession({ nav_path: nav });
      expect(state.path, JSON.stringify(nav)).toEqual(["main"]);
    }
    expect(session.readSession(null).path).toEqual(["main"]);
    expect(session.readSession({ current_feature: "a feature that was deleted" }).feature).toBeNull();
  });

  it("writes only session state, never a preference and never a message", () => {
    const columns = session.sessionColumns(live(), new Date(NOW).toISOString());
    expect(Object.keys(columns).sort()).toEqual([
      "current_feature", "current_step", "nav_path",
      "pending_operation", "session_context", "session_updated_at",
    ]);
  });

  it("is stored in the table the conversation already lives in", () => {
    const migration = readFileSync(
      "supabase/migrations/20260920000000_whatsapp_navigation_state.sql",
      "utf8",
    );
    expect(migration).toContain("ALTER TABLE public.whatsapp_conversations");
    // No second table keyed on the same phone number.
    expect(migration).not.toMatch(/CREATE TABLE/i);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS/);
  });
});

// ── The webhook's half of the contract ──────────────────────────────────────

describe("the webhook stays thin", () => {
  it("still verifies Meta's handshake and signature before anything else", () => {
    // The two things that must never regress: the GET handshake that registers
    // the webhook, and the HMAC on every delivery.
    expect(webhook).toContain('Deno.env.get("WHATSAPP_VERIFY_TOKEN")');
    expect(webhook).toContain('mode === "subscribe"');
    expect(webhook).toContain("verifySignature(rawBody, req.headers.get(\"x-hub-signature-256\"), appSecret)");
    const signatureAt = webhook.indexOf("verifySignature(rawBody");
    expect(signatureAt).toBeLessThan(webhook.indexOf("const outcome = runEngine("));
    expect(signatureAt).toBeLessThan(webhook.indexOf("extractMessages(payload)"));
  });

  it("runs the engine after normalisation and before the feature pipeline", () => {
    const order = [
      "extractMessages(payload)",
      "wa_message_id: incoming.messageId",
      "const outcome = runEngine(",
      "parseVisionMode(questionText)",
    ];
    let previous = -1;
    for (const needle of order) {
      const at = webhook.indexOf(needle);
      expect(at, needle).toBeGreaterThan(previous);
      previous = at;
    }
  });

  it("persists the session on every route out of the engine", () => {
    // A route that answers without saving would lose the sender's place.
    const engineBlock = webhook.slice(
      webhook.indexOf("const outcome = runEngine("),
      webhook.indexOf("const aiFocused = assistantOwnsInput(session.feature);"),
    );
    const continues = engineBlock.match(/continue;/g)?.length ?? 0;
    const saves = engineBlock.match(/await saveSession\(\);/g)?.length ?? 0;
    expect(continues).toBeGreaterThan(0);
    expect(saves).toBeGreaterThanOrEqual(continues);
  });

  it("logs structurally, and never logs anything that identifies a person", () => {
    expect(webhook).toMatch(/console\.log\(JSON\.stringify\(\{/);
    expect(webhook).toContain("conversation: conversationId");
    expect(webhook).toContain("message: incoming.messageId");
    // The phone number and the message body are the two things that must never
    // reach a log line: this repository's CI logs are world-readable.
    const logBlock = webhook.slice(webhook.indexOf("const log = ("), webhook.indexOf("};", webhook.indexOf("const log = (")));
    expect(logBlock).not.toContain("incoming.from");
    expect(logBlock).not.toContain("questionText");
    expect(logBlock).not.toMatch(/token|secret|key/i);
  });


  it("logs the delivery, the route and the reply, with a duration on each", () => {
    for (const event of ["received", "route", "replied", "feature_error"]) {
      expect(webhook, event).toContain(`log("${event}"`);
    }
    // Duration and kind travel on every line, so one log tells the whole story.
    expect(webhook).toContain("ms: Date.now() - startedAt");
    expect(webhook).toContain("kind: engineMessageKind(incoming)");
    // Whether Meta accepted the reply, which is the response status.
    expect(webhook).toContain("log(\"replied\", { replyKind: kind, chars: body.length, sent })");
  });

  it("keeps the existing voice path in front of the engine, untouched", () => {
    // The engine must see the transcript, so transcription runs first — and
    // the voice reply still happens inside reply(), for every route.
    expect(webhook).toContain("transcribe: (input) => transcribeVoice(input),");
    expect(webhook).toContain("await speakReply({ phoneNumberId, token, to: incoming.from, text: body });");
    expect(webhook.indexOf("voiceToText(")).toBeLessThan(webhook.indexOf("const outcome = runEngine("));
  });

  it("declares which capabilities exist from the environment, not from a guess", () => {
    expect(webhook).toContain("function availableCapabilities(): Capability[]");
    expect(webhook).toContain("available: availableCapabilities()");
    // Keyless services are always available; the others are gated on a key.
    expect(webhook).toMatch(/const available: Capability\[\] = \["location", "bazaar"\]/);
  });
});
