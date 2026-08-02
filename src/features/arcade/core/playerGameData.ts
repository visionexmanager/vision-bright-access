import type { GameSessionRecord, PlayerGameData } from "./types";

const DATA_KEY = "visionex-arcade-player-data-v1";
const SESSIONS_KEY = "visionex-arcade-sessions-v1";

function read<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? "") as T; }
  catch { return fallback; }
}

function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage may be unavailable */ }
}

export interface PlayerGameDataRepository {
  get(gameId: string): PlayerGameData;
  save(data: PlayerGameData): void;
  addSession(session: GameSessionRecord): void;
  sessions(gameId: string): GameSessionRecord[];
}

export class LocalPlayerGameDataRepository implements PlayerGameDataRepository {
  get(gameId: string): PlayerGameData {
    const all = read<Record<string, PlayerGameData>>(DATA_KEY, {});
    return { gameId, highScore:0, totalPlaySeconds:0, playCount:0, completionCount:0, winCount:0, lastScore:0, highestLevel:0, achievements:[], settings:{}, ...all[gameId] };
  }

  save(data: PlayerGameData) {
    const all = read<Record<string, PlayerGameData>>(DATA_KEY, {});
    all[data.gameId] = data;
    write(DATA_KEY, all);
    window.dispatchEvent(new CustomEvent("visionex:arcade-player-data", { detail: data }));
  }

  addSession(session: GameSessionRecord) {
    const sessions = read<GameSessionRecord[]>(SESSIONS_KEY, []);
    write(SESSIONS_KEY, [session, ...sessions].slice(0, 250));
  }

  sessions(gameId: string) {
    return read<GameSessionRecord[]>(SESSIONS_KEY, []).filter((session) => session.gameId === gameId);
  }
}

/** Remote repositories can implement this contract after the live Supabase schema is verified. */
export const playerGameData = new LocalPlayerGameDataRepository();
