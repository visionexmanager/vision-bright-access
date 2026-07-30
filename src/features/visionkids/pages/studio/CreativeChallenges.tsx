import { Link } from "react-router-dom";
import { Trophy, CheckCircle2, Sparkles, Coins } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useThisWeeksChallenges, useMyChallengeSubmissions, useSubmitToChallenge } from "@/features/visionkids/hooks/studio/useStudioChallenges";
import { useMyProjects } from "@/features/visionkids/hooks/studio/useStudioProjects";
import { STUDIO_TOOLS } from "@/features/visionkids/data/studioTools";
import type { CreativeChallenge } from "@/features/visionkids/types/studio.types";

function ChallengeRow({ challenge }: { challenge: CreativeChallenge }) {
  const { t } = useLanguage();
  const { data: matchingProjects = [] } = useMyProjects(challenge.prompt_type);
  const { data: submissions = [] } = useMyChallengeSubmissions();
  const submit = useSubmitToChallenge();
  const submission = submissions.find((s) => s.challenge_id === challenge.id);
  const tool = STUDIO_TOOLS.find((tl) => tl.type === challenge.prompt_type);

  return (
    <div className={`rounded-2xl border-2 p-4 ${submission ? "border-kids-green/50 bg-kids-green/10" : "border-border bg-card"}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-heading font-bold">{tool?.emoji} {challenge.title}</p>
          {challenge.description && <p className="mt-0.5 text-sm text-muted-foreground">{challenge.description}</p>}
        </div>
        {submission && <CheckCircle2 className="h-6 w-6 shrink-0 text-kids-green" aria-hidden="true" />}
      </div>

      <div className="mt-3 flex items-center gap-3 text-sm font-semibold">
        <span className="flex items-center gap-1 text-kids-accent"><Sparkles className="h-4 w-4" aria-hidden="true" /> +{challenge.reward_xp} XP</span>
        <span className="flex items-center gap-1 text-kids-secondary"><Coins className="h-4 w-4" aria-hidden="true" /> +{challenge.reward_coins}</span>
      </div>

      {!submission && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {matchingProjects.length === 0 ? (
            <Button asChild size="sm" variant="outline">
              <Link to={tool?.slug ?? "/kids/studio"}>{t("kids.studio.createOneNow")}</Link>
            </Button>
          ) : (
            <Select onValueChange={(projectId) => submit.mutate({ challenge, projectId })}>
              <SelectTrigger className="w-56"><SelectValue placeholder={t("kids.studio.chooseYourProject")} /></SelectTrigger>
              <SelectContent>{matchingProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
      )}
    </div>
  );
}

export default function CreativeChallenges() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: challenges = [], isLoading } = useThisWeeksChallenges();

  useDocumentHead({ title: t("kids.studio.challengesTitle"), description: t("kids.studio.meta.description"), canonicalPath: "/kids/studio/challenges" });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
        <Trophy className="h-7 w-7 text-kids-accent" aria-hidden="true" /> {t("kids.studio.challengesTitle")}
      </h1>
      <p className="mt-1 text-muted-foreground">{t("kids.studio.challengesSubtitle")}</p>

      {!user && (
        <p className="mt-4 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
          {t("kids.stories.signInRequired")} <Link to="/login" className="font-semibold text-kids-primary hover:underline">{t("nav.login")}</Link>
        </p>
      )}

      {isLoading ? (
        <div className="mt-6 flex flex-col gap-3" aria-busy="true">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {challenges.map((c) => <ChallengeRow key={c.id} challenge={c} />)}
        </div>
      )}
    </div>
  );
}
