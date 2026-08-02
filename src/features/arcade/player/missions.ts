import { playerGameData } from "../core/playerGameData";
import { ARCADE_GAMES } from "../catalog";

export type Mission = { id:string; title:string; target:number; progress:number; rewardXp:number; period:"daily" | "weekly" };
export function getMissions(now = new Date()): Mission[] {
  const all = ARCADE_GAMES.flatMap((game) => playerGameData.sessions(game.slug));
  const today = now.toISOString().slice(0,10);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const daily = all.filter((item) => item.startedAt.slice(0,10) === today);
  const weekly = all.filter((item) => new Date(item.startedAt) >= weekAgo);
  return [
    { id:"daily-three", title:"Play 3 games today", target:3, progress:Math.min(3,daily.length), rewardXp:75, period:"daily" },
    { id:"daily-win", title:"Win a game today", target:1, progress:daily.some((item) => item.result === "win") ? 1 : 0, rewardXp:100, period:"daily" },
    { id:"weekly-seven", title:"Complete 7 games this week", target:7, progress:Math.min(7,weekly.filter((item) => item.completed).length), rewardXp:250, period:"weekly" },
  ];
}
