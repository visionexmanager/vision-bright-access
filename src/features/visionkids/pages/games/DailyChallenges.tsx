import { CalendarDays } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useDailyChallenges } from "@/features/visionkids/hooks/games/useGameChallenges";
import { ChallengeCard } from "@/features/visionkids/components/games/ChallengeCard";
import { Link } from "react-router-dom";

export default function DailyChallenges() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: challenges = [], isLoading } = useDailyChallenges();

  useDocumentHead({ title: t("kids.games.dailyChallenges"), description: t("kids.games.meta.description"), canonicalPath: "/kids/games/daily-challenges" });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
        <CalendarDays className="h-7 w-7 text-kids-primary" aria-hidden="true" /> {t("kids.games.dailyChallenges")}
      </h1>
      <p className="mt-1 text-muted-foreground">{t("kids.games.dailyChallengesSubtitle")}</p>

      {!user && (
        <p className="mt-4 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
          {t("kids.stories.signInRequired")} <Link to="/login" className="font-semibold text-kids-primary hover:underline">{t("nav.login")}</Link>
        </p>
      )}

      {isLoading ? (
        <div className="mt-6 flex flex-col gap-3" aria-busy="true">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {challenges.map((c) => <ChallengeCard key={c.id} challenge={c} />)}
        </div>
      )}
    </div>
  );
}
