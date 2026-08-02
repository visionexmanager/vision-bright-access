import type { PlayerGameData } from "./types";

export const ARCADE_ACHIEVEMENTS = [
  { id:"first-play", title:"First Steps", description:"Play this game for the first time." },
  { id:"first-win", title:"First Victory", description:"Win your first completed match." },
  { id:"ten-wins", title:"Proven Champion", description:"Win ten matches." },
  { id:"record-setter", title:"Record Setter", description:"Finish with a new personal best." },
  { id:"hard-complete", title:"Challenge Accepted", description:"Complete a hard game." },
] as const;

export function evaluateAchievements(data: PlayerGameData, context: { won?:boolean; newRecord?:boolean; hard?:boolean } = {}) {
  const unlocked = new Set(data.achievements);
  if (data.playCount >= 1) unlocked.add("first-play");
  if (context.won || data.winCount >= 1) unlocked.add("first-win");
  if (data.winCount >= 10) unlocked.add("ten-wins");
  if (context.newRecord && data.lastScore > 0) unlocked.add("record-setter");
  if (context.hard && data.completionCount > 0) unlocked.add("hard-complete");
  return [...unlocked];
}
