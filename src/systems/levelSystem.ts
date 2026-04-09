/**
 * Level & stage progression system.
 * Levels are derived from total points; stages group every 10 levels.
 */

export function calculateLevel(points: number): number {
  return Math.floor(points / 5000);
}

export function calculateStage(level: number): number {
  return Math.floor(level / 10);
}

export const STAGE_ICONS = [
  "⭐", "🌟", "✨", "🔰", "🛡",
  "⚔", "🔥", "💠", "🧿", "🏅",
  "🎖", "🏆", "💎", "👑", "👑✨",
  "🌌", "🪐", "☄", "🌠", "🌟👑",
] as const;

export function getStageIcon(points: number): string {
  const level = calculateLevel(points);
  const stage = calculateStage(level);
  return STAGE_ICONS[Math.min(stage, STAGE_ICONS.length - 1)];
}
