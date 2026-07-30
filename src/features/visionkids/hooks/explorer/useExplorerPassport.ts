import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as passport from "@/features/visionkids/services/explorer/passport";
import * as gameChallenges from "@/features/visionkids/services/games/challenges";
import type { ChallengeTargetType } from "@/features/visionkids/types/games.types";

export function useMyPassportStamps() {
  return useQuery({ queryKey: ["kids-explorer", "passport-stamps"], queryFn: passport.fetchMyPassportStamps });
}

/** Bumps any of today's/this week's exploration missions matching
 *  `targetType` (and, if the mission targets a specific world, only when
 *  `worldSlug` matches it) — reuses the exact same generic challenge
 *  progress tables/functions Games already built, so no new mission
 *  infrastructure was needed for Explorer. */
async function bumpMatchingMissions(targetType: ChallengeTargetType, worldSlug?: string) {
  const [daily, weekly] = await Promise.all([
    gameChallenges.fetchDailyChallenges(),
    gameChallenges.fetchWeeklyChallenges(),
  ]);

  const matches = (c: { target_type: ChallengeTargetType; world_slug?: string | null }) =>
    c.target_type === targetType && (!c.world_slug || c.world_slug === worldSlug);

  await Promise.all([
    ...daily.filter(matches).map((c) => gameChallenges.bumpDailyChallengeProgress(c.id, c.target_value)),
    ...weekly.filter(matches).map((c) => gameChallenges.bumpWeeklyChallengeProgress(c.id, c.target_value)),
  ]);
}

export function useStampWorld() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (worldSlug: string) => {
      const isNew = await passport.stampWorld(worldSlug);
      if (isNew) await bumpMatchingMissions("visit_world", worldSlug);
      return isNew;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-explorer", "passport-stamps"] });
      qc.invalidateQueries({ queryKey: ["kids-games", "daily-challenges"] });
      qc.invalidateQueries({ queryKey: ["kids-games", "weekly-challenges"] });
      qc.invalidateQueries({ queryKey: ["kids", "achievements"] });
    },
  });
}

/** Called after a location quiz is completed, so "Complete N location
 *  quizzes" missions progress too — same reuse pattern as useStampWorld. */
export function useBumpQuizMissions() {
  return useMutation({ mutationFn: (worldSlug: string) => bumpMatchingMissions("complete_quiz", worldSlug) });
}

export function useMyExplorerCertificate() {
  return useQuery({ queryKey: ["kids-explorer", "certificate"], queryFn: passport.fetchMyExplorerCertificate });
}

export function useClaimExplorerCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: passport.claimExplorerCertificate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-explorer", "certificate"] }),
  });
}
