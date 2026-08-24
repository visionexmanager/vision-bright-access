// The words that are never a feature.
//
// `0`, `00`, `#`, "menu", "help" and their Arabic equivalents, plus the two
// readers — a bare number, and a greeting. They live apart from both the engine
// and the router because both need them and neither should own them: a second
// copy of this table is a second answer to "what does 0 mean", which is exactly
// the class of bug a universal router exists to prevent.
//
// Kept deliberately tiny. Every word here is a word a sender can no longer use
// as an ordinary message.

import { localized, type Language } from "./whatsappCatalog.ts";
import { UI_STRINGS } from "./whatsappStrings.ts";

// ── The universal commands ────────────────────────────────────────────────
//
// Recognised whatever the case, and in Arabic as well as English. Kept
// deliberately tiny: every word here is a word a sender can no longer use as an
// ordinary message, so the list earns each entry. "0" and "00" are the two that
// carry the traffic, and both are unambiguous — nobody sends a bare zero to
// mean anything else.

export type NavigationCommand = "back" | "home" | "cancel" | "help" | "menu";

const HOME_WORDS = /^(00|menu|main|main menu|home)$/i;
const BACK_WORDS = /^(0|back|return)$/i;
const CANCEL_WORDS = /^(#|cancel|stop|abort)$/i;
const HELP_WORDS = /^(help|\?|commands)$/i;

const HOME_WORDS_AR = /^(القائمة|قائمة|القائمة الرئيسية|الرئيسية|الرجوع للقائمة)$/;
const BACK_WORDS_AR = /^(رجوع|ارجع|عودة|السابق|للخلف)$/;
const CANCEL_WORDS_AR = /^(الغاء|إلغاء|ألغِ|توقف|إلغاء العملية)$/;
const HELP_WORDS_AR = /^(مساعدة|المساعدة|الأوامر|اوامر|شرح)$/;

/**
 * Arabic-Indic and Persian digits, folded to the ones the parser reads.
 *
 * ٣ and 3 are the same key to the person pressing it. Treating only one of them
 * as a menu choice would make the whole engine work for half the audience.
 */
export function foldDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** Strip what people add around a command without meaning it: spaces, a dot. */
function normalise(text: string): string {
  return foldDigits((text ?? "").trim())
    .replace(/^[\s.)؟?!،,-]+|[\s.)؟?!،,-]+$/g, "")
    .trim();
}

/** The universal command a message is, or null for anything else. */
export function parseCommand(text: string | null | undefined): NavigationCommand | null {
  const value = normalise(text ?? "");
  if (!value || value.length > 24) return null;
  if (HOME_WORDS.test(value) || HOME_WORDS_AR.test(value)) return "home";
  if (BACK_WORDS.test(value) || BACK_WORDS_AR.test(value)) return "back";
  if (CANCEL_WORDS.test(value) || CANCEL_WORDS_AR.test(value)) return "cancel";
  if (HELP_WORDS.test(value) || HELP_WORDS_AR.test(value)) return "help";
  return null;
}

/**
 * A menu choice typed on its own.
 *
 * Only a number and nothing else. "3" is a choice; "3 kilos of rice" is a
 * sentence that starts with a number, and answering it with the OCR menu would
 * be worse than not offering numbers at all.
 */
export function parseChoice(text: string | null | undefined): number | null {
  const value = normalise(text ?? "");
  if (!/^[0-9]{1,2}$/.test(value)) return null;
  const choice = Number(value);
  // Zero is the back command and never reaches this. Anything else the sender
  // typed as a bare number is a menu choice, valid or not: telling them "that
  // is not on the menu" is the point of having numbers.
  return choice >= 1 ? choice : null;
}

/** A first message that is only a greeting, which should open the menu. */
const GREETING = /^(hi|hello|hey|start|hei|salam|salaam)$|^(مرحبا|مرحبًا|السلام عليكم|اهلا|أهلا|هلا|بداية|ابدأ)$/i;

export const isGreeting = (text: string | null | undefined): boolean =>
  GREETING.test(normalise(text ?? ""));

// ── The ids the control rows carry ────────────────────────────────────────
//
// A tapped Back row and a typed `0` mean exactly the same thing, so they
// resolve through exactly the same table. Declared here rather than beside the
// message builders because both the router and the onboarding gate need them,
// and a second copy of "what does back mean" is the class of bug this file
// exists to prevent.
//
// Stable, and deliberately not the label: `back` keeps meaning back on the day
// somebody improves the French for «Retour».

export const CONTROL_IDS = {
  back: "back",
  mainMenu: "main_menu",
} as const;

/** The command a tapped control row is, or null for a feature row. */
export function parseControlId(id: string | null | undefined): NavigationCommand | null {
  if (id === CONTROL_IDS.back) return "back";
  if (id === CONTROL_IDS.mainMenu) return "home";
  return null;
}

/**
 * The command a message names in the sender's own language, or null.
 *
 * The text copy of a menu — the one Meta falls back to outside the service
 * window — tells the sender to reply with "Back". In French it says «Retour»,
 * and «Retour» has to work, or the instruction is a lie in eighteen languages.
 *
 * Matched against the sender's language and against English, which is the
 * fallback everybody can be shown. Whole message only: "retour à la maison" is
 * a sentence.
 */
export function localisedCommand(
  text: string | null | undefined,
  language: Language,
): NavigationCommand | null {
  const value = normalise(text ?? "").toLowerCase();
  if (!value || value.length > 24) return null;

  for (const lang of [language, "en"] as const) {
    if (value === localized(UI_STRINGS.back, lang).toLowerCase()) return "back";
    if (value === localized(UI_STRINGS.mainMenu, lang).toLowerCase()) return "home";
  }
  return null;
}
