import type { PremiumFloatingReaction } from "./PremiumReactions";

const GLOW: Record<string, string> = {
  "👍":  "rgba(250,204,21,0.75)",
  "❤️":  "rgba(239,68,68,0.8)",
  "😂":  "rgba(250,204,21,0.65)",
  "😮":  "rgba(251,146,60,0.75)",
  "👏":  "rgba(250,204,21,0.65)",
  "🔥":  "rgba(249,115,22,0.9)",
  "💯":  "rgba(239,68,68,0.7)",
  "⭐":  "rgba(250,204,21,0.85)",
  "🌟":  "rgba(250,204,21,0.9)",
  "✨":  "rgba(196,181,253,0.8)",
  "💫":  "rgba(196,181,253,0.75)",
  "🎉":  "rgba(167,139,250,0.8)",
  "🎊":  "rgba(167,139,250,0.75)",
  "🚀":  "rgba(96,165,250,0.8)",
  "💎":  "rgba(96,165,250,0.9)",
  "🏆":  "rgba(250,204,21,0.9)",
  "🥇":  "rgba(250,204,21,0.9)",
  "💥":  "rgba(249,115,22,0.9)",
  "❄️":  "rgba(147,197,253,0.8)",
  "🌈":  "rgba(167,139,250,0.65)",
  "⚡":  "rgba(250,204,21,0.95)",
  "🌙":  "rgba(196,181,253,0.75)",
  "☀️":  "rgba(251,191,36,0.95)",
  "🎵":  "rgba(167,139,250,0.7)",
  "🎶":  "rgba(167,139,250,0.7)",
  "💪":  "rgba(250,204,21,0.7)",
  "🙌":  "rgba(250,204,21,0.65)",
  "🙏":  "rgba(250,204,21,0.65)",
  "👑":  "rgba(250,204,21,0.95)",
  "🎯":  "rgba(239,68,68,0.8)",
  "💡":  "rgba(250,204,21,0.85)",
};

export function getGlow(emoji: string) {
  return GLOW[emoji] ?? "rgba(255,255,255,0.55)";
}

export function createFloatingReaction(emoji: string): PremiumFloatingReaction {
  return {
    id: Math.random().toString(36).slice(2),
    emoji,
    x:     5 + Math.random() * 82,
    drift: (Math.random() - 0.5) * 130,
    speed: 3500 + Math.random() * 1500,
    size:  2.2 + Math.random() * 1.1,
    glow:  getGlow(emoji),
  };
}
