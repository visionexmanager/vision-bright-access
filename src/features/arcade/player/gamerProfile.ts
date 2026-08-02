import { ARCADE_GAMES } from "../catalog";
import { playerGameData } from "../core/playerGameData";
import { calculateLocalXp, levelFromXp } from "./xpSystem";

const FAVORITES_KEY = "visionex-arcade-favorites-v1";
export function readFavoriteGames(): string[] { try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]"); } catch { return []; } }
export function toggleFavoriteGame(gameId:string) { const next = new Set(readFavoriteGames()); if (next.has(gameId)) { next.delete(gameId); } else { next.add(gameId); } localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next])); window.dispatchEvent(new Event("visionex:arcade-favorites")); return [...next]; }

export function getGamerProfileSnapshot() {
  const records = ARCADE_GAMES.map((game) => ({ game, data:playerGameData.get(game.slug) }));
  const plays = records.reduce((sum,item) => sum + item.data.playCount, 0);
  const completions = records.reduce((sum,item) => sum + item.data.completionCount, 0);
  const wins = records.reduce((sum,item) => sum + item.data.winCount, 0);
  const achievements = [...new Set(records.flatMap((item) => item.data.achievements))];
  const xp = calculateLocalXp({ plays, completions, wins, achievements:achievements.length });
  const mostPlayed = [...records].sort((a,b) => b.data.playCount - a.data.playCount)[0];
  const bestScores = records.filter((item) => item.data.highScore > 0).sort((a,b) => b.data.highScore - a.data.highScore).slice(0,5);
  return { records, plays, completions, wins, achievements, xp, ...levelFromXp(xp), mostPlayed:mostPlayed?.data.playCount ? mostPlayed : undefined, bestScores, totalSeconds:records.reduce((sum,item) => sum + item.data.totalPlaySeconds,0), favorites:readFavoriteGames() };
}
