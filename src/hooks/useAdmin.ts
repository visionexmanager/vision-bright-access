import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export function useAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  // Keep loading=true until auth has fully resolved AND the DB check (if any) completes.
  // Previously this was set to false immediately when user===null, which meant
  // VoiceRoom treated the admin check as "done" before auth had actually loaded,
  // causing the join effect to fire before we knew whether the user was an admin.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Auth hasn't resolved yet — stay in loading state.
    if (authLoading) return;

    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const check = async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
      setLoading(false);
    };

    check();
  // Depend on user.id (stable string) not the whole user object, so a Supabase
  // session refresh that recreates the user object doesn't re-trigger the check.
  }, [user?.id, authLoading]);

  return { isAdmin, loading };
}
