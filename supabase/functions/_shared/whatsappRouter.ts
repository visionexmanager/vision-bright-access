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
  type CatalogNode,
  type Capability,
  isAvailable,
  type Language,
  nodeById,
  ROOT_ID,
} from "./whatsappCatalog.ts";
import { foldDigits, type NavigationCommand, parseChoice, parseCommand } from "./whatsappCommands.ts";

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
}

/** How a feature was named. Logged, and used to decide how far to move. */
export type RoutedVia = "number" | "tap" | "alias";

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
  | { kind: "unavailable"; featureId: string; node: CatalogNode; parentId: string; via: RoutedVia; reason: "disabled" | "capability" }
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

  const command = parseCommand(input.text);
  if (command) return { kind: "command", command };

  if (input.selection) {
    const node = nodeById(input.selection);
    if (!node || node.hidden) return { kind: "stale", selection: input.selection };
    return gate(node, "tap", disabled, available);
  }

  const choice = parseChoice(input.text);
  if (choice !== null) {
    const menuId = nodeById(input.menuId) ? input.menuId : ROOT_ID;
    const node = childAt(menuId, choice);
    if (!node) return { kind: "invalid", menuId, choice };
    return gate(node, "number", disabled, available);
  }

  const named = resolveAlias(input.text, input.language);
  if (named) return gate(named, "alias", disabled, available);

  return { kind: "passthrough" };
}

/** The one gate every route passes through. */
function gate(
  node: CatalogNode,
  via: RoutedVia,
  disabled: readonly string[],
  available: readonly Capability[],
): Routing {
  const parentId = node.parent ?? ROOT_ID;
  if (!isAvailable(node, disabled)) {
    return { kind: "unavailable", featureId: node.id, node, parentId, via, reason: "disabled" };
  }
  const missing = (node.requires ?? []).filter((capability) => !available.includes(capability));
  if (missing.length > 0) {
    return { kind: "unavailable", featureId: node.id, node, parentId, via, reason: "capability" };
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
