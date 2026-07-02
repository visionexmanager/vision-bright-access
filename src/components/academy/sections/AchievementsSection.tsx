import { memo, useMemo } from "react";
import { Link } from "react-router-dom";
import { Award, Lock, CheckCircle2, Flame, ArrowLeft } from "lucide-react";
import { AcademySectionHeader } from "../ui/AcademySectionHeader";
import { XP_LEVELS } from "@/lib/academy/xp";
import { getAchievementCatalog, getUserAchievementIds, getStreak } from "@/lib/academy/gamificationLocalStore";

interface AchievementsSectionProps {
  xpFromAcademy: number;
  userId: string;
}

export const AchievementsSection = memo(function AchievementsSection({
  xpFromAcademy,
  userId,
}: AchievementsSectionProps) {
  const catalog = useMemo(() => getAchievementCatalog(), []);
  const unlockedCount = useMemo(() => getUserAchievementIds(userId).size, [userId]);
  const streakDays = useMemo(() => getStreak(userId).current_streak_days, [userId]);

  return (
    <section aria-labelledby="achievements-heading" className="bg-card p-8 rounded-3xl border border-border shadow-lg">
      <AcademySectionHeader
        icon={Award}
        title="الإنجازات"
        description="كل مستوى تصله يفتح شارة جديدة"
        headingId="achievements-heading"
      />
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {XP_LEVELS.map((level) => {
          const achieved = xpFromAcademy >= level.min;
          return (
            <li
              key={level.label}
              className={`flex items-center gap-3 p-4 rounded-2xl border ${
                achieved
                  ? "border-primary/30 bg-primary/5"
                  : "border-dashed border-border bg-muted/30 opacity-70"
              }`}
            >
              <div
                className={`p-2.5 rounded-xl shrink-0 ${achieved ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                aria-hidden="true"
              >
                {achieved ? <CheckCircle2 className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
              </div>
              <div>
                <p className="font-bold text-foreground text-sm">{level.label}</p>
                <p className="text-xs text-muted-foreground">
                  {achieved ? "تم تحقيقه" : `يفتح عند ${level.min.toLocaleString()} XP`}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between gap-3 flex-wrap mt-6 pt-6 border-t border-border">
        <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground">
          <span className="flex items-center gap-1.5"><Award className="w-3.5 h-3.5 text-primary" aria-hidden="true" />{unlockedCount} / {catalog.length} إنجاز مُنجَز</span>
          <span className="flex items-center gap-1.5"><Flame className="w-3.5 h-3.5 text-orange-500" aria-hidden="true" />{streakDays} يوم تتابع</span>
        </div>
        <Link to="/academy/achievements" className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">
          عرض كل الإنجازات والشارات
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
});
