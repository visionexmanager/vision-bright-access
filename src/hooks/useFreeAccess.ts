import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const FREE_DAYS = 30;

export function useFreeAccess() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile-role", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("role, created_at")
        .eq("id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
    staleTime: 300_000,
  });

  const isAdmin = profile?.role === "admin";

  // Prefer profile.created_at, fallback to auth user.created_at
  const rawCreatedAt = profile?.created_at ?? user?.created_at;
  const createdAt = rawCreatedAt ? new Date(rawCreatedAt) : null;
  const msElapsed = createdAt ? Date.now() - createdAt.getTime() : Infinity;
  const daysElapsed = msElapsed / (1000 * 60 * 60 * 24);

  const isNewUser = !isAdmin && daysElapsed < FREE_DAYS;
  const daysRemaining = isNewUser ? Math.ceil(FREE_DAYS - daysElapsed) : 0;

  const hasFreeAccess = isAdmin || isNewUser;

  return { isAdmin, isNewUser, hasFreeAccess, daysRemaining };
}
