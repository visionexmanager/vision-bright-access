export const XP_RULES = { play:10, completion:20, win:50, achievement:25, record:30, challenge:75 } as const;

export function levelFromXp(xp: number) {
  const safe = Math.max(0, Math.floor(xp));
  const level = Math.floor(Math.sqrt(safe / 100)) + 1;
  const levelStart = (level - 1) ** 2 * 100;
  const nextLevel = level ** 2 * 100;
  return { level, xp:safe, levelStart, nextLevel, progress:Math.round(((safe - levelStart) / Math.max(1, nextLevel - levelStart)) * 100) };
}

export function calculateLocalXp(input: { plays:number; completions:number; wins:number; achievements:number }) {
  return input.plays * XP_RULES.play + input.completions * XP_RULES.completion + input.wins * XP_RULES.win + input.achievements * XP_RULES.achievement;
}
