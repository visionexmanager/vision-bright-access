// The first two minutes: which language, and who is this.
//
// A sender whose profile is not finished never reaches the navigation engine.
// This runs first, answers them, and returns the columns to write — and like
// the engine it decides and returns rather than sending: every rule below is a
// pure function of (message, state, clock), so the suite drives the real flow
// instead of a mock of it.
//
// ── Why a gate and not a feature ────────────────────────────────────────────
//
// Because it is not navigation. A person part-way through being asked their
// email is not standing anywhere in the menu, and modelling them as though they
// were would mean every menu rule — back, timeout, feature flags, aliases —
// having to know about a state it has nothing to say about. The router stays
// the one resolver for the menu; this is the thing in front of it.
//
// The commands still come from `whatsappCommands.ts` and the ids still come
// from the same constants the interactive builders use, so there is exactly one
// answer to "what does Back mean" no matter which side of the gate asks.
//
// ── What is never asked ─────────────────────────────────────────────────────
//
// The phone number. It arrived in the webhook envelope, signed by Meta, and the
// row is keyed on it. Asking somebody to type the number they are texting from
// is redundant at best, and at worst it lets a typed number disagree with the
// verified one — which is a profile attached to the wrong person.
//
// Pure: no `Deno`, no fetch, no database.

import { foldDigits, parseCommand } from "./whatsappCommands.ts";
import {
  parseLanguagePage,
  parseLanguageSelection,
  type SupportedLanguage,
} from "./whatsappLanguages.ts";
import { parseCountry, parseCountrySelection, type Country } from "./whatsappCountries.ts";
import { GENDERS, type Gender } from "./whatsappProfile.ts";
import type { UiKey } from "./whatsappStrings.ts";

// ── The states ───────────────────────────────────────────────────────────────
//
// Their own names, deliberately not borrowed from the assistant's. `ai_menu`
// and `profile_email` are not the same kind of thing and a column holding
// either would be a column nobody could reason about.

export const ONBOARDING_STATES = [
  "language_selection",
  "profile_name",
  "profile_birth_date",
  "profile_gender",
  "profile_email",
  "profile_country",
  "complete",
] as const;

export type OnboardingState = (typeof ONBOARDING_STATES)[number];

export const isOnboardingState = (value: string | null | undefined): value is OnboardingState =>
  !!value && (ONBOARDING_STATES as readonly string[]).includes(value);

/** The state a row with nothing in that column is in: the very beginning. */
export const INITIAL_STATE: OnboardingState = "language_selection";

/** Whether this sender still has questions to answer. */
export const isOnboarding = (state: OnboardingState): boolean => state !== "complete";

/**
 * How a stored value becomes a state.
 *
 * A row written before this feature existed has no value at all, and those
 * senders are emphatically *not* new: they have been using this assistant for
 * months. The migration backfills them to `complete`, and this is the second
 * belt — a null here means an established conversation, never a fresh one.
 */
export function readOnboardingState(
  value: unknown,
  hasConversation: boolean,
): OnboardingState {
  if (isOnboardingState(typeof value === "string" ? value : null)) return value as OnboardingState;
  return hasConversation ? "complete" : INITIAL_STATE;
}

/** The order the questions are asked in. `complete` is the end, not a question. */
const ORDER: readonly OnboardingState[] = ONBOARDING_STATES.filter((state) => state !== "complete");

export function nextState(state: OnboardingState): OnboardingState {
  const at = ORDER.indexOf(state);
  if (at < 0) return "complete";
  return ORDER[at + 1] ?? "complete";
}

/** The step before this one, or null at the first question there is. */
export function previousState(state: OnboardingState): OnboardingState | null {
  const at = ORDER.indexOf(state);
  return at > 0 ? ORDER[at - 1] : null;
}

// ── What the webhook is asked to send ────────────────────────────────────────

export type OnboardingPrompt =
  /** One sentence from the shared vocabulary. */
  | { type: "text"; key: UiKey }
  /** The language list, English, at a given page. */
  | { type: "language"; page: number }
  /** The four ways somebody can ask to be referred to. */
  | { type: "gender" }
  /** A shortlist of countries, the sender's dialling prefix first. */
  | { type: "country" }
  /** A question with nothing to tap but a way back. */
  | { type: "question"; key: UiKey }
  /** Onboarding is over: the navigation engine takes it from here. */
  | { type: "menu" };

/** Why the flow did what it did. Logged; never shown to the sender. */
export type OnboardingReason =
  | "started"
  | "language_set"
  | "language_page"
  | "language_invalid"
  | "field_saved"
  | "field_invalid"
  | "went_back"
  | "already_at_start"
  | "needs_text"
  | "repeated"
  | "finished";

export interface OnboardingOutcome {
  /** Where the sender stands after this message. */
  state: OnboardingState;
  /** Columns to write on `whatsapp_conversations`. Empty when nothing was accepted. */
  columns: Record<string, string | null>;
  /** What to send, in order. */
  prompts: OnboardingPrompt[];
  /** The language every prompt above is to be rendered in. */
  language: SupportedLanguage;
  reason: OnboardingReason;
}

export interface OnboardingMessage {
  text: string;
  kind: "text" | "image" | "audio" | "document" | "video" | "location" | "interactive" | "unknown";
  /** The id of a tapped row or button. */
  selection?: string;
}

export interface OnboardingContext {
  state: OnboardingState;
  /** The language chosen so far. English until they choose, which is the default by design. */
  language: SupportedLanguage;
  /** The verified sender, used only to guess which countries to offer first. */
  phone: string;
  nowMs: number;
}

// ── The gate ─────────────────────────────────────────────────────────────────

/**
 * Decide what one message means, given where the sender is in onboarding.
 *
 * Order is the correctness argument. Back is honoured before anything is
 * parsed as an answer, because "back" typed at the email question is a request
 * to go back and not an email address. A tapped id beats typed text, because it
 * is unambiguous and because a label is a translation while an id is not.
 * Anything that is neither re-asks the question rather than guessing.
 */
export function runOnboarding(
  message: OnboardingMessage,
  context: OnboardingContext,
): OnboardingOutcome {
  const { state } = context;
  const here = (over: Partial<OnboardingOutcome> = {}): OnboardingOutcome => ({
    state,
    columns: {},
    prompts: promptsFor(state),
    language: context.language,
    reason: "repeated",
    ...over,
  });

  if (state === "complete") {
    return { state, columns: {}, prompts: [], language: context.language, reason: "finished" };
  }

  // Back, from either direction: a tapped row or the word. `parseCommand` also
  // answers to `0`, which is how anybody who learned the old menu says it.
  const wantsBack = message.selection === BACK_ID
    || (!message.selection && parseCommand(message.text) === "back");
  if (wantsBack) {
    const previous = previousState(state);
    if (!previous) {
      return here({ reason: "already_at_start", prompts: [{ type: "text", key: "onboardingAtStart" }, ...promptsFor(state)] });
    }
    return {
      state: previous,
      columns: { onboarding_status: previous },
      prompts: promptsFor(previous),
      language: context.language,
      reason: "went_back",
    };
  }

  // A voice note, a photo or a pin, before there is a profile to attach them
  // to. Not fed to the assistant and not transcribed: the answer to "what is
  // your email address" is not a thing to guess at from a recording, and a
  // misheard address is worse than no address. The question is asked again, in
  // whatever language the flow has reached.
  if (message.kind !== "text" && message.kind !== "interactive") {
    return here({
      reason: "needs_text",
      prompts: [{ type: "text", key: "onboardingNeedsText" }, ...promptsFor(state)],
    });
  }

  if (state === "language_selection") return language(message, context);

  const answer = state === "profile_gender"
    ? gender(message)
    : state === "profile_country"
      ? country(message, context)
      : field(state, message, context);

  if (!answer) return here({ reason: "field_invalid", prompts: invalidPrompts(state) });

  const after = nextState(state);
  const columns = { ...answer, onboarding_status: after };
  const prompts = promptsFor(after);

  return {
    state: after,
    columns,
    prompts: after === "complete"
      ? [{ type: "text", key: "profileReady" }, { type: "menu" }]
      : prompts,
    language: context.language,
    reason: after === "complete" ? "finished" : "field_saved",
  };
}

/** The id every Back control carries, on a row and on a button alike. */
export const BACK_ID = "back";

/** The ids the gender rows carry. Stable; never the label, never a position. */
export const GENDER_ID_PREFIX = "gender.";
export const genderRowId = (value: Gender): string => `${GENDER_ID_PREFIX}${value}`;

export function parseGenderSelection(id: string | null | undefined): Gender | null {
  if (!id || !id.startsWith(GENDER_ID_PREFIX)) return null;
  const value = id.slice(GENDER_ID_PREFIX.length);
  return (GENDERS as readonly string[]).includes(value) ? (value as Gender) : null;
}

// ── One step at a time ───────────────────────────────────────────────────────

function language(message: OnboardingMessage, context: OnboardingContext): OnboardingOutcome {
  const page = parseLanguagePage(message.selection);
  if (page) {
    return {
      state: "language_selection",
      columns: {},
      prompts: [{ type: "language", page }],
      language: context.language,
      reason: "language_page",
    };
  }

  const chosen = parseLanguageSelection(message.selection);
  if (!chosen) {
    // Deliberately not read out of the text. A tapped id is the only thing that
    // picks a language: reading it out of what somebody typed would mean an
    // Arabic-looking greeting silently choosing Arabic for a Persian speaker,
    // and it would make the choice depend on a guess the sender never saw.
    return {
      state: "language_selection",
      columns: {},
      prompts: [{ type: "language", page: 1 }],
      language: context.language,
      reason: message.selection ? "language_invalid" : "started",
    };
  }

  const after = nextState("language_selection");
  return {
    state: after,
    columns: { preferred_language: chosen, language: chosen, onboarding_status: after },
    // Answered in the language they have this second chosen, which is the first
    // proof the choice took.
    prompts: promptsFor(after),
    language: chosen,
    reason: "language_set",
  };
}

function gender(message: OnboardingMessage): Record<string, string> | null {
  const chosen = parseGenderSelection(message.selection);
  return chosen ? { gender: chosen } : null;
}

function country(message: OnboardingMessage, context: OnboardingContext): Record<string, string> | null {
  const tapped: Country | null = parseCountrySelection(message.selection);
  if (tapped) return { country: tapped.code };
  // "Another country" is not an answer; it is a request to type one, and the
  // hint that follows is sent by the invalid path, which is the same message.
  if (message.selection) return null;
  const typed = parseCountry(message.text, context.language);
  return typed ? { country: typed.code } : null;
}

function field(
  state: OnboardingState,
  message: OnboardingMessage,
  context: OnboardingContext,
): Record<string, string> | null {
  // A tap during a typed question is a stale row from an earlier message.
  if (message.selection) return null;

  if (state === "profile_name") {
    const name = normaliseName(message.text);
    return name ? { full_name: name } : null;
  }
  if (state === "profile_birth_date") {
    const date = parseBirthDate(message.text, context.nowMs);
    return date ? { date_of_birth: date } : null;
  }
  if (state === "profile_email") {
    const email = normaliseEmail(message.text);
    return email ? { email } : null;
  }
  return null;
}

// ── What each state says ─────────────────────────────────────────────────────

function promptsFor(state: OnboardingState): OnboardingPrompt[] {
  switch (state) {
    case "language_selection":
      return [{ type: "language", page: 1 }];
    case "profile_name":
      return [{ type: "question", key: "askName" }];
    case "profile_birth_date":
      return [{ type: "question", key: "askBirthDate" }];
    case "profile_gender":
      return [{ type: "gender" }];
    case "profile_email":
      return [{ type: "question", key: "askEmail" }];
    case "profile_country":
      return [{ type: "country" }];
    case "complete":
      return [{ type: "menu" }];
  }
}

/** The same question again, preceded by what was wrong with the answer. */
function invalidPrompts(state: OnboardingState): OnboardingPrompt[] {
  const complaint: Partial<Record<OnboardingState, UiKey>> = {
    profile_name: "nameInvalid",
    profile_birth_date: "birthDateInvalid",
    profile_email: "emailInvalid",
    profile_country: "countryInvalid",
  };
  const key = complaint[state];
  const again = promptsFor(state);
  // Gender has nothing to get wrong — it is four rows — so a message that is
  // not one of them simply gets the four rows again with no complaint attached.
  return key ? [{ type: "text", key }, ...again] : again;
}

// ── Validation ───────────────────────────────────────────────────────────────

/** Longest name this will store. Long enough for four parts; short enough not to be an essay. */
export const MAX_NAME_CHARS = 80;
/** The oldest a person can plausibly be. Anything past it is a typo, not a birthday. */
export const MAX_AGE_YEARS = 120;

/**
 * A name, or null.
 *
 * Whitespace collapsed, because a name pasted out of a form arrives with
 * newlines in it. Must contain a letter: "12345" and "..." are not names, and
 * greeting somebody as "12345" in every subsequent message is worse than having
 * asked twice.
 */
export function normaliseName(text: string | null | undefined): string | null {
  const value = (text ?? "").replace(/\s+/g, " ").trim();
  if (value.length < 2 || value.length > MAX_NAME_CHARS) return null;
  if (!/\p{L}/u.test(value)) return null;
  return value;
}

/**
 * A date of birth as an ISO date, or null.
 *
 * Four shapes, because people write dates four ways and refusing three of them
 * is a way of asking somebody to guess the house style. Arabic-Indic digits
 * fold to Latin first: ١٩٩٠ and 1990 are the same keys to the person pressing
 * them.
 *
 * Day-first for the slashed and dotted forms, which is what the question asks
 * for and what most of the world writes — and a first component over twelve
 * settles it outright either way. A date that does not exist is refused rather
 * than rolled forward: `new Date(1990, 1, 30)` is the 2nd of March, and storing
 * that as somebody's birthday is silent corruption.
 */
export function parseBirthDate(text: string | null | undefined, nowMs: number): string | null {
  const value = foldDigits((text ?? "").trim());
  if (!value || value.length > 40) return null;

  let year: number, month: number, day: number;

  const iso = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  const local = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);

  if (iso) {
    [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (local) {
    const first = Number(local[1]);
    const second = Number(local[2]);
    year = Number(local[3]);
    // Whichever component cannot be a month is the day. When both could be,
    // day-first wins, because that is the form the question demonstrates.
    if (first > 12 && second > 12) return null;
    if (first > 12) { day = first; month = second; }
    else if (second > 12) { month = first; day = second; }
    else { day = first; month = second; }
  } else {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  // The round trip is the existence check: February the 30th comes back as
  // March, and a month that changed under us is a date that was never real.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  if (date.getTime() > nowMs) return null;
  if (nowMs - date.getTime() > MAX_AGE_YEARS * 365.25 * 86_400_000) return null;

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Longest address RFC 5321 permits. Anything longer is not an address. */
export const MAX_EMAIL_CHARS = 254;

/**
 * An email address, lowercased, or null.
 *
 * Deliberately a shape check and not a validator: the grammar of an address is
 * famously baroque, every regex claiming to implement it is wrong somewhere,
 * and the only real test is sending to it. This refuses what is obviously not
 * an address and accepts the rest.
 */
export function normaliseEmail(text: string | null | undefined): string | null {
  const value = (text ?? "").trim().toLowerCase();
  if (!value || value.length > MAX_EMAIL_CHARS) return null;
  if (/\s/.test(value)) return null;
  if (!/^[^@]+@[^@.]+(\.[^@.]+)+$/.test(value)) return null;
  return value;
}
