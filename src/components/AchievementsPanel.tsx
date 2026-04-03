import { useAchievements, AchievementDef } from "@/hooks/useAchievements";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Award } from "lucide-react";

export function AchievementsPanel() {
  const { unlocked, completedCount, loading, achievements } = useAchievements();
  const { t } = useLanguage();

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-8 w-48 mb-4" />
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Award className="h-6 w-6 text-primary" aria-hidden="true" />
          {t("ach.title")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {t("ach.subtitle").replace("{count}", String(completedCount))}
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {achievements.map((ach) => (
            <AchievementCard
              key={ach.key}
              achievement={ach}
              isUnlocked={unlocked.has(ach.key)}
              completedCount={completedCount}
              t={t}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AchievementCard({
  achievement,
  isUnlocked,
  completedCount,
  t,
}: {
  achievement: AchievementDef;
  isUnlocked: boolean;
  completedCount: number;
  t: (key: string) => string;
}) {
  const progress = Math.min(100, (completedCount / achievement.threshold) * 100);

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-3 transition-all ${
        isUnlocked
          ? "border-primary/40 bg-primary/5"
          : "opacity-60 grayscale"
      }`}
    >
      <span className="text-3xl" role="img" aria-hidden="true">
        {achievement.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold truncate">{t(achievement.titleKey)}</p>
          {isUnlocked && (
            <Badge variant="default" className="text-[10px] px-1.5 py-0">
              ✓
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t(achievement.descKey)}</p>
        {!isUnlocked && (
          <Progress value={progress} className="h-1.5 mt-1.5" />
        )}
      </div>
    </div>
  );
}
