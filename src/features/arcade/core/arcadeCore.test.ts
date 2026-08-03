import { beforeEach, describe, expect, it, vi } from "vitest";
import { gameRegistry, GAME_REGISTRY } from "./gameRegistry";
import { GameManager } from "./gameManager";
import { LocalPlayerGameDataRepository } from "./playerGameData";
import { DEFAULT_GAME_SETTINGS, readGameSettings, saveGameSettings } from "./gameSettings";
import { VisualAssetsManager } from "./visualAssetsManager";
import { AUDIO_LIBRARY, audioLibrary } from "../audio/audioLibrary";
import { auditAudioLibrary } from "../audio/audioQuality";
import { AdvancedAudioEngine } from "../audio/AdvancedAudioEngine";
import { ARCADE_GAMES } from "../catalog";

describe("Visionex Arcade core", () => {
  beforeEach(() => localStorage.clear());

  it("registers all legacy games with unique ids, paths, assets, and lazy loaders", () => {
    expect(GAME_REGISTRY).toHaveLength(ARCADE_GAMES.length);
    expect(new Set(GAME_REGISTRY.map((game) => game.slug)).size).toBe(ARCADE_GAMES.length);
    for (const game of GAME_REGISTRY) {
      expect(gameRegistry.fromPath(game.to)?.slug).toBe(game.slug);
      expect(game.loader).toBeTypeOf("function");
      expect(game.assets[0]?.src).toBeTruthy();
    }
  });

  it("starts, scores, completes, and persists a game session", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-02T12:00:00Z"));
    const manager = new GameManager();
    manager.start("memory");
    manager.recordScore(320);
    vi.advanceTimersByTime(90_000);
    manager.complete("win", 320);
    const data = new LocalPlayerGameDataRepository().get("memory");
    expect(data.highScore).toBe(320);
    expect(data.lastScore).toBe(320);
    expect(data.winCount).toBe(1);
    expect(data.achievements).toContain("first-play");
    expect(data.achievements).toContain("first-win");
    expect(data.playCount).toBe(1);
    expect(data.completionCount).toBe(1);
    expect(data.totalPlaySeconds).toBe(90);
    vi.useRealTimers();
  });

  it("persists unified performance and accessibility settings", () => {
    saveGameSettings({ ...DEFAULT_GAME_SETTINGS, qualityMode:"performance", screenReaderMode:true, highContrastMode:true });
    expect(readGameSettings()).toMatchObject({ qualityMode:"performance", screenReaderMode:true, highContrastMode:true });
  });

  it("plays only approved sounds and blocks pending replacements", async () => {
    expect(audioLibrary.playable()).toHaveLength(13);
    const audits = auditAudioLibrary(AUDIO_LIBRARY);
    expect(audits.filter(({ result }) => result.valid)).toHaveLength(13);
    expect(audits.filter(({ result }) => !result.valid)).toHaveLength(AUDIO_LIBRARY.length - 13);
    await expect(new AdvancedAudioEngine().preload("dice-roll")).rejects.toThrow("blocked");
  });

  it("deduplicates visual asset loads", async () => {
    class ReadyImage {
      decoding = "auto"; src = ""; onload?: () => void; onerror?: () => void;
      decode = async () => undefined;
      constructor() { queueMicrotask(() => this.onload?.()); }
    }
    vi.stubGlobal("Image", ReadyImage);
    const manager = new VisualAssetsManager();
    const asset = { id:"memory-cover", kind:"cover" as const, src:"/memory.webp" };
    const [first, second] = await Promise.all([manager.load(asset), manager.load(asset)]);
    expect(first).toBe(second);
    expect(manager.isLoaded(asset.src)).toBe(true);
    vi.unstubAllGlobals();
  });
});
