import { Trophy, Coins, Users } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LibraryChallengeWithProgress } from "@/lib/types/library-home";

interface ChallengeCardProps {
  challenge: LibraryChallengeWithProgress;
  onJoin?: () => void;
}

const GOAL_UNIT_KEY: Record<LibraryChallengeWithProgress["goal_type"], string> = {
  books_count: "library.challenge.unit.books",
  pages_count: "library.challenge.unit.pages",
  minutes_read: "library.challenge.unit.minutes",
  listening_minutes: "library.challenge.unit.minutes",
};

export function ChallengeCard({ challenge, onJoin }: ChallengeCardProps) {
  const { t } = useLanguage();
  const current = challenge.progress?.current_value ?? 0;
  const percent = Math.min(100, Math.round((current / challenge.goal_target) * 100));
  const isComplete = !!challenge.progress?.completed_at;
  const hasJoined = !!challenge.progress;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-5 w-5 text-primary" aria-hidden="true" />
          {challenge.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {challenge.description && <p className="text-sm text-muted-foreground">{challenge.description}</p>}
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {current} / {challenge.goal_target} {t(GOAL_UNIT_KEY[challenge.goal_type])}
            </span>
            <span>{percent}%</span>
          </div>
          <Progress value={percent} aria-label={`${challenge.title}: ${percent}%`} />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1 font-medium text-primary">
            <Coins className="h-4 w-4" aria-hidden="true" /> {challenge.reward_vx} VX
          </span>
          {isComplete && <span className="text-xs font-medium text-primary">{t("library.challenge.completed")}</span>}
        </div>
        {challenge.scope !== "admin" && (
          <div className="flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Users className="h-3 w-3" aria-hidden="true" /> {challenge.participant_count}</span>
            {onJoin && !hasJoined && <Button size="sm" variant="outline" className="h-7" onClick={onJoin}>{t("library.challenge.join")}</Button>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
