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
  uiKey?: string;
  /**
   * A curated phrase that is not an interface string, written only in the languages a
   * clip exists for. Never a translation nobody reviewed: a language not listed has no
   * such phrase, so it can neither match nor expect a clip.
   */
  text?: Readonly<Record<string, string>>;
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
  // One-word acknowledgements that exist as CC0 human recordings, written only in the
  // languages a recording exists for. Nothing sends them yet: a reply path has to choose
  // them (see docs/whatsapp-local-audio-licences.md).
  ack_thanks: { text: { en: "Thanks.", ar: "شكرا." }, purpose: "confirmation" },
  ack_sorry: { text: { en: "Sorry.", ar: "آسف." }, purpose: "confirmation" },
  ack_hello: { text: { en: "Hello.", ar: "سلام." }, purpose: "confirmation" },
  ack_goodbye: { text: { en: "Goodbye.", ar: "مع السلامة." }, purpose: "confirmation" },
  ack_okay: { text: { en: "Okay.", ar: "حسنا." }, purpose: "confirmation" },
  ack_yes: { text: { en: "Yes.", ar: "نعم." }, purpose: "confirmation" },
  ack_no: { text: { en: "No.", ar: "لا." }, purpose: "confirmation" },
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
export const LOCAL_AUDIO_ASSETS: Readonly<Record<string, ClipRecord>> = {
  // Wikimedia Commons / Lingua Libre, all CC0. "disabled" until a person has listened
  // to each clip and confirmed it says the registered word; see
  // assets/local-audio/voice-prompts/provenance.json and docs/whatsapp-local-audio-licences.md.
  "ack_goodbye.en.ogg": { bytes: 2717, sha256: "b580f48f450366c34637cb5a590a0acdaaf408028af1688a5815d30c391f8bc9", durationMs: 917, status: "disabled", verifiedAt: "2026-10-16" },
  "ack_hello.ar.ogg": { bytes: 2920, sha256: "7340982b66aa3f04e36620e4097852e96c0d882bf51c62581ec970eae5dc5ae1", durationMs: 979, status: "disabled", verifiedAt: "2026-10-16" },
  "ack_hello.en.ogg": { bytes: 2663, sha256: "9c0e4a8082a3c0d481538d468383ae3795952940856e1927a05f9db0451fd9e4", durationMs: 893, status: "disabled", verifiedAt: "2026-10-16" },
  "ack_no.ar.ogg": { bytes: 2713, sha256: "d0c8861ee08c55e9745ae6e7de5dbb40caca01e65f6f536c8a909a0fcf237bc3", durationMs: 968, status: "disabled", verifiedAt: "2026-10-16" },
  "ack_no.en.ogg": { bytes: 2181, sha256: "08566f85898d56dbd5264aa688e961deb4a21c8f1dafdd45d66c1e359fc33b05", durationMs: 747, status: "disabled", verifiedAt: "2026-10-16" },
  "ack_okay.en.ogg": { bytes: 2839, sha256: "fa02d562b7ae4472b526982926babfde9d73864b3aeec8febaca8c5cfed62ae8", durationMs: 947, status: "disabled", verifiedAt: "2026-10-16" },
  "ack_sorry.en.ogg": { bytes: 2787, sha256: "fca3d885bdac1c05daf42b57f2509e8220db4f8a8d796a7a7887579a4205e7b7", durationMs: 896, status: "disabled", verifiedAt: "2026-10-16" },
  "ack_thanks.ar.ogg": { bytes: 2618, sha256: "286fe0a047c87e78afce2b6fba32baf8c423f0780cfa3dcc759cb3c44c3856d9", durationMs: 856, status: "disabled", verifiedAt: "2026-10-16" },
  "ack_thanks.en.ogg": { bytes: 2796, sha256: "810186b7fb715505e8c88e54016dd38258f412116119b25e1460f7df3098d530", durationMs: 891, status: "disabled", verifiedAt: "2026-10-16" },
  "ack_yes.en.ogg": { bytes: 2765, sha256: "b38ba750ecff7d14ddfd3a7a87d028d304c98f481a1d7803832615e29aad5cb2", durationMs: 928, status: "disabled", verifiedAt: "2026-10-16" },
};
