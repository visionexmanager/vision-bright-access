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
import { isStuck, lifecycleOf } from "./whatsappLifecycle.ts";
import {
  comingSoonNotice,
  featureErrorNotice,
  footerFor,
  UI_STRINGS,
  type UiKey,
} from "./whatsappStrings.ts";
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
  | "feature_withdrawn"
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

// ── What the engine says ──────────────────────────────────────────────────
//
// Moved to `whatsappStrings.ts`, which every feature shares: a footer phrased
// one way in the main menu and another way three levels down is not a cosmetic
// difference, it is a person learning two systems. Re-exported under the name
// callers already use, so nothing had to be rewritten to follow it.

export const ENGINE_STRINGS = UI_STRINGS;

const say = (key: UiKey, language: Language): string => UI_STRINGS[key][language];
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

  // 3a. Work that says it is still running, long after it could be.
  //
  //     A delivery that died mid-request leaves the row saying `processing`
  //     with nothing behind it. The sender sees a state they cannot leave and
  //     cannot see, which is the one failure this whole lifecycle exists to
  //     prevent. Cleared, quietly: they were already told something went out,
  //     and a second apology for a message they may not remember is worse.
  if (isStuck(lifecycleOf(state.step), state.pending?.startedAt, context.nowMs)) {
    state = { ...state, step: null, pending: null };
  }
  // 3b. A feature switched off while somebody was standing in it.
  //
  //     Flags are read fresh on every delivery, so this is a real state: the
  //     session says `services.weather` and the configuration now says that
  //     is closed. Executing it would be the flag failing at the only moment
  //     it mattered, and leaving them there would strand them in a menu they
  //     cannot use. They are moved to the nearest place that still exists.
  const standing = nodeById(currentNodeId(state));
  if (standing && !isAvailable(standing, context.disabled ?? [])) {
    const refuge = nearestAvailable(standing, context.disabled ?? []);
    const next = enter(state, refuge.id);
    return {
      kind: "reply",
      replies: [{ type: "menu", nodeId: refuge.id, note: say("withdrawn", context.language) }],
      session: { ...next, feature: null, step: null, pending: null },
      reason: "feature_withdrawn",
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

/** The closest ancestor that is still available, or the root. */
function nearestAvailable(node: CatalogNode, disabled: readonly string[]): CatalogNode {
  let cursor: CatalogNode | null = nodeById(node.parent);
  while (cursor) {
    if (isAvailable(cursor, disabled)) return cursor;
    cursor = nodeById(cursor.parent);
  }
  return nodeById(ROOT_ID)!;
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
  const footer = footerFor(nodeId === ROOT_ID, language);

  return [header, "", ...lines, "", footer].join("\n");
}

// Re-exported: both sentences now live with the rest of the interface's words.
export { comingSoonNotice, featureErrorNotice };
