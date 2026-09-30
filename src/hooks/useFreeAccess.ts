import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Admins only.
 *
 * The free week used to count here too — "free access" for a week, to every
 * section. It no longer does: the trial opens only `TRIAL_SECTIONS`, and the
 * server charges and gates it like an account with no plan, so a client that
 * still said "free" would say something the server will not honour.
 * `isNewUser` and `daysRemaining` stay in the shape so callers keep compiling;
 * they are always false and 0.
 */
export function useFreeAccess() {
  const { user } = useAuth();

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
  const isNewUser = false;
  const daysRemaining = 0;

  return { isAdmin, isNewUser, hasFreeAccess: isAdmin, daysRemaining };
}
