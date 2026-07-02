import type { AcademyBadgeTier } from "@/lib/types/academy-gamification";

interface TierStyle {
  label: string;
  gradient: string;
  border: string;
  text: string;
}

export const TIER_STYLES: Record<AcademyBadgeTier, TierStyle> = {
  bronze:    { label: "برونزي",  gradient: "from-amber-700/20 to-amber-700/5",  border: "border-amber-700/40",  text: "text-amber-700" },
  silver:    { label: "فضي",     gradient: "from-slate-400/20 to-slate-400/5",  border: "border-slate-400/40",  text: "text-slate-400" },
  gold:      { label: "ذهبي",    gradient: "from-yellow-500/20 to-yellow-500/5", border: "border-yellow-500/40", text: "text-yellow-500" },
  platinum:  { label: "بلاتيني", gradient: "from-cyan-400/20 to-cyan-400/5",    border: "border-cyan-400/40",   text: "text-cyan-400" },
  diamond:   { label: "ماسي",    gradient: "from-sky-400/20 to-sky-400/5",      border: "border-sky-400/40",    text: "text-sky-400" },
  legendary: { label: "أسطوري",  gradient: "from-fuchsia-500/20 to-fuchsia-500/5", border: "border-fuchsia-500/40", text: "text-fuchsia-500" },
};

export const MISSION_SCOPE_LABELS: Record<string, string> = {
  daily: "يومية",
  weekly: "أسبوعية",
  monthly: "شهرية",
  seasonal: "موسمية",
};

export const LEARNING_CARD_RARITY_STYLES: Record<string, TierStyle> = {
  common:    { label: "عادية",   gradient: "from-slate-400/20 to-slate-400/5",  border: "border-slate-400/40",  text: "text-slate-400" },
  rare:      { label: "نادرة",   gradient: "from-blue-500/20 to-blue-500/5",    border: "border-blue-500/40",   text: "text-blue-500" },
  epic:      { label: "ملحمية",  gradient: "from-purple-500/20 to-purple-500/5", border: "border-purple-500/40", text: "text-purple-500" },
  legendary: { label: "أسطورية", gradient: "from-fuchsia-500/20 to-fuchsia-500/5", border: "border-fuchsia-500/40", text: "text-fuchsia-500" },
};
