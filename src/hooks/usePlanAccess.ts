// What the signed-in account may open, asked once and cached.
//
// The answer comes from `my_plan_access()`, which takes no argument and
// answers only for `auth.uid()` — the browser cannot ask about somebody else.
// The tier lists live in `billing_plans.limits`, so moving a section between
// tiers is a row update, and this hook picks it up on the next refetch.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { planSections, type SectionKey } from "@/lib/billing/plans";

export interface PlanAccess {
  signedIn: boolean;
  trialActive: boolean;
  trialEndsAt: Date | null;
  /** Whole days left in the free week; 0 on the last day. */
  daysLeft: number;
  planId: string;
  planName: string;
  priceUsd: number;
  sections: SectionKey[];
}

interface PlanAccessRow {
  signed_in?: boolean;
  trial_active?: boolean;
  trial_ends_at?: string | null;
  plan?: string;
  plan_name?: string;
  price_usd?: number | string;
  sections?: unknown;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Every field checked rather than trusted — the same reading the webhook does. */
function readPlanAccess(payload: unknown): PlanAccess {
  const row = (payload ?? {}) as PlanAccessRow;
  const endsAt = row.trial_ends_at ? new Date(row.trial_ends_at) : null;
  const valid = endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : null;
  const price = typeof row.price_usd === "number" ? row.price_usd : Number(row.price_usd);

  const sections = Array.isArray(row.sections)
    ? (row.sections.filter((value): value is SectionKey => typeof value === "string") as SectionKey[])
    : [];

  return {
    signedIn:    row.signed_in === true,
    trialActive: row.trial_active === true,
    trialEndsAt: valid,
    daysLeft:    valid ? Math.max(0, Math.floor((valid.getTime() - Date.now()) / DAY_MS)) : 0,
    planId:      typeof row.plan === "string" && row.plan ? row.plan : "none",
    planName:    typeof row.plan_name === "string" && row.plan_name ? row.plan_name : "Free",
    priceUsd:    Number.isFinite(price) ? price : 0,
    // An empty list from a plan that should have one means the read failed,
    // not that the plan opens nothing — fall back to the catalogue rather than
    // to a locked screen.
    sections:    sections.length > 0 ? sections : [...planSections(row.plan)],
  };
}

export function usePlanAccess() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["plan-access", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: async (): Promise<PlanAccess> => {
      const { data, error } = await supabase.rpc("my_plan_access");
      if (error) throw error;
      return readPlanAccess(data);
    },
  });

  /**
   * Is this section open?
   *
   * Open is the answer while the lookup is in flight or after it failed. A
   * billing table that is briefly unreachable must not read to the user as the
   * section being taken away — undercharging for a minute is the cheaper
   * mistake, and it is the same call `UNKNOWN_ENTITLEMENT` makes on WhatsApp.
   */
  const has = (section: SectionKey): boolean => {
    if (!user) return true;            // signed-out browsing is unchanged
    if (query.isPending || query.isError || !query.data) return true;
    return query.data.sections.includes(section);
  };

  return {
    access: query.data ?? null,
    isLoading: query.isPending,
    has,
  };
}
