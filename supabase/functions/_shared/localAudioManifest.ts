// The registry of prerecorded phrases, and the manifest of the clips that exist.
//
// Two different things live here on purpose:
//
//   LOCAL_RESPONSES  which strings may be said from a recording. Each points at an
//                    existing key in `whatsappStrings.ts`; the words are never
//                    copied. A response needs no entry here to keep working as
//                    text — this list only says which texts a recording may stand
//                    in for.
//
//   LOCAL_AUDIO_ASSETS  the clips that actually exist, with the size, checksum and
//                    duration measured when each was prepared. It is empty until
//                    clips have been recorded, checked and installed on the Data
//                    Hub (see scripts/local-audio/prepare.mjs). An entry is a
//                    claim that the file is there; `loadClip` re-checks every one
//                    against the bytes before it is ever sent.
//
// Registered but absent clips are not an error: the phrase is sent as text, which
// is what happens everywhere today.
//
// Rules for a phrase here: a fixed sentence with no variables and no link, spoken
// in a few seconds. Menus, lists, prices, limits and anything carrying a number
// do not belong — they are read, not heard.

/** Bump when a clip or a registration changes. */
export const LOCAL_AUDIO_VERSION = "1";

/** The Data Hub dataset the clips are served from (`/datahub/file?dataset=…`). */
export const LOCAL_AUDIO_DATASET = "voice-prompts";

export interface LocalResponse {
  /** The key in `UI_STRINGS` whose text this recording says. */
  uiKey: string;
  purpose: "progress" | "guidance" | "error" | "confirmation";
}

export const LOCAL_RESPONSES: Readonly<Record<string, LocalResponse>> = {
  processing: { uiKey: "processing", purpose: "progress" },
  request_failed: { uiKey: "failed", purpose: "error" },
  stopped: { uiKey: "stoppedWorking", purpose: "confirmation" },
  ask_question: { uiKey: "askForQuestion", purpose: "guidance" },
  ask_voice: { uiKey: "askForVoice", purpose: "guidance" },
  empty_question: { uiKey: "emptyQuestion", purpose: "guidance" },
  question_too_long: { uiKey: "tooLong", purpose: "guidance" },
  new_conversation: { uiKey: "newThread", purpose: "confirmation" },
  voice_expected: { uiKey: "voiceExpected", purpose: "guidance" },
  nothing_found: { uiKey: "emptyResult", purpose: "error" },
  unavailable: { uiKey: "unavailable", purpose: "error" },
  language_set: { uiKey: "languageSet", purpose: "confirmation" },
};

/**
 * What the first rollout needs, and nothing more: five fixed phrases in English
 * and Arabic. The registry above covers every language; a language with no clip
 * simply keeps the written copy. Greeting is not here: on WhatsApp a greeting is
 * answered with the menu, which is not a fixed sentence, so there is nothing
 * registered to record until the owner decides on one.
 */
export const RELEASE_1 = {
  languages: ["en", "ar"],
  ids: ["processing", "request_failed", "empty_question", "unavailable", "ask_question"],
} as const;

export interface ClipRecord {
  bytes: number;
  sha256: string;
  durationMs: number;
  status: "active" | "disabled";
  verifiedAt: string;
}

/** `<response id>.<language>.ogg` → what was measured when the clip was prepared. */
export const LOCAL_AUDIO_ASSETS: Readonly<Record<string, ClipRecord>> = {};
