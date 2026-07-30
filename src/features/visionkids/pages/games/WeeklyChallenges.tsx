import { CalendarRange } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useWeeklyChallenges } from "@/features/visionkids/hooks/games/useGameChallenges";
import { useActiveSeasonEvents } from "@/features/visionkids/hooks/games/useGameChallenges";
import { ChallengeCard } from "@/features/visionkids/components/games/ChallengeCard";

export default function WeeklyChallenges() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: challenges = [], isLoading } = useWeeklyChallenges();
  const { data: seasonEvents = [] } = useActiveSeasonEvents();

  useDocumentHead({ title: t("kids.games.weeklyChallenges"), description: t("kids.games.meta.description"), canonicalPath: "/kids/games/weekly-challenges" });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
        <CalendarRange className="h-7 w-7 text-kids-secondary" aria-hidden="true" /> {t("kids.games.weeklyChallenges")}
      </h1>
      <p className="mt-1 text-muted-foreground">{t("kids.games.weeklyChallengesSubtitle")}</p>

      {!user && (
        <p className="mt-4 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
          {t("kids.stories.signInRequired")} <Link to="/login" className="font-semibold text-kids-primary hover:underline">{t("nav.login")}</Link>
        </p>
      )}

      {seasonEvents.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {seasonEvents.map((event) => (
            <div key={event.id} className="rounded-xl bg-kids-purple/10 p-3 text-sm">
              <span className="font-semibold text-kids-purple">{event.title}</span>
              {event.description && <span className="text-muted-foreground"> — {event.description}</span>}
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="mt-6 flex flex-col gap-3" aria-busy="true">{Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {challenges.map((c) => <ChallengeCard key={c.id} challenge={c} />)}
        </div>
      )}
    </div>
  );
}
