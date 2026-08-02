import type { GameSettings } from "./types";

const KEY = "visionex-arcade-settings-v1";

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  musicVolume: 70,
  effectsVolume: 85,
  voiceVolume: 90,
  ambientVolume: 65,
  muted: false,
  highQualityAudio: true,
  qualityMode: "auto",
  keyboardMode: true,
  screenReaderMode: false,
  highContrastMode: false,
  reducedMotion: false,
};

export function readGameSettings(): GameSettings {
  try { return { ...DEFAULT_GAME_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; }
  catch { return DEFAULT_GAME_SETTINGS; }
}

export function saveGameSettings(settings: GameSettings) {
  localStorage.setItem(KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent("visionex:arcade-settings", { detail: settings }));
}
