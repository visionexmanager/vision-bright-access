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
