/**
 * useAcademyProfile — Load and persist the student's Academy profile.
 *
 * Replaces ephemeral useState({ name, gender, country, level }) in Academy.tsx.
 *
 * Behavior:
 *   - On mount: fetches profile from `academy_profiles` table
 *   - If no profile → onboarding is needed (isOnboarded = false)
 *   - After onboarding: saves to DB, sets isOnboarded = true
 *   - Awards daily login XP once per day
 *
 * Usage:
 *   const { profile, isOnboarded, isLoading, saveProfile } = useAcademyProfile();
 */

import { useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  getAcademyProfile,
  saveAcademyProfile,
  touchAcademyLastActive,
  awardAcademyXP,
  hasDailyLoginXPToday,
} from "@/services/academy/academyService";
import type { StudentProfile, AcademyProfileRow } from "@/lib/types";

export interface UseAcademyProfileReturn {
  /** The loaded profile from DB. null = not yet onboarded. */
  profile: AcademyProfileRow | null;
  /** True once the student has completed onboarding and profile is in DB. */
  isOnboarded: boolean;
  isLoading: boolean;
  error: string | null;
  /** Call after onboarding form is submitted — saves to DB. */
  saveProfile: (profile: StudentProfile) => Promise<void>;
  isSaving: boolean;
}

export function useAcademyProfile(): UseAcademyProfileReturn {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ── Load profile ──────────────────────────────────────────────────────────
  const {
    data: profile = null,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.academy.profile(user?.id ?? ""),
    queryFn:  () => getAcademyProfile(user!.id),
    enabled:  !!user,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // ── Daily login XP (fire-and-forget) ─────────────────────────────────────
  useEffect(() => {
    if (!user || !profile) return;

    const grantDailyXP = async () => {
      const alreadyEarned = await hasDailyLoginXPToday(user.id);
      if (!alreadyEarned) {
        await awardAcademyXP(user.id, "academy_daily_login");
        // Invalidate points so Navbar VX counter updates
        queryClient.invalidateQueries({ queryKey: queryKeys.points.total(user.id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.academy.profile(user.id) });
      }
      // Always touch last_active
      await touchAcademyLastActive(user.id);
    };

    grantDailyXP().catch(console.warn);
  }, [user?.id, !!profile]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save profile (after onboarding) ──────────────────────────────────────
  const { mutateAsync: saveProfileMutation, isPending: isSaving } = useMutation({
    mutationFn: ({ userId, p }: { userId: string; p: StudentProfile }) =>
      saveAcademyProfile(userId, p),
    onSuccess: (savedRow) => {
      // Update cache immediately so UI switches to dashboard
      queryClient.setQueryData(
        queryKeys.academy.profile(user?.id ?? ""),
        savedRow
      );
    },
  });

  const saveProfile = useCallback(
    async (p: StudentProfile) => {
      if (!user) throw new Error("Must be logged in to save Academy profile");
      await saveProfileMutation({ userId: user.id, p });
    },
    [user, saveProfileMutation]
  );

  return {
    profile:     profile as AcademyProfileRow | null,
    isOnboarded: !!profile,
    isLoading,
    error:       queryError ? (queryError as Error).message : null,
    saveProfile,
    isSaving,
  };
}
