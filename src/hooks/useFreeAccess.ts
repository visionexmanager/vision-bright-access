import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useTrial } from "@/hooks/useTrial";

/**
 * Admins, and accounts still inside their free week.
 *
 * This used to count thirty days from `profiles.created_at` itself, which made
 * it a second opinion on how long the trial is — and once the trial became a
 * week, the wrong one. It now asks `useTrial`, which reads
 * `profiles.trial_expires_at`: one column, one answer, and an admin extending
 * somebody's trial changes both.
 */
export function useFreeAccess() {
  const { user } = useAuth();
  const { isOnTrial, trialDaysLeft } = useTrial();

  const { data: profile } = useQuery({
    queryKey: ["profile-role", user?.id],
    queryFn: async () => {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      return { isAdmin: !!roleRow };
    },
    enabled: !!user,
    staleTime: 300_000,
  });

  const isAdmin = !!profile?.isAdmin;
  const isNewUser = !isAdmin && !!user && isOnTrial;
  const daysRemaining = isNewUser ? trialDaysLeft : 0;

  return { isAdmin, isNewUser, hasFreeAccess: isAdmin || isNewUser, daysRemaining };
}
