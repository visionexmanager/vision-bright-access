type EventName = "game_start" | "game_complete" | "game_abandon" | "game_error" | "asset_error";
type EventPayload = { gameId: string; durationSeconds?: number; completed?: boolean };

const KEY = "visionex-arcade-analytics-v1";

/** Privacy-first local aggregates: no user id, content, IP address, or device fingerprint. */
export class GameAnalytics {
  track(name: EventName, payload: EventPayload) {
    try {
      const current = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, number>;
      const metric = `${payload.gameId}:${name}`;
      current[metric] = (current[metric] ?? 0) + 1;
      if (payload.durationSeconds) current[`${payload.gameId}:seconds`] = (current[`${payload.gameId}:seconds`] ?? 0) + payload.durationSeconds;
      localStorage.setItem(KEY, JSON.stringify(current));
    } catch { /* analytics never blocks a game */ }
  }
}

export const gameAnalytics = new GameAnalytics();
