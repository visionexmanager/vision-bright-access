import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTrial } from "@/hooks/useTrial";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

export type RadioSubscription = {
  sub_id:       string;
  plan_name:    string;
  plan_name_ar: string;
  expires_at:   string;
  started_at:   string;
  vx_paid:      number;
  status:       string;
};

export type RadioStation = {
  id:             string;
  name:           string;
  name_ar:        string;
  description:    string | null;
  description_ar: string | null;
  logo_url:       string | null;
  official_url:   string | null;
  genre_id:       string | null;
  bitrate:        string;
  language:       string;
  country:        string | null;
  website_url:    string | null;
  is_active:      boolean;
  is_featured:    boolean;
  sort_order:     number;
  genre?:         { id: string; name: string; name_ar: string; icon: string; slug: string };
};

export type RadioGenre = {
  id:        string;
  name:      string;
  name_ar:   string;
  slug:      string;
  icon:      string;
  sort_order: number;
};

export type RadioPlan = {
  id:            string;
  name:          string;
  name_ar:       string;
  duration_days: number;
  vx_price:      number;
  features:      string[];
  sort_order:    number;
};

export function useRadioSubscription() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isOnTrial, trialDaysLeft } = useTrial();
  const { t } = useLanguage();

  const { data: subscription, isLoading: subLoading } = useQuery<RadioSubscription | null>({
    queryKey: ["radio-subscription", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_active_radio_subscription");
      if (error) throw error;
      return (data as RadioSubscription[])?.[0] ?? null;
    },
  });

  // queryKey includes user?.id so the cache is invalidated when auth state changes.
  // enabled: !!user prevents a stale empty-array result from being cached before
  // the Supabase session is established (radio_stations RLS requires authenticated role).
  const { data: stations = [], isLoading: stLoading } = useQuery<RadioStation[]>({
    queryKey: ["radio-stations", user?.id ?? "guest"],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("radio_stations")
        .select("*, genre:radio_genres(id,name,name_ar,icon,slug)")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data as RadioStation[]) ?? [];
    },
  });

  const { data: genres = [] } = useQuery<RadioGenre[]>({
    queryKey: ["radio-genres", user?.id ?? "guest"],
    enabled: !!user,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("radio_genres")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data as RadioGenre[]) ?? [];
    },
  });

  const { data: plans = [] } = useQuery<RadioPlan[]>({
    queryKey: ["radio-plans"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("radio_subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data as RadioPlan[]) ?? [];
    },
  });

  const isSubscribed = isOnTrial || !!(
    subscription &&
    subscription.status === "active" &&
    new Date(subscription.expires_at) > new Date()
  );

  const daysRemaining = subscription
    ? Math.max(
        0,
        Math.ceil(
          (new Date(subscription.expires_at).getTime() - Date.now()) / 86_400_000
        )
      )
    : isOnTrial ? trialDaysLeft : 0;

  const subscribe = useCallback(
    async (planId: string): Promise<boolean> => {
      if (!user) {
        toast.error(t("tv.toast.loginRequired"));
        return false;
      }
      const { data, error } = await supabase.rpc("subscribe_radio", { _plan_id: planId });
      if (error) {
        toast.error(t("tv.toast.subError").replace("{msg}", error.message));
        return false;
      }
      const result = data as { success: boolean; error?: string; vx_deducted?: number };
      if (!result.success) {
        const msgKey: Record<string, string> = {
          already_subscribed: "tv.toast.alreadySubscribed",
          insufficient_vx:    "tv.toast.insufficientVX",
          plan_not_found:     "tv.toast.planNotFound",
          not_authenticated:  "tv.toast.notAuthenticated",
        };
        toast.error(t(msgKey[result.error ?? ""] ?? "tv.toast.subFailed"));
        return false;
      }
      toast.success(t("tv.toast.subscribed").replace("{vx}", (result.vx_deducted ?? 0).toLocaleString()));
      queryClient.invalidateQueries({ queryKey: ["radio-subscription", user.id] });
      queryClient.invalidateQueries({ queryKey: ["points-total", user.id] });
      queryClient.invalidateQueries({ queryKey: ["points-history", user.id] });
      return true;
    },
    [user, queryClient, t]
  );

  const getStreamToken = useCallback(
    async (stationId: string): Promise<string | null> => {
      if (!user) return null;
      const { data, error } = await supabase.rpc("generate_radio_stream_token", {
        _station_id: stationId,
      });
      if (error) {
        toast.error(t("tv.toast.streamError").replace("{msg}", error.message));
        return null;
      }
      const result = data as { success: boolean; token?: string; error?: string };
      if (!result.success) {
        const msgKey: Record<string, string> = {
          no_active_subscription: "tv.toast.subExpired",
          station_not_found:      "tv.toast.stationNotFound",
          not_authenticated:      "tv.toast.notAuthenticated",
        };
        toast.error(t(msgKey[result.error ?? ""] ?? "tv.toast.streamFailed"));
        return null;
      }
      return result.token ?? null;
    },
    [user, t]
  );

  return {
    subscription,
    isSubscribed,
    daysRemaining,
    stations,
    genres,
    plans,
    isLoading: subLoading || stLoading,
    subscribe,
    getStreamToken,
  };
}
