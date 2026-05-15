import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useTrial() {
  const { user } = useAuth();

  const { data: trialExpiresRaw } = useQuery({
    queryKey: ["trial", user?.id],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("trial_expires_at")
        .eq("user_id", user!.id)
        .single();
      return data?.trial_expires_at ?? null;
    },
  });

  const now = new Date();
  const expiresAt = trialExpiresRaw ? new Date(trialExpiresRaw) : null;
  // NULL means backfill hasn't run yet — treat as on trial with 30 days remaining.
  const isOnTrial = expiresAt === null ? true : expiresAt > now;
  const trialDaysLeft = expiresAt
    ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 30;

  return { isOnTrial, trialDaysLeft, trialExpiresAt: expiresAt };
}
