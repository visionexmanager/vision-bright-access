import { useState, useEffect } from "react";
import { Trophy, Sparkles, Coins, Medal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useActiveSocialChallenges, useChallengeLeaderboard, useMyChallengeParticipation, useJoinSocialChallenge } from "@/features/visionkids/hooks/social/useSocialChallenges";
import { useProfiles } from "@/features/visionkids/hooks/social/useFriends";

export default function ChallengesHub() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: challenges = [], isLoading } = useActiveSocialChallenges();
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!selectedId && challenges.length > 0) setSelectedId(challenges[0].id);
  }, [challenges, selectedId]);

  const { data: leaderboard = [] } = useChallengeLeaderboard(selectedId);
  const { data: myParticipation } = useMyChallengeParticipation(selectedId);
  const joinChallenge = useJoinSocialChallenge();

  const { data: profiles = [] } = useProfiles(leaderboard.map((p) => p.user_id));
  const profileMap = new Map(profiles.map((p) => [p.user_id, p]));

  useDocumentHead({ title: `${t("kids.social.nav.challengesHub")} — VisionKids`, description: t("kids.social.meta.description"), canonicalPath: "/kids/social/challenges" });

  const selected = challenges.find((c) => c.id === selectedId);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
        <Trophy className="h-7 w-7 text-kids-accent" aria-hidden="true" /> {t("kids.social.nav.challengesHub")}
      </h1>

      {isLoading ? (
        <div className="mt-6 h-32 animate-pulse rounded-2xl bg-muted" aria-busy="true" />
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {challenges.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={`rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition-colors ${selectedId === c.id ? "border-kids-accent bg-kids-accent/10" : "border-border hover:bg-muted"}`}
              >
                {c.title}
              </button>
            ))}
          </div>

          {selected && (
            <div className="mt-4 rounded-2xl border-2 border-kids-accent/40 bg-kids-accent/10 p-4">
              <p className="font-heading font-bold">{selected.title}</p>
              {selected.description && <p className="mt-1 text-sm text-muted-foreground">{selected.description}</p>}
              <div className="mt-2 flex items-center gap-3 text-sm font-semibold">
                <span className="flex items-center gap-1 text-kids-accent"><Sparkles className="h-4 w-4" aria-hidden="true" /> +{selected.reward_xp} XP</span>
                <span className="flex items-center gap-1 text-kids-secondary"><Coins className="h-4 w-4" aria-hidden="true" /> +{selected.reward_coins}</span>
              </div>
              {user && !myParticipation && (
                <Button className="mt-3 bg-kids-accent text-white hover:bg-kids-accent/90" onClick={() => joinChallenge.mutate(selected.id)} disabled={joinChallenge.isPending}>
                  {t("kids.social.challenges.join")}
                </Button>
              )}
            </div>
          )}

          <h2 className="mt-6 flex items-center gap-2 font-heading text-lg font-bold"><Medal className="h-5 w-5 text-kids-accent" aria-hidden="true" /> {t("kids.social.challenges.leaderboard")}</h2>
          <div className="mt-3 flex flex-col gap-1.5">
            {leaderboard.length === 0 && <p className="py-6 text-center text-muted-foreground">{t("kids.social.challenges.leaderboardEmpty")}</p>}
            {leaderboard.map((p, i) => (
              <div key={p.user_id} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${p.user_id === user?.id ? "bg-kids-primary/10" : ""}`}>
                <span className="w-6 text-center font-bold text-muted-foreground">{i + 1}</span>
                <span className="flex-1 truncate font-semibold">{profileMap.get(p.user_id)?.display_name || t("kids.social.friends.unknownUser")}</span>
                <span className="font-bold text-kids-accent">{p.score}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
