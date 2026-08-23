// The navigation engine: what a message means, given where the sender is.
//
// It decides and returns; it never sends, never writes and never calls a model.
// The webhook performs what comes back. That split is the whole design: every
// rule below — the back command, the timeout, an invalid number, a disabled
// feature, a tap on a row that no longer exists — is a pure function of
// (message, session, clock), so the suite exercises the real engine rather than
// a mock of it.
//
// Three outcomes, and the third is the important one:
//
//   reply       - the engine answered: a menu, an explanation, a refusal.
//   delegate    - a feature owns this message; the webhook runs its handler.
//   passthrough - not navigation. The existing conversational pipeline answers,
//                 exactly as it did before this engine existed.
//
// `passthrough` is why adding this layer did not change what already worked.
// Someone who has never seen the menu and just types a question is unaffected:
// nothing in their message matches a command or a number, so the engine steps
// out of the way.

import {
  childAt,
  childrenOf,
  isAvailable,
  type CatalogNode,
  type Capability,
  type Language,
  localized,
  nodeById,
  numberOf,
  ROOT_ID,
} from "./whatsappCatalog.ts";
import {
  foldDigits,
  isGreeting,
  type NavigationCommand,
  parseChoice,
  parseCommand,
} from "./whatsappCommands.ts";
import { resolveSelection } from "./whatsappRouter.ts";
import {
  cancelPending,
  currentNodeId,
  enter,
  goBack,
  goHome,
  isStale,
  type SessionState,
} from "./whatsappSession.ts";

/** What the engine is given about the message, whatever kind it was. */
export interface EngineMessage {
  /** Text, a caption, or the transcript of a voice note. Empty for a bare photo. */
  text: string;
  kind: "text" | "image" | "audio" | "document" | "video" | "location" | "interactive" | "unknown";
  /** The id of a tapped menu row, when the sender tapped rather than typed. */
  selection?: string;
}

export type EngineReply =
  | { type: "text"; text: string }
  /** A menu to render: the webhook decides list-or-text and language. */
  | { type: "menu"; nodeId: string; note?: string };

export type EngineOutcome =
  | { kind: "reply"; replies: EngineReply[]; session: SessionState; reason: EngineReason }
  | { kind: "delegate"; node: CatalogNode; session: SessionState; reason: EngineReason }
  | { kind: "passthrough"; session: SessionState; reason: EngineReason };

/** Why the engine did what it did. Logged, never shown to the sender. */
export type EngineReason =
  | "timeout_reset"
  | "greeting"
  | "menu_command"
  | "help_command"
  | "back_command"
  | "cancel_command"
  | "selection"
  | "invalid_selection"
  | "disabled_feature"
  | "missing_capability"
  | "named_feature"
  | "stale_selection"
  | "inside_feature"
  | "not_navigation";

/** Everything the engine needs to know about the outside world. */
export interface EngineContext {
  language: Language;
  nowMs: number;
  timeoutMs: number;
  /** Capabilities the environment actually has right now. */
  available: readonly Capability[];
  /**
   * Feature ids switched off in `site_settings`, live.
   *
   * Separate from the catalog's own `enabled`, which is about what has been
   * built. This is about what is answering today.
   */
  disabled?: readonly string[];
  /** True when this is the sender's first message ever. */
  isNewConversation: boolean;
}

// Re-exported so every existing caller keeps its import path: the words moved,
// the vocabulary did not.
export { foldDigits, isGreeting, parseChoice, parseCommand };
export type { NavigationCommand };

// ── The strings the engine itself says ────────────────────────────────────
//
// Everything user-visible is a function of the language, and the language comes
// from the session. There is no English default hiding in a template literal
// further down: a message the engine cannot say in the sender's language is a
// message this file may not send.

export const ENGINE_STRINGS = {
  invalidChoice: {
    ar: "لم أفهم هذا الاختيار. اختر رقماً من القائمة:",
    en: "I didn't recognise that option. Please choose one of these numbers:",
  },
  disabled: {
    ar: "هذه الخدمة لم تُفتح بعد. سأخبرك ما إن تصبح جاهزة — اختر رقماً آخر من القائمة:",
    en: "That service isn't open yet. I'll say so when it is — pick another number for now:",
  },
  unavailable: {
    ar: "هذه الخدمة غير متاحة الآن. جرّب رقماً آخر من القائمة:",
    en: "That one isn't available right now. Try another number:",
  },
  cancelled: {
    ar: "ألغيت العملية. أنت الآن هنا:",
    en: "Cancelled. You're here now:",
  },
  nothingToCancel: {
    ar: "لا يوجد شيء قيد التنفيذ. أنت هنا:",
    en: "There was nothing running. You're here:",
  },
  atMainMenu: {
    ar: "أنت في القائمة الرئيسية:",
    en: "You're at the main menu:",
  },
  timedOut: {
    ar: "مرّ وقت طويل، فبدأت من جديد. لغتك وإعداداتك كما هي.",
    en: "It had been a while, so I started fresh. Your language and settings are unchanged.",
  },
  staleSelection: {
    ar: "هذا الخيار لم يعد موجوداً. هذه القائمة الحالية:",
    en: "That option has moved. Here's the current menu:",
  },
  help: {
    ar: [
      "*كيف تتنقل*",
      "",
      "• أرسل *رقم* الخدمة لتفتحها",
      "• *0* للرجوع خطوة واحدة",
      "• *00* أو *قائمة* للقائمة الرئيسية",
      "• *#* أو *إلغاء* لإيقاف العملية الحالية",
      "• *مساعدة* لعرض هذا الشرح",
      "",
      "وتقدر دائماً تكتب سؤالك أو ترسله صوتياً بدون أي رقم.",
    ].join("\n"),
    en: [
      "*Getting around*",
      "",
      "• Send the *number* of a service to open it",
      "• *0* goes back one step",
      "• *00* or *menu* returns to the main menu",
      "• *#* or *cancel* stops what's running",
      "• *help* shows this again",
      "",
      "You can always just ask a question, typed or as a voice note, with no number at all.",
    ].join("\n"),
  },
} as const;

const say = (key: keyof typeof ENGINE_STRINGS, language: Language): string =>
  ENGINE_STRINGS[key][language];

// ── The engine ────────────────────────────────────────────────────────────

/**
 * Decide what a message means.
 *
 * Order is the correctness argument, and it runs from least to most ambiguous:
 * a stale session is reset before anything is read out of it; an explicit
 * command beats a number; a number beats free text; free text belongs to
 * whoever owns the conversation, which is a feature if one is open and the
 * existing assistant if not.
 */
export function runEngine(message: EngineMessage, session: SessionState, context: EngineContext): EngineOutcome {
  // 1. A session nobody has touched for a while carries state the sender has
  //    long forgotten. Dropping it is kinder than acting on it — and the
  //    preference columns are elsewhere, so nothing they set is lost.
  let state = session;
  let timedOut = false;
  if (isStale(state, context.nowMs, context.timeoutMs)) {
    state = goHome(state);
    timedOut = true;
  }

  // 2. A tapped row. Unambiguous whenever it arrives, so it is honoured
  //    without a freshness window — but an old menu can name a row this build
  //    no longer has, and that is not the sender's mistake to apologise for.
  if (message.selection) {
    const node = nodeById(message.selection);
    if (!node || node.hidden) {
      return {
        kind: "reply",
        replies: [{ type: "menu", nodeId: currentNodeId(state), note: say("staleSelection", context.language) }],
        session: state,
        reason: "stale_selection",
      };
    }
    return openNode(node, state, context);
  }

  const command = parseCommand(message.text);

  // 3. A session that timed out is announced before anything is read out of
  //    it. The sender is about to be somewhere other than where they left off,
  //    and a menu appearing with no explanation reads as the assistant having
  //    lost the thread. Placed above the greeting rule because "hello?" after
  //    an hour away is exactly this case.
  if (timedOut) {
    const replies: EngineReply[] = [{ type: "menu", nodeId: ROOT_ID, note: say("timedOut", context.language) }];
    if (command === "help") replies.push({ type: "text", text: say("help", context.language) });
    return { kind: "reply", replies, session: state, reason: "timeout_reset" };
  }

  // 4. A greeting, or a first message with nothing in it but hello: the menu
  //    is the answer, because "hi" is a question about what is on offer.
  //
  //    A first message that is a real question is deliberately *not* answered
  //    with a menu. Somebody who opens with "how much is the subscription"
  //    asked something, and replying with ten numbered options instead of the
  //    price is the kind of helpfulness nobody wants. They get the answer; the
  //    welcome that went out just above tells them the menu exists.
  if (!command && isGreeting(message.text)) {
    return {
      kind: "reply",
      replies: [{ type: "menu", nodeId: ROOT_ID }],
      session: goHome(state),
      reason: context.isNewConversation ? "greeting" : "menu_command",
    };
  }

  if (!command && context.isNewConversation && !message.text.trim() && message.kind === "unknown") {
    return {
      kind: "reply",
      replies: [{ type: "menu", nodeId: ROOT_ID }],
      session: goHome(state),
      reason: "greeting",
    };
  }

  // 4. The universal commands.
  if (command === "help") {
    return {
      kind: "reply",
      replies: [{ type: "text", text: say("help", context.language) }],
      session: state,
      reason: "help_command",
    };
  }

  if (command === "home") {
    return {
      kind: "reply",
      replies: [{ type: "menu", nodeId: ROOT_ID }],
      session: goHome(state),
      reason: "menu_command",
    };
  }

  if (command === "back") {
    const atRoot = state.path.length <= 1;
    const next = goBack(state);
    return {
      kind: "reply",
      replies: [{
        type: "menu",
        nodeId: currentNodeId(next),
        note: atRoot ? say("atMainMenu", context.language) : undefined,
      }],
      session: next,
      reason: "back_command",
    };
  }

  if (command === "cancel") {
    const had = !!state.pending || !!state.step;
    const next = cancelPending(state);
    return {
      kind: "reply",
      replies: [{
        type: "menu",
        nodeId: currentNodeId(next),
        note: say(had ? "cancelled" : "nothingToCancel", context.language),
      }],
      session: next,
      reason: "cancel_command",
    };
  }

  // 5. Everything else goes to the router, which is the only thing that turns a
  //    message into a feature id. A number is read against the menu the sender
  //    is looking at — inside a feature that means the menu the feature sits in,
  //    so "2" after opening the wrong one is a correction rather than a dead
  //    end. A tapped row and a named feature come back through the same call.
  const menuId = state.feature ? (nodeById(state.feature)?.parent ?? ROOT_ID) : currentNodeId(state);
  const routed = resolveSelection({
    menuId,
    text: message.text,
    selection: message.selection,
    language: context.language,
    disabled: context.disabled ?? [],
    available: context.available,
  });

  if (routed.kind === "invalid") {
    return {
      kind: "reply",
      replies: [{ type: "menu", nodeId: routed.menuId, note: say("invalidChoice", context.language) }],
      // Emphatically not a reset: an invalid number is a typo, and throwing
      // somebody back to the main menu for a typo is how a menu becomes a maze.
      session: state,
      reason: "invalid_selection",
    };
  }

  if (routed.kind === "unavailable") {
    // Resolved first, refused second — including when it was *named* rather
    // than numbered, which is what stops a word being a way around a flag.
    return {
      kind: "reply",
      replies: [{
        type: "menu",
        nodeId: routed.parentId,
        note: say(routed.reason === "disabled" ? "disabled" : "unavailable", context.language),
      }],
      session: state,
      reason: routed.reason === "disabled" ? "disabled_feature" : "missing_capability",
    };
  }

  if (routed.kind === "feature") {
    // A number or a tap opens the feature and moves the sender into it. A word
    // does not, and — while a feature is open — a word does not even preempt
    // it: somebody inside Ask AI who types "weather" asked the assistant about
    // the weather. The feature holding the floor keeps it until they leave.
    if (routed.via === "alias") {
      const open = nodeById(state.feature);
      if (open) return { kind: "delegate", node: open, session: state, reason: "inside_feature" };
      return { kind: "passthrough", session: state, reason: "named_feature" };
    }
    return openNode(routed.node, state, context);
  }

  // 6. Not a command, not a feature. If a feature is open it owns this, and if
  //    it does not accept this kind of message the feature says so — the engine
  //    does not guess on its behalf.
  const feature = nodeById(state.feature);
  if (feature) {
    return { kind: "delegate", node: feature, session: state, reason: "inside_feature" };
  }

  // 7. Nothing here claims it. The conversational pipeline answers, exactly as
  //    it did before this engine existed.
  return { kind: "passthrough", session: state, reason: "not_navigation" };

}

/** Opening a node: a menu is shown, an action is checked and then delegated. */
function openNode(node: CatalogNode, session: SessionState, context: EngineContext): EngineOutcome {
  const parentId = node.parent ?? ROOT_ID;

  if (!isAvailable(node, context.disabled ?? [])) {
    return {
      kind: "reply",
      // Shown against the parent the sender is standing in, never against the
      // node they may not open.
      replies: [{ type: "menu", nodeId: parentId, note: say("disabled", context.language) }],
      session,
      reason: "disabled_feature",
    };
  }

  const missing = (node.requires ?? []).filter((capability) => !context.available.includes(capability));
  if (missing.length > 0) {
    // Named in the log, never to the sender: "the vision provider has no key"
    // is a fact about Visionex's billing, not something they can act on.
    return {
      kind: "reply",
      replies: [{ type: "menu", nodeId: parentId, note: say("unavailable", context.language) }],
      session,
      reason: "missing_capability",
    };
  }

  const next = enter(session, node.id);

  if (node.kind === "menu") {
    return { kind: "reply", replies: [{ type: "menu", nodeId: node.id }], session: next, reason: "selection" };
  }

  return { kind: "delegate", node, session: next, reason: "selection" };
}

// ── Rendering ─────────────────────────────────────────────────────────────

/**
 * A menu as text.
 *
 * Numbered lines, one per child, with the number first because that is what the
 * sender has to send back. The emoji trails the words and carries nothing: a
 * screen reader that announces it says the name first, and one that skips it
 * loses nothing at all.
 */
export function renderMenu(
  nodeId: string,
  language: Language,
  disabled: readonly string[] = [],
): string {
  const node = nodeById(nodeId);
  if (!node) return "";
  const children = childrenOf(nodeId);

  const lines = children.map((child) => {
    const number = numberOf(child);
    const title = localized(child.title, language);
    const description = localized(child.description, language);
    const tail = isAvailable(child, disabled) ? "" : (language === "ar" ? " (قريباً)" : " (coming soon)");
    return `${number}. ${title}${child.emoji ? ` ${child.emoji}` : ""} — ${description}${tail}`;
  });

  const header = `*${localized(node.title, language)}*`;
  const footer = nodeId === ROOT_ID
    ? (language === "ar"
      ? "أرسل الرقم فقط. اكتب «مساعدة» لمعرفة بقية الأوامر."
      : "Just send the number. Say \"help\" for the other commands.")
    : (language === "ar"
      // Both ways out are named, every time. A submenu that only mentions 0
      // leaves somebody three levels down counting their way back.
      ? "أرسل الرقم، أو *0* للرجوع، أو *00* للقائمة الرئيسية."
      : "Send the number, *0* to go back, or *00* for the main menu.");

  return [header, "", ...lines, "", footer].join("\n");
}

/** A feature that is declared and announced but not built yet. */
export function comingSoonNotice(language: Language, title: string): string {
  return language === "ar"
    ? `«${title}» لم تُفتح بعد — سأخبرك ما إن تصبح جاهزة. اكتب «0» للرجوع أو «قائمة» للقائمة الرئيسية.`
    : `"${title}" isn't open yet — I'll say so when it is. Send 0 to go back, or "menu" for the main menu.`;
}

/**
 * What a failed feature says.
 *
 * No error code, no provider name, no stack: none of it is actionable by the
 * person reading it, and some of it would be a leak. The technical detail goes
 * to the log, and the sender is told what to do next instead.
 */
export function featureErrorNotice(language: Language): string {
  return language === "ar"
    ? "تعذّر إتمام هذه الخدمة الآن. جرّب مرة أخرى، أو اختر رقماً آخر من القائمة."
    : "Sorry — that didn't go through. Please try again, or pick another number from the menu.";
}
