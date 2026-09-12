import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TRIAL_DAYS } from "@/lib/billing/plans";

export function useTrial() {
  const { user } = useAuth();

  const { data: trialExpiresRaw } = useQuery<{ trial_expires_at: string | null; created_at: string } | null>({
    queryKey: ["trial", user?.id],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("trial_expires_at, created_at")
        .eq("user_id", user!.id)
        .single();
      return data ?? null;
    },
  });

  const now = new Date();
  const expiresAt = trialExpiresRaw?.trial_expires_at
    ? new Date(trialExpiresRaw.trial_expires_at)
    : trialExpiresRaw?.created_at
      // fallback: the free week, counted from registration time
      ? new Date(new Date(trialExpiresRaw.created_at).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
      : null;
  const isOnTrial = expiresAt === null ? true : expiresAt > now;
  const trialDaysLeft = expiresAt
    ? Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : TRIAL_DAYS;

  return { isOnTrial, trialDaysLeft, trialExpiresAt: expiresAt };
}
