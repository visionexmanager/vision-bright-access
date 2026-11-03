/**
 * VisionKids — game sounds and read-aloud.
 *
 * The sounds are synthesised with the Web Audio API, so there is nothing to download, nothing to host and
 * nothing that can fail to load on a slow connection. They are short, soft and rising for good news and
 * falling for bad news, so a child who cannot see the colour change still hears whether they were right.
 *
 * Both features are preferences, stored beside the other VisionKids accessibility preferences. Sounds
 * default to on (a game with no feedback is a worse game); automatic reading aloud defaults to off, because
 * a screen reader user already hears the page and two voices at once is worse than one.
 */

const SOUND_KEY = "kids:sound";
const SPEECH_KEY = "kids:speech";

function read(key: string, fallback: boolean): boolean {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : v === "true";
  } catch {
    return fallback;
  }
}

function write(key: string, value: boolean): void {
  try { window.localStorage.setItem(key, String(value)); } catch { /* private window: the choice lasts until reload */ }
  try { window.dispatchEvent(new Event("visionkids:a11y-change")); } catch { /* not a browser */ }
}

export const getKidsSoundEnabled = (): boolean => (typeof window === "undefined" ? false : read(SOUND_KEY, true));
export const setKidsSoundEnabled = (on: boolean): void => write(SOUND_KEY, on);
export const getKidsSpeechEnabled = (): boolean => (typeof window === "undefined" ? false : read(SPEECH_KEY, false));
export const setKidsSpeechEnabled = (on: boolean): void => { write(SPEECH_KEY, on); if (!on) cancelKidsSpeech(); };

export type KidsSound = "tap" | "point" | "correct" | "wrong" | "start" | "win" | "lose";

interface Note { f: number; at: number; len: number; type?: OscillatorType; gain?: number }

const C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99, A4 = 440, C6 = 1046.5, E4 = 329.63, G4 = 392, C4 = 261.63;

/** Each sound as a handful of notes: frequency, start (s), length (s). */
export const KIDS_SOUNDS: Readonly<Record<KidsSound, readonly Note[]>> = {
  tap: [{ f: 660, at: 0, len: 0.05, type: "triangle", gain: 0.6 }],
  point: [{ f: E5, at: 0, len: 0.08, type: "triangle" }, { f: A4 * 2, at: 0.07, len: 0.1, type: "triangle" }],
  correct: [{ f: C5, at: 0, len: 0.12 }, { f: E5, at: 0.1, len: 0.12 }, { f: G5, at: 0.2, len: 0.22 }],
  wrong: [{ f: 220, at: 0, len: 0.16, type: "sawtooth", gain: 0.5 }, { f: 165, at: 0.14, len: 0.26, type: "sawtooth", gain: 0.5 }],
  start: [{ f: C5, at: 0, len: 0.1 }, { f: G5, at: 0.09, len: 0.18 }],
  win: [{ f: C5, at: 0, len: 0.14 }, { f: E5, at: 0.13, len: 0.14 }, { f: G5, at: 0.26, len: 0.14 }, { f: C6, at: 0.39, len: 0.4 }],
  lose: [{ f: G4, at: 0, len: 0.2, type: "triangle" }, { f: E4, at: 0.2, len: 0.2, type: "triangle" }, { f: C4, at: 0.4, len: 0.4, type: "triangle" }],
};

interface Ctx { createOscillator(): OscillatorNode; createGain(): GainNode; destination: AudioNode; currentTime: number; state: string; resume(): Promise<void> }
let context: Ctx | null = null;

function audio(): Ctx | null {
  if (context) return context;
  const Ctor = (window as unknown as { AudioContext?: new () => Ctx; webkitAudioContext?: new () => Ctx }).AudioContext
    ?? (window as unknown as { webkitAudioContext?: new () => Ctx }).webkitAudioContext;
  if (!Ctor) return null;
  try { context = new Ctor(); } catch { context = null; }
  return context;
}

/** Plays one sound, when sounds are on. Never throws, and never plays anything for a reader who turned them off. */
export function playKidsSound(name: KidsSound): void {
  if (typeof window === "undefined" || !getKidsSoundEnabled()) return;
  const ctx = audio();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    for (const note of KIDS_SOUNDS[name]) {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = note.type ?? "sine";
      osc.frequency.value = note.f;
      const peak = 0.16 * (note.gain ?? 1);
      amp.gain.setValueAtTime(0.0001, now + note.at);
      amp.gain.exponentialRampToValueAtTime(peak, now + note.at + 0.015);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + note.at + note.len);
      osc.connect(amp);
      amp.connect(ctx.destination);
      osc.start(now + note.at);
      osc.stop(now + note.at + note.len + 0.02);
    }
  } catch { /* a browser that refuses audio: the game goes on in silence */ }
}

// ─── Reading aloud ─────────────────────────────────────────────────────────

export function kidsSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

export function cancelKidsSpeech(): void {
  if (kidsSpeechSupported()) try { window.speechSynthesis.cancel(); } catch { /* nothing to cancel */ }
}

/** Reads text aloud in the given language, replacing anything still being read. */
export function speakKids(text: string, lang: string): void {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean || !kidsSpeechSupported()) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = lang;
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  } catch { /* the page still shows the text */ }
}

/** Reads aloud only when the reader turned automatic reading on. */
export function speakKidsIfOn(text: string, lang: string): void {
  if (getKidsSpeechEnabled()) speakKids(text, lang);
}
