import { Star } from "lucide-react";
import type { AcademyLevelInfo } from "@/lib/academy/leveling";
import { useLanguage } from "@/contexts/LanguageContext";

interface LevelBadgeProps {
  levelInfo: AcademyLevelInfo;
  /** Show the rank title text next to the level number. Off by default for tight spaces (navbar/sidebar chips). */
  showRank?: boolean;
}

/** Compact level chip — for navbars, sidebars, profile headers. For the full progress panel see LevelProgressCard. */
export function LevelBadge({ levelInfo, showRank = false }: LevelBadgeProps) {
  const { lang } = useLanguage();
  const ranks: Record<string, string> = { "متعلّم مبتدئ": "Beginner Learner", "متعلّم صاعد": "Rising Learner", "متعلّم متمكّن": "Skilled Learner", "خبير متعلّم": "Expert Learner", "أستاذ التعلّم الذاتي": "Self-Learning Master", "أسطورة الأكاديمية": "Academy Legend" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-card ${levelInfo.rank.colorClass} border-current/30`}>
      <Star className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
      <span className="text-xs font-black">{lang === "ar" ? "المستوى" : "Level"} {levelInfo.level}</span>
      {showRank && <span className="text-xs font-medium opacity-80">· {lang === "ar" ? levelInfo.rank.rank : (ranks[levelInfo.rank.rank] ?? levelInfo.rank.rank)}</span>}
    </span>
  );
}
