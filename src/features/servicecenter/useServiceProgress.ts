import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { buildServiceProfile, type CompletionRecord, type ServiceProfile } from "./progress";
import { getServiceEntry } from "./catalog";

/**
 * Loads the visitor's completion history and turns it into a professional
 * profile. Simulation progress is keyed on the simulation's UUID, so we join
 * through the `simulations` table to reach the slugs the catalog uses.
 *
 * Signed-out visitors get an empty profile rather than an error — the Service
 * Center is browsable without an account.
 */
export function useServiceProgress(): {
  profile: ServiceProfile;
  completedSlugs: string[];
  loading: boolean;
} {
  const { user } = useAuth();
  const [records, setRecords] = useState<CompletionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user) {
        if (!cancelled) {
          setRecords([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      const [{ data: sims }, { data: progress }] = await Promise.all([
        supabase.from("simulations").select("id, slug"),
        supabase
          .from("simulation_progress")
          .select("simulation_id, completed, score, updated_at")
          .eq("user_id", user.id),
      ]);

      if (cancelled) return;

      const slugById = new Map<string, string>();
      (sims ?? []).forEach((sim) => slugById.set(sim.id, sim.slug));

      const next: CompletionRecord[] = [];
      for (const row of progress ?? []) {
        if (!row.completed) continue;
        const slug = slugById.get(row.simulation_id);
        // An entry we no longer publish is skipped rather than shown as an
        // unnamed completion.
        if (!slug || !getServiceEntry(slug)) continue;
        next.push({
          slug,
          score: row.score ?? 0,
          completedAt: row.updated_at ?? new Date().toISOString(),
        });
      }

      setRecords(next);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const profile = useMemo(() => buildServiceProfile(records), [records]);
  const completedSlugs = useMemo(() => [...new Set(records.map((r) => r.slug))], [records]);

  return { profile, completedSlugs, loading };
}
