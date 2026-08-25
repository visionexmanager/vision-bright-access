// Phase 8 — the WhatsApp channel audited as one system.
//
// Each earlier phase has its own suite and each proves its own piece. This one
// asks the question none of them can: do the pieces agree?
//
// The failures it is looking for are the ones that appear only at a seam — two
// resolvers that answer a tap differently, a flag that stops a menu row but not
// the word for it, a knowledge directive that promises a feature the router
// would refuse, an observability layer wrapped around a code path that is not
// the one production runs. Every one of those passes a per-module test.
//
// So the shape here is deliberately structural: it walks the real catalog, the
// real router, the real engine and the real webhook source, and asserts they
// name the same things.

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { Capability } from "../../supabase/functions/_shared/whatsappCatalog.ts";
import type { EngineContext } from "../../supabase/functions/_shared/whatsappEngine.ts";
import type { SessionState } from "../../supabase/functions/_shared/whatsappSession.ts";

const catalog = await import("../../supabase/functions/_shared/whatsappCatalog.ts");
const router = await import("../../supabase/functions/_shared/whatsappRouter.ts");
const engine = await import("../../supabase/functions/_shared/whatsappEngine.ts");
const sessions = await import("../../supabase/functions/_shared/whatsappSession.ts");
const interactive = await import("../../supabase/functions/_shared/whatsappInteractive.ts");
const knowledge = await import("../../supabase/functions/_shared/whatsappKnowledge.ts");
const safety = await import("../../supabase/functions/_shared/whatsappSafety.ts");
const telemetry = await import("../../supabase/functions/_shared/whatsappTelemetry.ts");
const reliability = await import("../../supabase/functions/_shared/whatsappReliability.ts");
const voice = await import("../../supabase/functions/_shared/whatsappVoiceReply.ts");

const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
const engineSource = readFileSync("supabase/functions/_shared/whatsappEngine.ts", "utf8");
const NL = String.fromCharCode(10);

const ALL: Capability[] = ["ai", "vision", "speech_to_text", "text_to_speech", "location", "bazaar"];
const NOW = Date.parse("2026-08-25T12:00:00Z");

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

/** Every node in the tree, as the tests below walk it. */
const everyNode = catalog.CATALOG.filter((n) => !n.hidden);
const everyAction = everyNode.filter((n) => n.kind === "action");
const everyMenu = [catalog.ROOT_ID, ...everyNode.filter((n) => n.kind === "menu").map((n) => n.id)];

/**
 * The rows a menu offers, by id.
 *
 * Read off the interactive payload rather than out of the text, because a
 * menu's *description* legitimately names the things underneath it — the
 * Services body reads "Weather, location…" — and matching on words would call
 * that a leak.
 */
const rowIdsOf = (nodeId: string, disabled: readonly string[] = []): string[] => {
  const message = interactive.menuMessage(nodeId, "en", disabled);
  if (!message) return [];
  const rows = message.interactive.type === "list"
    ? message.interactive.action.sections[0].rows.map((r) => r.id)
    : message.interactive.action.buttons.map((b) => b.reply.id);
  return rows.filter((id) => safety.selectionScope(id) === "catalog");
};

/** Source with its prose stripped: these checks are about what the code does. */
const codeOf = (source: string) =>
  source
    .split(NL)
    .filter((line) => {
      const t = line.trim();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join(NL);

// ── 1. Exactly one router ────────────────────────────────────────────────────

describe("there is one authoritative router", () => {
  it("is the only module that turns a message into a feature id", () => {
    const routerSource = readFileSync("supabase/functions/_shared/whatsappRouter.ts", "utf8");
    expect(routerSource).toContain("export function resolveSelection");
    // Nothing else exports a resolver.
    for (const name of ["whatsappEngine", "whatsappCatalog", "whatsappCommands", "whatsappInteractive"]) {
      const source = readFileSync(`supabase/functions/_shared/${name}.ts`, "utf8");
      expect(source, name).not.toContain("export function resolveSelection");
    }
  });

  it("is what the engine asks about a tap", () => {
    expect(codeOf(engineSource)).not.toContain("nodeById(message.selection)");
    expect(codeOf(engineSource).match(/resolveSelection\(\{/g)?.length).toBe(2);
  });

  it("is what the webhook reaches only through the engine", () => {
    // The webhook must not resolve a selection itself; it runs what the engine
    // decided. The one selection it reads directly is the language row, which
    // is not a feature and has no catalog node.
    expect(webhook).not.toContain("resolveSelection(");
    expect(webhook).toContain("const outcome = runEngine(");
  });

  it("gives a tap, a number and a word the same answer about the same feature", () => {
    for (const node of everyAction) {
      const menuId = node.parent ?? catalog.ROOT_ID;
      const disabled = [node.id];
      const byTap = router.resolveSelection({
        menuId, text: "", selection: node.id, language: "en", disabled, available: ALL,
      });
      const number = catalog.childrenOf(menuId).findIndex((c) => c.id === node.id) + 1;
      const byNumber = router.resolveSelection({
        menuId, text: String(number), language: "en", disabled, available: ALL,
      });
      const byName = router.resolveSelection({
        menuId, text: catalog.localized(node.title, "en"), language: "en", disabled, available: ALL,
      });
      for (const [label, routed] of [["tap", byTap], ["number", byNumber], ["name", byName]] as const) {
        expect(routed.kind, `${node.id} by ${label}`).toBe("unavailable");
      }
    }
  });
});

// ── 2. Exactly one delivery-medium policy ────────────────────────────────────

describe("there is one authoritative delivery-medium policy", () => {
  it("is `replyMedium`, and the webhook never decides for itself", () => {
    expect(webhook).not.toContain('medium: spokenInput ? "voice" : "text"');
    expect(webhook).not.toMatch(/medium:\s*"voice"\s*:/);
    // Every medium written into an object literal comes from the policy or from
    // what a delivery actually reported.
    //
    // The two `.update({ medium: "text" })` corrections are removed first
    // rather than pattern-matched around: they are not the policy deciding
    // anything, they are the row being told the truth after a spoken send
    // failed, and they are asserted on their own below.
    const withoutCorrections = webhook.split('.update({ medium: "text" })').join("");
    const assignments = [...withoutCorrections.matchAll(/medium: ([^,\n}]+)/g)].map((m) => m[1].trim());
    expect(assignments.length).toBeGreaterThan(2);
    for (const value of assignments) {
      expect(
        value.startsWith("replyMedium(")
          || value === "medium"
          || value === "delivered.medium"
          || value === "shown.medium"
          || value === '"voice"', // the transcript correction on a heard voice note
        value,
      ).toBe(true);
    }
  });

  it("keeps the contract: the medium of the answer is the medium of the question", () => {
    expect(voice.replyMedium({ spokenInput: true, body: "spoken back" })).toBe("voice");
    expect(voice.replyMedium({ spokenInput: false, body: "written back" })).toBe("text");
  });

  it("consults no stored preference, at any layer", () => {
    const source = readFileSync("supabase/functions/_shared/whatsappVoiceReply.ts", "utf8");
    const fn = source.slice(source.indexOf("export function replyMedium"));
    const body = fn.slice(0, fn.indexOf(NL + "}"));
    for (const forbidden of ["voice_mode", "voiceMode", "always", "never", "preference"]) {
      expect(body, forbidden).not.toContain(forbidden);
    }
  });

  it("corrects the row on both paths when a spoken send failed", () => {
    expect(webhook).toContain('.update({ medium: "text" }).eq("id", written.id)');
    expect(webhook).toContain('.update({ medium: "text" }).eq("id", menuRow.id)');
  });
});

// ── 3. One vocabulary of feature ids ─────────────────────────────────────────

describe("everything names features by the same stable ids", () => {
  it("uses ids the catalog has, everywhere the webhook names one", () => {
    for (const [, id] of webhook.matchAll(/featureOn\("([^"]+)"\)/g)) {
      expect(catalog.nodeById(id), id).not.toBeNull();
    }
    for (const [, id] of webhook.matchAll(/currentNodeId\(session\) === "([^"]+)"/g)) {
      expect(catalog.nodeById(id), id).not.toBeNull();
    }
  });

  it("gates a feature by id in the flag layer, the router and the knowledge layer", () => {
    const id = "services.weather";
    expect(catalog.isAvailable(catalog.nodeById(id), [id])).toBe(false);
    expect(router.resolveSelection({
      menuId: "services", text: "", selection: id, language: "en", disabled: [id], available: ALL,
    }).kind).toBe("unavailable");
    expect(knowledge.availableFeatures("en", [id], ALL).map((f) => f.id)).not.toContain(id);
    expect(rowIdsOf("services", [id])).not.toContain(id);
  });

  it("uses no numbers as identity anywhere that is persisted", () => {
    const state = sessions.enter(sessions.freshSession(), "services.weather");
    const columns = sessions.sessionColumns(state, new Date(NOW).toISOString());
    expect(columns.current_feature).toBe("services.weather");
    expect(columns.nav_path).toEqual(["main", "services", "services.weather"]);
    for (const value of Object.values(columns)) {
      expect(typeof value === "number", JSON.stringify(value)).toBe(false);
    }
  });

  it("keeps every catalog id a shape the security layer calls a feature", () => {
    for (const node of everyNode) {
      expect(safety.selectionScope(node.id), node.id).toBe("catalog");
    }
  });

  it("declares a capability the environment check can actually supply", () => {
    const supplied = new Set(ALL);
    for (const node of everyNode) {
      for (const capability of node.requires ?? []) {
        expect(supplied.has(capability), `${node.id} needs ${capability}`).toBe(true);
      }
    }
  });
});

// ── 4. Knowledge goes through the same gates ─────────────────────────────────

describe("knowledge cannot promise what the router would refuse", () => {
  it("lists only features a tap would actually open", () => {
    for (const feature of knowledge.availableFeatures("en", [], ALL)) {
      const node = catalog.nodeById(feature.id)!;
      const routed = router.resolveSelection({
        menuId: node.parent ?? catalog.ROOT_ID,
        text: "",
        selection: feature.id,
        language: "en",
        available: ALL,
      });
      expect(routed.kind, feature.id).toBe("feature");
    }
  });

  it("drops a feature the moment a flag drops it from the menu", () => {
    for (const id of ["services", "ocr", "assistant", "services.weather"]) {
      const listed = knowledge.availableFeatures("en", [id], ALL).map((f) => f.id);
      const shown = rowIdsOf(catalog.nodeById(id)?.parent ?? catalog.ROOT_ID, [id]);
      expect(listed, id).not.toContain(id);
      expect(shown, id).not.toContain(id);
    }
  });

  it("drops a feature whose capability the deployment does not have", () => {
    const noVision = knowledge.availableFeatures("en", [], ["ai", "location", "bazaar"]);
    for (const feature of noVision) {
      const routed = router.resolveSelection({
        menuId: catalog.nodeById(feature.id)!.parent ?? catalog.ROOT_ID,
        text: "",
        selection: feature.id,
        language: "en",
        available: ["ai", "location", "bazaar"],
      });
      expect(routed.kind, feature.id).toBe("feature");
    }
  });

  it("is built from the live flags and capabilities in production, not from a constant", () => {
    expect(webhook).toContain("catalogDirective(availableFeatures(answerIn, disabled, availableCapabilities()))");
  });

  it("leaves the handlers authoritative about live data", () => {
    for (const owned of ["weather", "bazaar", "person"]) {
      expect(knowledge.HANDLER_AUTHORITY_DIRECTIVE.toLowerCase()).toContain(owned);
    }
    // And those handlers really are behind the flag gate in the webhook.
    for (const gate of ['featureOn("services.weather")', 'featureOn("services.bazaar")', 'featureOn("ocr")']) {
      expect(webhook, gate).toContain(gate);
    }
  });
});

// ── 5. Observability and reliability wrap the production path ────────────────

describe("the wrappers are around the code that actually runs", () => {
  it("logs from inside the one message loop, not from a helper beside it", () => {
    const loopStart = webhook.indexOf("for (const incoming of messages)");
    expect(webhook.indexOf("const log = createTelemetry(")).toBeGreaterThan(loopStart);
    expect(webhook.indexOf("const correlationId = newCorrelationId();")).toBeGreaterThan(loopStart);
  });

  it("claims, works and closes inside the same try/finally", () => {
    const loop = webhook.slice(webhook.indexOf("for (const incoming of messages)"));
    const claim = loop.indexOf("claimedMessageId = incoming.messageId;");
    const finallyAt = loop.indexOf("} finally {");
    expect(claim).toBeGreaterThan(0);
    expect(finallyAt).toBeGreaterThan(claim);
    expect(loop.indexOf('.update({ processing_state: "done" })')).toBeGreaterThan(finallyAt);
  });

  it("puts the claim ahead of every provider the delivery could pay for", () => {
    const claim = webhook.indexOf("const claimedAt = new Date().toISOString();");
    for (const spend of ["retrieveKnowledge(", "askAssistant(", "voiceToText(", "speakReply(", "understandImage("]) {
      expect(claim, spend).toBeLessThan(webhook.indexOf(spend));
    }
  });

  it("has one logger, and every event goes through it", () => {
    // A stray `console.log(JSON.stringify(...))` would be a second, unfiltered
    // structured log.
    expect(webhook).not.toContain("console.log(JSON.stringify({");
    expect(webhook.match(/\blog\(/g)?.length ?? 0).toBeGreaterThan(10);
  });

  it("uses only allowlisted field names, in every log call the webhook makes", () => {
    const allowed = new Set(telemetry.TELEMETRY_FIELDS);
    for (const [, , body] of webhook.matchAll(/\blog(?:\.fail)?\("([a-z_]+)",\s*(?:[a-zA-Z]+,\s*)?\{([^}]*)\}/g)) {
      for (const [, key] of (body ?? "").matchAll(/(?:^|,)\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/g)) {
        expect(allowed.has(key), key).toBe(true);
      }
    }
  });
});

// ── 6. No duplicate or conflicting implementations ───────────────────────────

describe("nothing is implemented twice", () => {
  it("renders a menu's text in exactly one place", () => {
    expect(engineSource).toContain('return menuMessage(nodeId, language, disabled)?.text ?? "";');
    const interactiveSource = readFileSync("supabase/functions/_shared/whatsappInteractive.ts", "utf8");
    expect(interactiveSource.match(/function asText\(/g)?.length).toBe(1);
  });

  it("decides which rows a menu offers in exactly one place", () => {
    const interactiveSource = readFileSync("supabase/functions/_shared/whatsappInteractive.ts", "utf8");
    expect(interactiveSource).toContain("offeredChildrenOf(nodeId, disabled)");
    expect(interactiveSource).not.toContain("LIST_LIMITS.rows - controls.length");
    // The router asks the same function whether a tapped id was ever offered.
    expect(readFileSync("supabase/functions/_shared/whatsappRouter.ts", "utf8")).toContain("isOffered(node)");
  });

  it("keeps one definition of what a universal command is", () => {
    const commands = readFileSync("supabase/functions/_shared/whatsappCommands.ts", "utf8");
    expect(commands).toContain("export function parseCommand");
    for (const name of ["whatsappEngine", "whatsappRouter"]) {
      const source = readFileSync(`supabase/functions/_shared/${name}.ts`, "utf8");
      expect(source, name).not.toContain("export function parseCommand(");
    }
  });

  it("keeps one definition of what is safe to strip from text", () => {
    // `stripInvisible` is used by the question check and by the passage
    // sanitiser; a second inline character class would be a second answer.
    const assistant = readFileSync("supabase/functions/_shared/whatsappAssistant.ts", "utf8");
    expect(assistant).toContain("stripInvisible(raw ?? \"\")");
    expect(codeOf(assistant)).not.toMatch(/u0000-/);
  });

  it("keeps one definition of a grapheme-safe cut", () => {
    for (const name of ["whatsapp", "whatsappAssistant", "whatsappVoiceReply"]) {
      const source = readFileSync(`supabase/functions/_shared/${name}.ts`, "utf8");
      expect(source, name).toContain("clampUnits(");
      expect(source, name).toContain('from "./whatsappSafety.ts"');
    }
  });

  it("keeps one definition of how an error becomes a log line", () => {
    expect(webhook).not.toContain("e instanceof Error ? e.message");
    expect(webhook.match(/describeError\(/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
  });
});

// ── 7. Migrations ────────────────────────────────────────────────────────────

describe("the migrations are consistent", () => {
  const files = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql"));

  it("has no duplicate version or name", () => {
    const versions = files.map((f) => f.split("_")[0]);
    expect(new Set(versions).size, "duplicate version prefix").toBe(versions.length);
    expect(new Set(files).size).toBe(files.length);
  });

  it("adds no column that another WhatsApp migration already adds", () => {
    const added = new Map<string, string>();
    for (const file of files.filter((f) => f.includes("whatsapp"))) {
      const sql = readFileSync(`supabase/migrations/${file}`, "utf8");
      let table = "";
      for (const line of sql.split(NL)) {
        const alter = line.match(/ALTER TABLE\s+public\.(\w+)/i);
        if (alter) table = alter[1];
        const column = line.match(/ADD COLUMN IF NOT EXISTS\s+(\w+)/i);
        if (column && table) {
          const key = `${table}.${column[1]}`;
          expect(added.has(key), `${key} added twice (${added.get(key)} and ${file})`).toBe(false);
          added.set(key, file);
        }
      }
    }
    expect(added.size).toBeGreaterThan(0);
  });

  it("creates no index name twice", () => {
    const indexes = new Map<string, string>();
    for (const file of files) {
      const sql = readFileSync(`supabase/migrations/${file}`, "utf8");
      for (const [, name] of sql.matchAll(/CREATE INDEX IF NOT EXISTS\s+(\w+)/gi)) {
        const previous = indexes.get(name);
        // The same name in the same file twice would be the real conflict; the
        // same name across files is how `IF NOT EXISTS` is meant to be used.
        expect(previous !== file, `${name} created twice in ${file}`).toBe(true);
        indexes.set(name, file);
      }
    }
  });

  it("writes every column the webhook reads from the session", () => {
    const columns = sessions.sessionColumns(sessions.freshSession(), new Date(NOW).toISOString());
    const navigation = readFileSync("supabase/migrations/20260920000000_whatsapp_navigation_state.sql", "utf8");
    for (const column of Object.keys(columns)) {
      expect(navigation, column).toContain(column);
    }
  });

  it("has a migration for the recovery columns the code writes", () => {
    const recovery = readFileSync("supabase/migrations/20260924000000_whatsapp_processing_recovery.sql", "utf8");
    for (const column of ["processing_state", "processing_started_at"]) {
      expect(recovery, column).toContain(column);
      expect(webhook, column).toContain(column);
    }
  });
});

// ── 8. The whole thing, walked ───────────────────────────────────────────────

describe("the combined system", () => {
  it("opens every menu, in every direction, without losing the way out", () => {
    for (const menuId of everyMenu) {
      const state = live({ path: catalog.pathTo(menuId) });
      const back = engine.runEngine({ text: "", kind: "interactive", selection: "back" }, state, context());
      expect(back.kind, menuId).toBe("reply");
      const home = engine.runEngine({ text: "", kind: "interactive", selection: "main_menu" }, state, context());
      expect(home.session.path, menuId).toEqual(["main"]);
    }
  });

  it("reaches every action node by tapping, from where it lives", () => {
    for (const node of everyAction) {
      const parent = node.parent ?? catalog.ROOT_ID;
      const outcome = engine.runEngine(
        { text: "", kind: "interactive", selection: node.id },
        live({ path: catalog.pathTo(parent) }),
        context(),
      );
      // Either it opens, or it is refused for a reason it declares itself.
      if (outcome.kind === "delegate") {
        expect(outcome.node.id).toBe(node.id);
      } else {
        expect(["disabled_feature", "missing_capability", "selection"], node.id).toContain(outcome.reason);
      }
    }
  });

  it("survives a hostile message on every route without throwing", () => {
    const hostile = [
      { text: "x".repeat(100_000), kind: "text" as const },
      { text: "", kind: "interactive" as const, selection: "__proto__" },
      { text: String.fromCharCode(0).repeat(50), kind: "text" as const },
      { text: "", kind: "unknown" as const },
      { text: "\uD800", kind: "text" as const },
    ];
    for (const message of hostile) {
      for (const menuId of everyMenu) {
        expect(
          () => engine.runEngine(message, live({ path: catalog.pathTo(menuId) }), context()),
          `${menuId} / ${message.kind}`,
        ).not.toThrow();
      }
    }
  });

  it("fails every feature closed, on every menu, when configuration is unreadable", () => {
    for (const node of everyAction) {
      const outcome = engine.runEngine(
        { text: "", kind: "interactive", selection: node.id },
        live({ path: catalog.pathTo(node.parent ?? catalog.ROOT_ID) }),
        context({ configVerified: false }),
      );
      expect(outcome.kind, node.id).toBe("reply");
      expect(
        ["unverified_config", "disabled_feature", "missing_capability"],
        node.id,
      ).toContain(outcome.reason);
    }
  });

  it("keeps every module free of the things none of them may hold", () => {
    const modules = readdirSync("supabase/functions/_shared").filter((f) => f.startsWith("whatsapp"));
    for (const file of modules) {
      const source = readFileSync(`supabase/functions/_shared/${file}`, "utf8");
      // No credential, and no hard-coded phone number.
      expect(source, file).not.toMatch(/sk-[A-Za-z0-9]{16,}/);
      expect(source, file).not.toMatch(/EAA[A-Za-z0-9]{20,}/);
      expect(source, file).not.toMatch(/\+9627\d{8}/);
    }
  });

  it("keeps the pure modules pure", () => {
    // These are imported by the app's TypeScript project through the suite, so
    // a `Deno` global or a fetch in one of them breaks the build for everything.
    for (const file of [
      "whatsappCatalog.ts", "whatsappRouter.ts", "whatsappCommands.ts",
      "whatsappSession.ts", "whatsappProfile.ts", "whatsappKnowledge.ts",
      "whatsappReliability.ts", "whatsappTelemetry.ts",
    ]) {
      const source = codeOf(readFileSync(`supabase/functions/_shared/${file}`, "utf8"));
      expect(source, file).not.toMatch(/\bfetch\(/);
      expect(source, file).not.toMatch(/\bDeno\.\w/);
    }
  });

  it("keeps the safety module dependency-free, so everything can import it", () => {
    const source = readFileSync("supabase/functions/_shared/whatsappSafety.ts", "utf8");
    expect(source).not.toMatch(/^import /m);
  });

  it("agrees about the recovery window across the modules that care", () => {
    expect(reliability.RECOVERY_AFTER_MS).toBeGreaterThan(knowledge.RETRIEVAL_TIMEOUT_MS);
    expect(reliability.RECOVERY_AFTER_MS).toBeGreaterThan(reliability.CLASSIFY_TIMEOUT_MS);
    expect(reliability.RECOVERY_AFTER_MS).toBeGreaterThan(reliability.SUMMARY_TIMEOUT_MS);
  });
});
