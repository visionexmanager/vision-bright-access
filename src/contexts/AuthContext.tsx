import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const trialExpiresAtFromNow = () => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  return expiresAt.toISOString();
};

async function ensureUserEntitlements(user: User) {
  const displayName =
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    user.email ||
    "Player";

  const profiles = supabase.from("profiles") as any;
  const { data } = await profiles
    .select("user_id, display_name, trial_expires_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) {
    await profiles.insert({
      user_id: user.id,
      display_name: displayName,
      trial_expires_at: trialExpiresAtFromNow(),
    });
    return;
  }

  const updates: Record<string, string> = {};
  if (!data.display_name) updates.display_name = displayName;
  if (!data.trial_expires_at) updates.trial_expires_at = trialExpiresAtFromNow();

  if (Object.keys(updates).length > 0) {
    await profiles.update(updates).eq("user_id", user.id);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session?.user) {
          setTimeout(() => {
            ensureUserEntitlements(session.user).catch((error) => {
              console.error("Failed to ensure user entitlements:", error);
            });
          }, 0);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        if (session?.user) {
          ensureUserEntitlements(session.user).catch((error) => {
            console.error("Failed to ensure user entitlements:", error);
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
