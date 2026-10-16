// The shared lookup for approved fixed phrases: exact, context-bound, review-bound, off by default.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { SUPPORTED_LANGUAGES } from "../../supabase/functions/_shared/whatsappLanguages";
import { LOCAL_AUDIO_ASSETS, LOCAL_RESPONSES } from "../../supabase/functions/_shared/localAudioManifest";
import { inspectRegistry } from "../../supabase/functions/_shared/localAudio";
import {
  SHARED_PHRASES_FLAG, SHARED_PHRASE_AUDIO_FLAG, audioState, findPhrase, phraseAllowedIn, phraseCoverage, phraseText,
  sharedPhraseAudioEnabled, sharedPhraseClip, sharedPhraseText, sharedPhrasesEnabled,
} from "../../supabase/functions/_shared/sharedPhrases";

const env = (vars: Record<string, string>) => (name: string) => vars[name];
const TEXT = { [SHARED_PHRASES_FLAG]: "1" };
const BOTH = { [SHARED_PHRASES_FLAG]: "1", [SHARED_PHRASE_AUDIO_FLAG]: "1" };

const assets = LOCAL_AUDIO_ASSETS as Record<string, { status: string; reviewed?: boolean }>;
const saved = new Map<string, { status: string; reviewed?: boolean }>();
const set = (name: string, status: string, reviewed?: boolean) => {
  if (!saved.has(name)) saved.set(name, { ...assets[name] });
  assets[name].status = status;
  if (reviewed === undefined) delete assets[name].reviewed; else assets[name].reviewed = reviewed;
};
afterEach(() => {
  for (const [n, s] of saved) { assets[n].status = s.status; if (s.reviewed === undefined) delete assets[n].reviewed; else assets[n].reviewed = s.reviewed; }
  saved.clear();
});

describe("switches", () => {
  it("are off by default and exact", () => {
    expect(sharedPhrasesEnabled(env({}))).toBe(false);
    expect(sharedPhrasesEnabled(env({ [SHARED_PHRASES_FLAG]: "true" }))).toBe(false);
    expect(sharedPhrasesEnabled(env(TEXT))).toBe(true);
  });

  it("never play a clip where the text may not be reused", () => {
    expect(sharedPhraseAudioEnabled(env({ [SHARED_PHRASE_AUDIO_FLAG]: "1" }))).toBe(false);
    expect(sharedPhraseAudioEnabled(env(TEXT))).toBe(false);
    expect(sharedPhraseAudioEnabled(env(BOTH))).toBe(true);
  });

  it("leave the WhatsApp flags alone: they are separate names", () => {
    expect(sharedPhrasesEnabled(env({ WHATSAPP_LOCAL_AUDIO: "1", WHATSAPP_LOCAL_ACK: "1" }))).toBe(false);
  });
});

describe("lookup", () => {
  it("returns the approved words in the exact locale only, with no borrowed language", () => {
    expect(phraseText("processing", "en")).toContain("Processing your request");
    expect(phraseText("processing", "ar")).toContain("عالج");
    expect(phraseText("ack_hello", "fr")).toBeNull();
    expect(phraseText("not_a_phrase", "en")).toBeNull();
  });

  it("finds a phrase only by its exact words, in its own locale, in a context it belongs to", () => {
    expect(findPhrase(phraseText("processing", "en")!, "en", "fixed_reply")?.id).toBe("processing");
    expect(findPhrase(`${phraseText("processing", "en")} now`, "en", "fixed_reply")).toBeNull();
    expect(findPhrase(phraseText("processing", "en")!, "ar", "fixed_reply")).toBeNull();
  });

  it("keeps a pleasantry out of general replies: the same words are not a reply phrase", () => {
    for (const id of ["ack_thanks", "ack_sorry", "ack_hello", "ack_goodbye", "ack_okay", "ack_yes", "ack_no"]) {
      expect(phraseAllowedIn(id, "voice_pleasantry"), id).toBe(true);
      expect(phraseAllowedIn(id, "fixed_reply"), id).toBe(false);
    }
    for (const word of ["Yes.", "No.", "Okay.", "Thanks."]) expect(findPhrase(word, "en", "fixed_reply"), word).toBeNull();
    expect(findPhrase("Hello.", "en", "voice_pleasantry")?.id).toBe("ack_hello");
  });

  it("keeps every full-sentence phrase a fixed reply, untouched", () => {
    for (const id of ["processing", "request_failed", "empty_question", "unavailable", "ask_question"]) {
      expect(phraseAllowedIn(id, "fixed_reply"), id).toBe(true);
      expect(phraseAllowedIn(id, "voice_pleasantry"), id).toBe(false);
    }
  });
});

describe("text reuse", () => {
  it("returns text only with the switch on and the context right", () => {
    expect(sharedPhraseText("unavailable", "en", "fixed_reply", env({}))).toBeNull();
    expect(sharedPhraseText("unavailable", "en", "fixed_reply", env(TEXT))).toBe(phraseText("unavailable", "en"));
    expect(sharedPhraseText("ack_yes", "en", "fixed_reply", env(TEXT))).toBeNull();
    expect(sharedPhraseText("unavailable", "ja", "fixed_reply", env(TEXT))).toBe(phraseText("unavailable", "ja"));
  });
});

describe("audio reuse", () => {
  it("has no approved recording today: every shipped clip is disabled and unreviewed", () => {
    for (const [name, clip] of Object.entries(LOCAL_AUDIO_ASSETS)) {
      expect(clip.status, name).toBe("disabled");
      expect(clip.reviewed, name).not.toBe(true);
    }
    expect(sharedPhraseClip("ack_hello", "en", "voice_pleasantry", env(BOTH))).toBeNull();
  });

  it("reports the state of each recording honestly", () => {
    expect(audioState("ack_hello", "en")).toBe("disabled");
    expect(audioState("ack_sorry", "ar")).toBe("missing");
    expect(audioState("ack_hello", "fr")).toBe("no_text");
    set("ack_hello.en.ogg", "active", undefined);
    expect(audioState("ack_hello", "en")).toBe("unreviewed");
    set("ack_hello.ar.ogg", "active", true);
    expect(audioState("ack_hello", "ar")).toBe("approved");
  });

  it("offers a clip only when active, reviewed, exact, in context and both switches are on", () => {
    set("ack_hello.en.ogg", "active", true);
    expect(sharedPhraseClip("ack_hello", "en", "voice_pleasantry", env(BOTH))).toBe("ack_hello.en.ogg");
    expect(sharedPhraseClip("ack_hello", "en", "voice_pleasantry", env(TEXT))).toBeNull();
    expect(sharedPhraseClip("ack_hello", "en", "voice_pleasantry", env({ [SHARED_PHRASE_AUDIO_FLAG]: "1" }))).toBeNull();
    expect(sharedPhraseClip("ack_hello", "en", "fixed_reply", env(BOTH))).toBeNull();
    expect(sharedPhraseClip("ack_hello", "ar", "voice_pleasantry", env(BOTH))).toBeNull();
    expect(sharedPhraseClip("ack_goodbye", "en", "voice_pleasantry", env(BOTH))).toBeNull();
  });

  it("refuses an unreviewed or disabled clip, so the caller keeps its text or TTS", () => {
    set("ack_hello.en.ogg", "active", undefined);
    expect(sharedPhraseClip("ack_hello", "en", "voice_pleasantry", env(BOTH))).toBeNull();
    set("ack_goodbye.en.ogg", "disabled", true);
    expect(sharedPhraseClip("ack_goodbye", "en", "voice_pleasantry", env(BOTH))).toBeNull();
  });
});

describe("the registry", () => {
  it("reports a clip that is active without review", () => {
    set("ack_hello.en.ogg", "active", undefined);
    expect(inspectRegistry().problems.map((p) => p.problem)).toContain("active_without_review");
  });

  it("is clean as shipped", () => {
    expect(inspectRegistry().problems).toEqual([]);
  });

  it("covers every registered phrase, with locales that have words and no invented ones", () => {
    const rows = phraseCoverage(SUPPORTED_LANGUAGES);
    expect(rows.map((r) => r.id).sort()).toEqual(Object.keys(LOCAL_RESPONSES).sort());
    expect(rows.find((r) => r.id === "ack_hello")!.locales.sort()).toEqual(["ar", "en"]);
    expect(rows.find((r) => r.id === "processing")!.locales).toHaveLength(SUPPORTED_LANGUAGES.length);
  });
});

describe("where it is and is not used", () => {
  it("is not used by the web speech helper (free browser speech, user content)", () => {
    expect(readFileSync("src/lib/audio/speech.ts", "utf8")).not.toContain("sharedPhrases");
  });

  it("reaches the webhook only as a type; the live decisions go through the loader, resolver and greeting path (see shared-phrases-wiring.test.ts)", () => {
    const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
    expect(webhook).toContain('import type { PhraseContext } from "../_shared/sharedPhrases.ts";');
    expect(webhook.split(/\r?\n/).filter((l) => l.startsWith("import {") && l.includes("_shared/sharedPhrases.ts"))).toEqual([]);
  });
});
