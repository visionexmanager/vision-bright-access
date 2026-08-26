// The voice quality baseline runner.
//
//   node --experimental-strip-types scripts/voice/baseline.mts        (Node 22.6+)
//   node scripts/voice/baseline.mts                                   (Node 23.6+)
//
// It measures what it can and says so about the rest. It never invents a
// number: a provider without a key is reported UNMEASURED, and a fixture that
// needs a real recording is reported UNMEASURED until one is supplied.
//
// ── Where the audio comes from, and why that is a limitation ────────────────
//
// There is no speech corpus in this repository and no recording of a real
// person may be used. So for the fixtures that permit it, the audio is
// *synthesised* from the same sentence it is scored against. That measures how
// well an STT provider reads clean studio speech, which is a floor, not an
// estimate of WhatsApp accuracy: no room noise, no clipping, no phone codec,
// and — critically — no dialect. A TTS voice asked for Lebanese Arabic produces
// Modern Standard Arabic with an accent, so every Lebanese fixture is marked
// `requiresRealAudio` and stays UNMEASURED until somebody records it.
//
// Drop a recording at `scripts/voice/audio/<fixture-id>.<ext>` and the runner
// prefers it over synthesis for that fixture, for every provider.
//
// Raw transcripts are never printed. They go to the results file, whose path is
// printed, so a terminal log cannot leak what was said.

import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";

import { synthesize, type TtsProvider } from "../../supabase/functions/_shared/voice/tts.ts";
import { audioLooksValid, mean, scoreTranscript } from "./metrics.mjs";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const AUDIO_DIR = path.join(HERE, "audio");

interface Fixture {
  id: string;
  language: "ar" | "en";
  dialect: string;
  category: string;
  text: string;
  requiresRealAudio?: boolean;
}

/**
 * The STT providers this repository actually uses, in the order the WhatsApp
 * path tries them. Endpoints and models are copied from
 * `_shared/whatsappTranscribe.ts` and `speech-transcribe`.
 */
const STT_TARGETS = [
  { name: "groq", model: "whisper-large-v3-turbo", key: "GROQ_API_KEY", endpoint: "https://api.groq.com/openai/v1/audio/transcriptions" },
  { name: "openai", model: "whisper-1", key: "OPENAI_API_KEY", endpoint: "https://api.openai.com/v1/audio/transcriptions" },
] as const;

/**
 * The TTS targets, as the four call sites configure them.
 *
 * ElevenLabs needs a voice id rather than a name, and this repository holds
 * none that is not somebody's cloned voice — so it is listed and left
 * unmeasured unless `ELEVENLABS_VOICE_ID` names a library voice explicitly.
 */
const TTS_TARGETS = [
  { provider: "openai" as TtsProvider, model: "tts-1", voice: "alloy", format: "opus" as const, used_by: "WhatsApp voice reply" },
  { provider: "openai" as TtsProvider, model: "gpt-4o-mini-tts", voice: "nova", format: "mp3" as const, used_by: "assistant voices" },
  { provider: "elevenlabs" as TtsProvider, model: "eleven_multilingual_v2", voice: process.env.ELEVENLABS_VOICE_ID ?? "", format: "mp3" as const, used_by: "Speech Studio, cloned voices" },
];

const env = (name: string) => process.env[name];

function loadFixtures(): Fixture[] {
  const raw = JSON.parse(readFileSync(path.join(HERE, "fixtures.json"), "utf8"));
  return raw.fixtures as Fixture[];
}

function realAudioFor(id: string): string | null {
  if (!existsSync(AUDIO_DIR)) return null;
  const match = readdirSync(AUDIO_DIR).find((file) => file.replace(/\.[^.]+$/, "") === id);
  return match ? path.join(AUDIO_DIR, match) : null;
}

const MIME_FOR_EXT: Record<string, string> = {
  ".ogg": "audio/ogg", ".opus": "audio/ogg", ".mp3": "audio/mpeg",
  ".wav": "audio/wav", ".m4a": "audio/mp4", ".webm": "audio/webm",
};

/** One transcription call, timed. Never throws. */
async function transcribe(
  target: (typeof STT_TARGETS)[number],
  audio: { bytes: Uint8Array; mimeType: string; filename: string },
) {
  const key = env(target.key);
  if (!key) return { status: "unmeasured" as const, why: `${target.key} is not set` };

  const form = new FormData();
  form.append("file", new Blob([audio.bytes], { type: audio.mimeType }), audio.filename);
  form.append("model", target.model);

  const started = Date.now();
  try {
    const response = await fetch(target.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    const ms = Date.now() - started;
    if (!response.ok) {
      return { status: "failed" as const, ms, why: `HTTP ${response.status}` };
    }
    const json = await response.json() as { text?: string };
    return { status: "ok" as const, ms, text: (json.text ?? "").trim() };
  } catch (error) {
    return {
      status: "failed" as const,
      ms: Date.now() - started,
      why: error instanceof Error ? error.name : "transport",
    };
  }
}

async function main() {
  const fixtures = loadFixtures();
  const startedAt = new Date().toISOString();
  const results: Record<string, unknown>[] = [];
  const ttsResults: Record<string, unknown>[] = [];

  console.log(`Visionex voice baseline — ${fixtures.length} fixtures, started ${startedAt}`);
  console.log("");

  // ── TTS: latency, format, validity ───────────────────────────────────────
  // One short fixture per language is enough to characterise a target; the
  // point is whether it synthesises, how fast, and whether the bytes are the
  // container the caller claimed.
  // One conversational fixture per language, so TTS is validated across the
  // whole product scope rather than in the two languages this started as.
  const ttsProbe = Object.values(
    fixtures
      .filter((f) => f.category === "conversational" && !f.requiresRealAudio)
      .reduce<Record<string, Fixture>>((first, fixture) => {
        first[fixture.language] ??= fixture;
        return first;
      }, {}),
  );

  for (const target of TTS_TARGETS) {
    const keyName = target.provider === "openai" ? "OPENAI_API_KEY" : "ELEVENLABS_API_KEY";
    if (!env(keyName)) {
      ttsResults.push({ ...target, status: "unmeasured", why: `${keyName} is not set` });
      continue;
    }
    if (target.provider === "elevenlabs" && !target.voice) {
      ttsResults.push({ ...target, status: "unmeasured", why: "no library voice id supplied (set ELEVENLABS_VOICE_ID)" });
      continue;
    }

    for (const fixture of ttsProbe) {
      const started = Date.now();
      const spoken = await synthesize({
        text: fixture.text,
        provider: target.provider,
        model: target.model,
        voice: target.voice,
        format: target.format,
        read: env,
      });
      const ms = Date.now() - started;

      if (spoken.outcome === "failed") {
        ttsResults.push({ ...target, fixture: fixture.id, status: "failed", ms, failure: spoken.failure.reason });
        continue;
      }
      const validity = audioLooksValid(spoken.bytes, spoken.mimeType);
      ttsResults.push({
        ...target,
        fixture: fixture.id,
        language: fixture.language,
        status: "ok",
        ms,
        bytes: spoken.bytes.byteLength,
        mimeType: spoken.mimeType,
        valid: validity.valid,
        container: validity.container ?? validity.reason,
        // The WhatsApp path accepts exactly this, and rejects anything else.
        whatsappCompatible: spoken.mimeType === "audio/ogg",
      });
    }
  }

  // ── STT: WER and CER per fixture per provider ────────────────────────────
  for (const fixture of fixtures) {
    const real = realAudioFor(fixture.id);
    let audio: { bytes: Uint8Array; mimeType: string; filename: string } | null = null;
    let source: string;

    if (real) {
      const ext = path.extname(real).toLowerCase();
      audio = {
        bytes: new Uint8Array(readFileSync(real)),
        mimeType: MIME_FOR_EXT[ext] ?? "audio/ogg",
        filename: path.basename(real),
      };
      source = "recording";
    } else if (fixture.requiresRealAudio) {
      results.push({ fixture: fixture.id, language: fixture.language, dialect: fixture.dialect, status: "unmeasured", why: "needs a real recording; synthetic speech cannot represent this case" });
      continue;
    } else if (!env("OPENAI_API_KEY")) {
      results.push({ fixture: fixture.id, language: fixture.language, dialect: fixture.dialect, status: "unmeasured", why: "no recording, and OPENAI_API_KEY is not set to synthesise one" });
      continue;
    } else {
      const spoken = await synthesize({
        text: fixture.text, provider: "openai", model: "tts-1",
        voice: fixture.language === "ar" ? "alloy" : "alloy", format: "opus", read: env,
      });
      if (spoken.outcome === "failed") {
        results.push({ fixture: fixture.id, status: "unmeasured", why: `could not synthesise audio: ${spoken.failure.reason}` });
        continue;
      }
      audio = { bytes: spoken.bytes, mimeType: "audio/ogg", filename: `${fixture.id}.ogg` };
      source = "synthesised";
    }

    for (const target of STT_TARGETS) {
      const heard = await transcribe(target, audio);
      if (heard.status !== "ok") {
        results.push({ fixture: fixture.id, language: fixture.language, dialect: fixture.dialect, provider: target.name, model: target.model, source, status: heard.status, why: heard.why, ms: "ms" in heard ? heard.ms : undefined });
        continue;
      }
      const score = scoreTranscript(fixture.text, heard.text);
      results.push({
        fixture: fixture.id, language: fixture.language, dialect: fixture.dialect,
        category: fixture.category, provider: target.name, model: target.model,
        source, status: "ok", ms: heard.ms,
        wer: score.wer, cer: score.cer, counts: score.counts,
        transcript: heard.text,
      });
    }
  }

  // ── Summary. Metrics only: no transcript reaches the terminal. ───────────
  const measured = results.filter((r) => r.status === "ok");
  console.log(`STT: ${measured.length} measured, ${results.length - measured.length} unmeasured`);
  // Every language the corpus actually carries, not a hardcoded pair: this
  // summary is the thing somebody reads to decide whether a language is
  // usable, so a language missing from it reads as a language nobody asked
  // about rather than one nobody measured.
  const languagesInCorpus = [...new Set(fixtures.map((f) => f.language))].sort();
  for (const provider of STT_TARGETS.map((t) => t.name)) {
    for (const language of languagesInCorpus) {
      const rows = measured.filter((r) => r.provider === provider && r.language === language);
      if (rows.length === 0) {
        console.log(`  ${provider} ${language}: UNMEASURED`);
        continue;
      }
      const w = mean(rows.map((r) => (r.wer as { normalized: number }).normalized));
      const c = mean(rows.map((r) => (r.cer as { normalized: number }).normalized));
      const ms = mean(rows.map((r) => r.ms as number));
      console.log(`  ${provider} ${language}: WER ${(w! * 100).toFixed(1)}%  CER ${(c! * 100).toFixed(1)}%  ${Math.round(ms!)} ms  (n=${rows.length}, normalised)`);
    }
  }

  console.log("");
  console.log("TTS:");
  for (const row of ttsResults) {
    const label = `${row.provider}/${row.model}`;
    if (row.status !== "ok") {
      console.log(`  ${label}: ${String(row.status).toUpperCase()} — ${row.why ?? row.failure}`);
      continue;
    }
    console.log(`  ${label} ${row.language}: ${row.ms} ms, ${row.bytes} bytes, ${row.mimeType}, valid=${row.valid}, whatsapp=${row.whatsappCompatible}`);
  }

  const outDir = path.join(tmpdir(), "visionex-voice-baseline");
  mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `baseline-${startedAt.slice(0, 10)}.json`);
  writeFileSync(outFile, JSON.stringify({ startedAt, fixtures: fixtures.length, stt: results, tts: ttsResults }, null, 2));
  console.log("");
  console.log(`Full results, including transcripts: ${outFile}`);
}

await main();
