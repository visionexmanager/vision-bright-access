import { Crown, Medal } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LeaderboardEntry } from "@/features/visionkids/types/games.types";

const RANK_COLORS = ["text-kids-accent", "text-muted-foreground", "text-amber-700"];

export function LeaderboardTable({ entries, isLoading }: { entries: LeaderboardEntry[]; isLoading?: boolean }) {
  const { t } = useLanguage();
  const { user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />)}
      </div>
    );
  }

  if (entries.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">{t("kids.games.leaderboardEmpty")}</p>;
  }

  return (
    <ol className="flex flex-col gap-1.5">
      {entries.map((entry, i) => (
        <li
          key={`${entry.user_id}-${entry.game_id}`}
          className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2 ${entry.user_id === user?.id ? "border-kids-primary bg-kids-primary/5" : "border-border"}`}
        >
          <span className={`flex w-7 shrink-0 items-center justify-center font-heading text-lg font-extrabold ${i < 3 ? RANK_COLORS[i] : "text-muted-foreground"}`}>
            {i === 0 ? <Crown className="h-5 w-5" aria-hidden="true" /> : i < 3 ? <Medal className="h-5 w-5" aria-hidden="true" /> : i + 1}
          </span>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-kids-primary/15 text-sm font-bold text-kids-primary">
            {entry.avatar_url ? <img src={entry.avatar_url} alt="" className="h-full w-full object-cover" /> : (entry.display_name ?? "K").slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">{entry.display_name ?? t("kids.games.anonymousPlayer")}</span>
          <span className="font-heading font-bold text-kids-primary">{entry.best_score}</span>
        </li>
      ))}
    </ol>
  );
}
