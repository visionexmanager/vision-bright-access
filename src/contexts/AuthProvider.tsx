import { useEffect, useState, type ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { AuthContext } from "./AuthContext";

// The week itself lives in `src/lib/billing/plans.ts` and in
// `public.trial_period_days()`; the column default does this server-side for
// rows `handle_new_user` creates, and this is the client-side backfill for a
// profile that predates it.

// Nothing here computes the trial any more. `profiles_anchor_trial` sets
// `trial_expires_at` from `auth.users.created_at`, and `authenticated` no
// longer holds the privilege to write that column — an account that can set
// its own trial can unlock every section of every tier.

async function ensureUserEntitlements(user: User) {
  const displayName =
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    user.email ||
    "Player";

  const { data } = await supabase
    .from("profiles")
    .select("user_id, display_name, trial_expires_at, created_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) {
    // No trial_expires_at: the database sets it, from auth.users.created_at,
    // in the `profiles_anchor_trial` trigger. It used to be sent from here —
    // anchored to the registration time so an existing session could not win
    // extra days, which was the right intent on the wrong side of the wire.
    // `authenticated` no longer holds the privilege to write that column at
    // all, so sending it would fail rather than be ignored.
    await supabase.from("profiles").insert({
      user_id: user.id,
      display_name: displayName,
    });
    return;
  }

  // Typed from the schema, not Record<string, string>: the pinned supabase-js
  // in CI rejects an index signature here because it cannot rule out a column
  // that does not exist.
  const updates: Database["public"]["Tables"]["profiles"]["Update"] = {};
  if (!data.display_name) updates.display_name = displayName;
  // The trial backfill that used to live here is gone with the privilege: a row
  // with a null trial_expires_at can only predate the column's default, and
  // repairing one is a migration's job, not a signed-in browser's.

  if (Object.keys(updates).length > 0) {
    await supabase.from("profiles").update(updates).eq("user_id", user.id);
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
