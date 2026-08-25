// One question, asked in one place: which feature should receive this?
//
// The catalog says what exists. The session says where the sender is. This says
// what a given message means against those two — and it is the only thing that
// says it. A number, a tapped row and a spoken word all arrive here and leave
// as the same stable feature id, so a feature reached three ways cannot behave
// three ways.
//
// What this file deliberately does not contain: any feature's logic. No weather,
// no camera, no bazaar, no model call, no transcription, no secret. It reads
// text and returns an identifier. Everything downstream of that decision lives
// with the feature it belongs to, and a test asserts this file stays that way.
//
// ── Why numbers are not identity ─────────────────────────────────────────────
//
// A number is where a row is printed today. `nav_path` and `current_feature`
// are written to a database and read back days later, so they hold ids —
// "services.weather", never "8.1". Reordering the menu is then a one-line edit
// that breaks nobody's session, and renaming a label breaks nothing at all.

import {
  aliasesOf,
  CATALOG,
  childAt,
  childrenOf,
  type CatalogNode,
  type Capability,
  isAvailable,
  isOffered,
  type Language,
  localized,
  nodeById,
  ROOT_ID,
} from "./whatsappCatalog.ts";
import {
  foldDigits,
  localisedCommand,
  type NavigationCommand,
  parseChoice,
  parseCommand,
  parseControlId,
} from "./whatsappCommands.ts";
import { selectionScope } from "./whatsappSafety.ts";

/** Everything the router needs. No session object: only the menu in view. */
export interface RouterInput {
  /** The menu the number should be read against. */
  menuId: string;
  /** What the sender sent, transcribed if it was spoken. */
  text: string;
  /** The id of a tapped row, when they tapped instead of typing. */
  selection?: string;
  language: Language;
  /** Feature ids switched off in production configuration. */
  disabled?: readonly string[];
  /** Capabilities this deployment actually has. */
  available?: readonly Capability[];
  /**
   * Whether the feature configuration was actually read this delivery.
   *
   * False when the settings row could not be fetched. A missing answer is not
   * the same as "nothing is switched off": a flag exists precisely for the
   * minutes when a feature must not run, and those are the minutes a database
   * is most likely to be the thing that is unwell. So an unverified
   * configuration refuses every feature rather than assuming the permissive
   * case. Navigation, help and the way back are unaffected — the sender can
   * still move around and still be told why.
   *
   * Defaulted to `true` so every existing caller and every test keeps its
   * meaning; the webhook is what passes `false`, and only when it has to.
   */
  configVerified?: boolean;
}

/** How a feature was named. Logged, and used to decide how far to move. */
export type RoutedVia = "number" | "tap" | "name" | "alias";

export type Routing =
  /** A universal command: back, home, cancel, help. Never a feature. */
  | { kind: "command"; command: NavigationCommand }
  /** A feature the sender may open right now. */
  | { kind: "feature"; featureId: string; node: CatalogNode; parentId: string; via: RoutedVia }
  /**
   * A real feature that cannot run: switched off in configuration, or missing
   * a capability this deployment does not have. Resolved *first* and refused
   * second, which is what stops a word being a way around a flag.
   */
  | {
    kind: "unavailable";
    featureId: string;
    node: CatalogNode;
    parentId: string;
    via: RoutedVia;
    /**
     * `unverified` is the fail-closed case: the feature may well be on, and
     * this delivery could not establish that it is. Refusing is the only
     * answer that cannot be wrong in the direction that matters.
     */
    reason: "disabled" | "capability" | "unverified";
  }
  /** A number that is not on the menu in view. */
  | { kind: "invalid"; menuId: string; choice: number }
  /** A tapped row this build no longer has. */
  | { kind: "stale"; selection: string }
  /** Not navigation at all. The conversation carries on as it did. */
  | { kind: "passthrough" };

/**
 * Resolve one message against one menu.
 *
 * Order is the correctness argument, least ambiguous first: an explicit command
 * beats a tap, a tap beats a number, a number beats a word, and a word that
 * names nothing is not navigation. Availability is checked once, at the end,
 * against whatever was resolved — so every route reaches the same gate.
 */
export function resolveSelection(input: RouterInput): Routing {
  const disabled = input.disabled ?? [];
  const available = input.available ?? [];
  const verified = input.configVerified !== false;
  const menuId = nodeById(input.menuId) ? input.menuId : ROOT_ID;

  // A tapped control row. Checked before the catalog is consulted at all,
  // because `back` and `main_menu` are ids the catalog does not have and
  // looking them up would answer a tap on Back with "that option has moved".
  const tappedCommand = parseControlId(input.selection);
  if (tappedCommand) return { kind: "command", command: tappedCommand };

  if (input.selection) {
    // ── What a tapped id is allowed to be ──────────────────────────────────
    //
    // Three checks, and each closes a different door.
    //
    // The *scope* check: an id belongs to exactly one interaction. A language
    // row, a gender row and a country row are answered elsewhere, before the
    // engine is ever reached, so one arriving here came from an old message or
    // from somewhere that is not this channel — and either way it is not a
    // feature. Resolving it as one would mean a prefix collision was all that
    // stood between a profile row and executing something.
    //
    // The *shape* check is inside `selectionScope`: oversized, empty, or
    // carrying characters this channel never issues. Refused as stale rather
    // than parsed, because there is nothing there to parse.
    //
    // The *offered* check: the id has to name a row a sender could actually
    // have been shown — not hidden, not the root, not switched off, and inside
    // its parent menu's ten-row ceiling. `isOffered` is the same function
    // `menuMessage` builds its rows from, which is what makes "you can only
    // execute what the menu offers" a fact rather than an intention. Without
    // it, an id for a row past the ceiling — a row this channel has never once
    // rendered — would execute on a tap that could not have happened.
    const scope = selectionScope(input.selection);
    if (scope !== "catalog") return { kind: "stale", selection: input.selection };

    const node = nodeById(input.selection);
    if (!node || !isOffered(node)) return { kind: "stale", selection: input.selection };
    return gate(node, "tap", disabled, available, verified);
  }

  // The typed commands: `0`, `00`, `#` and their words — still supported,
  // no longer taught — and then the same words in the sender's own language,
  // which is what the text copy of a menu tells them to send.
  const command = parseCommand(input.text) ?? localisedCommand(input.text, input.language);
  if (command) return { kind: "command", command };

  const choice = parseChoice(input.text);
  if (choice !== null) {
    const node = childAt(menuId, choice);
    if (!node) return { kind: "invalid", menuId, choice };
    return gate(node, "number", disabled, available, verified);
  }

  // The name of a row on the menu in view.
  //
  // This is the other half of removing the numbers. The text copy of a menu now
  // says "reply with the name of what you need", and that instruction has to be
  // true — including for the eighteen languages whose rows carry no alias of
  // their own. Scoped to the menu being looked at, which is what makes it safe:
  // two menus may both have a row called "How to get around" and each resolves
  // to its own, where a global table would have to pick one and be wrong half
  // the time.
  const onMenu = resolveTitleIn(menuId, input.text, input.language);
  if (onMenu) return gate(onMenu, "name", disabled, available, verified);

  const named = resolveAlias(input.text, input.language);
  if (named) return gate(named, "alias", disabled, available, verified);

  return { kind: "passthrough" };
}

/**
 * The child of one menu whose title is this whole message, or null.
 *
 * Whole-message only, and folded through the same normaliser the aliases use,
 * so case, punctuation and the diacritics an Arabic keyboard adds do not
 * decide whether somebody reaches the weather.
 */
export function resolveTitleIn(
  menuId: string,
  text: string | null | undefined,
  language: Language,
): CatalogNode | null {
  const needle = normaliseAlias(text ?? "");
  if (!needle || needle.length > 60) return null;

  for (const child of childrenOf(menuId)) {
    if (normaliseAlias(localized(child.title, language)) === needle) return child;
  }
  return null;
}

/**
 * The one gate every route passes through.
 *
 * Order matters and runs from most certain to least. A feature that is off is
 * off whatever else is true. A feature this deployment cannot run is refused
 * next, because that is a fact about the environment rather than about the
 * configuration. Only then does the unverified case apply — so a configuration
 * this delivery could not read never *widens* anything, it only refuses what it
 * cannot vouch for.
 */
function gate(
  node: CatalogNode,
  via: RoutedVia,
  disabled: readonly string[],
  available: readonly Capability[],
  configVerified = true,
): Routing {
  const parentId = node.parent ?? ROOT_ID;
  if (!isAvailable(node, disabled)) {
    return { kind: "unavailable", featureId: node.id, node, parentId, via, reason: "disabled" };
  }
  const missing = (node.requires ?? []).filter((capability) => !available.includes(capability));
  if (missing.length > 0) {
    return { kind: "unavailable", featureId: node.id, node, parentId, via, reason: "capability" };
  }
  if (!configVerified) {
    return { kind: "unavailable", featureId: node.id, node, parentId, via, reason: "unverified" };
  }
  return { kind: "feature", featureId: node.id, node, parentId, via };
}

/**
 * The feature a message names outright, or null.
 *
 * Deliberately narrow: whole-message matches against the words each node
 * declares, not a search for those words inside a sentence. "الطقس" is a
 * request; "شو رأيك بالطقس بالسويد" is a conversation, and answering that with
 * a forecast card would be this layer overriding the assistant.
 *
 * The richer reading — "what's the weather in Amman tomorrow" — is still done
 * by each feature's own parser downstream, exactly as before. What this adds is
 * a *name* for the feature those words belong to, so a switched-off feature can
 * be refused rather than quietly answered by something else.
 *
 * The longest alias wins, so a node declaring "وين غرضي" beats one declaring
 * "وين" if both ever match the same message.
 */
export function resolveAlias(text: string | null | undefined, language: Language): CatalogNode | null {
  const needle = normaliseAlias(text ?? "");
  if (!needle || needle.length > 40) return null;

  for (const node of ALIAS_NODES) {
    for (const alias of aliasesOf(node, language)) {
      if (normaliseAlias(alias) === needle) return node;
    }
  }
  return null;
}

/** Nodes that declare any words, longest alias first. Built once. */
const ALIAS_NODES: readonly CatalogNode[] = CATALOG
  .filter((node) => !node.hidden && (aliasesOf(node, "ar").length > 0 || aliasesOf(node, "en").length > 0))
  .sort((a, b) => longestAlias(b) - longestAlias(a));

function longestAlias(node: CatalogNode): number {
  const words = [...aliasesOf(node, "ar"), ...aliasesOf(node, "en")];
  return words.reduce((longest, word) => Math.max(longest, word.length), 0);
}

/**
 * Fold what does not change which words were said.
 *
 * Case, surrounding punctuation, Arabic-Indic digits, and the diacritics and
 * spelling variants an Arabic keyboard produces without the sender intending a
 * different word — أ/إ/آ for ا, ى for ي, ة for ه. Not a stemmer: this is an
 * exact-match table, and the folding only removes noise nobody typed on purpose.
 */
export function normaliseAlias(text: string): string {
  return foldDigits(text)
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0629/g, "\u0647")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
