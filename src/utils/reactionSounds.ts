import { REACTION_SOUND_MANIFEST } from "@/data/reactionSoundManifest";

const MASTER_VOLUME = 0.72;
const DUCKED_VOLUME = 0.16;
const MIN_GAP_MS = 70;
const MAX_SIMULTANEOUS_SOUNDS = 5;

const audioPool = new Map<string, HTMLAudioElement>();
const activeSounds = new Set<HTMLAudioElement>();
let lastPlayAt = 0;
let isDucking = false;
let preloadStarted = false;

function normalizeEmoji(emoji: string): string {
  const exact = REACTION_SOUND_MANIFEST[emoji];
  if (exact) return emoji;

  const withoutSkinTone = Array.from(emoji)
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint < 0x1f3fb || codePoint > 0x1f3ff;
    })
    .join("");

  if (REACTION_SOUND_MANIFEST[withoutSkinTone]) return withoutSkinTone;

  const withoutPresentation = withoutSkinTone.replace(/\ufe0f/g, "");
  if (REACTION_SOUND_MANIFEST[withoutPresentation]) return withoutPresentation;

  const withPresentation = `${withoutPresentation}\ufe0f`;
  return REACTION_SOUND_MANIFEST[withPresentation] ? withPresentation : emoji;
}

function targetVolume(): number {
  return MASTER_VOLUME * (isDucking ? DUCKED_VOLUME : 1);
}

function createAudio(emoji: string): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  const source = REACTION_SOUND_MANIFEST[emoji];
  if (!source) return null;

  const audio = new Audio(source);
  audio.preload = "auto";
  audio.volume = targetVolume();
  audio.setAttribute("playsinline", "");
  audioPool.set(emoji, audio);
  return audio;
}

function getAudio(emoji: string): HTMLAudioElement | null {
  return audioPool.get(emoji) ?? createAudio(emoji);
}

function releaseAudio(audio: HTMLAudioElement): void {
  activeSounds.delete(audio);
  audio.onended = null;
  audio.onerror = null;
}

function stopOldestSound(): void {
  const oldest = activeSounds.values().next().value as HTMLAudioElement | undefined;
  if (!oldest) return;
  oldest.pause();
  oldest.currentTime = 0;
  releaseAudio(oldest);
}

export function playReactionSound(emoji: string): void {
  const now = Date.now();
  if (now - lastPlayAt < MIN_GAP_MS) return;
  lastPlayAt = now;

  const key = normalizeEmoji(emoji);
  const template = getAudio(key);
  if (!template) return;

  if (activeSounds.size >= MAX_SIMULTANEOUS_SOUNDS) stopOldestSound();

  const audio = template.cloneNode(true) as HTMLAudioElement;
  audio.volume = targetVolume();
  audio.currentTime = 0;
  audio.onended = () => releaseAudio(audio);
  audio.onerror = () => releaseAudio(audio);
  activeSounds.add(audio);

  void audio.play().catch(() => releaseAudio(audio));
}

export function setVoiceSpeakingState(speaking: boolean): void {
  isDucking = speaking;
  const volume = targetVolume();
  audioPool.forEach((audio) => { audio.volume = volume; });
  activeSounds.forEach((audio) => { audio.volume = volume; });
}

export function preloadReactionSounds(): void {
  if (preloadStarted || typeof window === "undefined") return;
  preloadStarted = true;

  const entries = Object.keys(REACTION_SOUND_MANIFEST);
  const preloadBatch = (start: number) => {
    entries.slice(start, start + 12).forEach((emoji) => {
      const audio = getAudio(emoji);
      audio?.load();
    });
    if (start + 12 < entries.length) {
      window.setTimeout(() => preloadBatch(start + 12), 120);
    }
  };

  preloadBatch(0);
}

export function disposeReactionSounds(): void {
  activeSounds.forEach((audio) => {
    audio.pause();
    audio.currentTime = 0;
  });
  activeSounds.clear();

  audioPool.forEach((audio) => {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  });
  audioPool.clear();
  lastPlayAt = 0;
  isDucking = false;
  preloadStarted = false;
}
