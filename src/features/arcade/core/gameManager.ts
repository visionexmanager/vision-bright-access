import { gameAnalytics } from "./gameAnalytics";
import { playerGameData } from "./playerGameData";
import type { GameRuntimeSnapshot, GameSessionRecord } from "./types";
import { evaluateAchievements } from "./achievements";
import { gameRegistry } from "./gameRegistry";

const initial: GameRuntimeSnapshot = { status: "idle", score: 0, revision: 0 };

export class GameManager extends EventTarget {
  private snapshot: GameRuntimeSnapshot = initial;
  private startedAt = 0;

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.addEventListener("change", listener);
    return () => this.removeEventListener("change", listener);
  };

  private set(next: Partial<GameRuntimeSnapshot>) {
    this.snapshot = { ...this.snapshot, ...next };
    this.dispatchEvent(new Event("change"));
  }

  start(gameId: string) {
    if (this.snapshot.gameId === gameId && this.snapshot.status === "running") return this.snapshot.sessionId!;
    const sessionId = crypto.randomUUID();
    this.startedAt = Date.now();
    this.set({ gameId, sessionId, status: "running", score: 0, error: undefined });
    const data = playerGameData.get(gameId);
    const next = { ...data, lastPlayedAt:new Date().toISOString(), playCount:data.playCount + 1 };
    playerGameData.save({ ...next, achievements:evaluateAchievements(next) });
    gameAnalytics.track("game_start", { gameId });
    return sessionId;
  }

  pause() { if (this.snapshot.status === "running") this.set({ status: "paused" }); }
  resume() { if (this.snapshot.status === "paused") this.set({ status: "running" }); }

  restart() {
    const gameId = this.snapshot.gameId;
    if (!gameId) return;
    this.finish("abandoned", false);
    this.set({ revision: this.snapshot.revision + 1 });
    this.start(gameId);
  }

  recordScore(score: number) {
    const gameId = this.snapshot.gameId;
    if (!gameId || !Number.isFinite(score)) return;
    this.set({ score: Math.max(this.snapshot.score, score) });
    const data = playerGameData.get(gameId);
    if (score > data.highScore) playerGameData.save({ ...data, highScore: score });
  }

  recordLevel(level: number) {
    const gameId = this.snapshot.gameId;
    if (!gameId || !Number.isFinite(level) || level < 0) return;
    const data = playerGameData.get(gameId);
    if (level > data.highestLevel) playerGameData.save({ ...data, highestLevel:Math.floor(level) });
  }

  complete(result: "win" | "loss" | "draw", score = this.snapshot.score) {
    this.recordScore(score);
    this.finish(result, true);
  }

  stop() {
    if (["running", "paused"].includes(this.snapshot.status)) this.finish("abandoned", false);
    this.set({ status: "stopped" });
  }

  fail(error: unknown) {
    const gameId = this.snapshot.gameId;
    this.set({ status: "error", error: error instanceof Error ? error.message : String(error) });
    if (gameId) gameAnalytics.track("game_error", { gameId });
  }

  private finish(result: GameSessionRecord["result"], completed: boolean) {
    const { gameId, sessionId, score } = this.snapshot;
    if (!gameId || !sessionId || !this.startedAt) return;
    const durationSeconds = Math.max(0, Math.round((Date.now() - this.startedAt) / 1000));
    playerGameData.addSession({ id: sessionId, gameId, startedAt: new Date(this.startedAt).toISOString(), endedAt: new Date().toISOString(), durationSeconds, score, result, completed });
    const data = playerGameData.get(gameId);
    const definition = gameRegistry.get(gameId);
    const next = { ...data, totalPlaySeconds:data.totalPlaySeconds + durationSeconds, completionCount:data.completionCount + (completed ? 1 : 0), winCount:data.winCount + (result === "win" ? 1 : 0), lastScore:score, highScore:Math.max(data.highScore, score) };
    playerGameData.save({ ...next, achievements:evaluateAchievements(next, { won:result === "win", newRecord:score > data.highScore, hard:completed && definition?.difficulty === "Hard" }) });
    gameAnalytics.track(completed ? "game_complete" : "game_abandon", { gameId, durationSeconds, completed });
    this.startedAt = 0;
    this.set({ status: completed ? "completed" : "stopped" });
  }
}

export const gameManager = new GameManager();
