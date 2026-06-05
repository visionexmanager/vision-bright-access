import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTrial } from "@/hooks/useTrial";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

export type TVSubscription = {
  sub_id:       string;
  plan_name:    string;
  plan_name_ar: string;
  expires_at:   string;
  started_at:   string;
  vx_paid:      number;
  status:       string;
};

export type TVChannel = {
  id:             string;
  name:           string;
  name_ar:        string;
  description:    string | null;
  description_ar: string | null;
  logo_url:       string | null;
  official_url:   string | null;
  category_id:    string | null;
  quality:        string;
  language:       string;
  country:        string | null;
  is_active:      boolean;
  is_featured:    boolean;
  sort_order:     number;
  category?:      { id: string; name: string; name_ar: string; icon: string; slug: string };
};

export type TVCategory = {
  id:        string;
  name:      string;
  name_ar:   string;
  slug:      string;
  icon:      string;
  sort_order: number;
};

export type TVPlan = {
  id:            string;
  name:          string;
  name_ar:       string;
  duration_days: number;
  vx_price:      number;
  features:      string[];
  sort_order:    number;
};

export function useTVSubscription() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isOnTrial, trialDaysLeft } = useTrial();
  const { t } = useLanguage();

  const { data: subscription, isLoading: subLoading } = useQuery<TVSubscription | null>({
    queryKey: ["tv-subscription", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_active_tv_subscription");
      if (error) throw error;
      return (data as TVSubscription[])?.[0] ?? null;
    },
  });

  // queryKey includes user?.id so the cache is invalidated when auth state changes.
  // enabled: !!user prevents a stale empty-array result from being cached before
  // the Supabase session is established (tv_channels RLS requires authenticated role).
  const { data: channels = [], isLoading: chLoading } = useQuery<TVChannel[]>({
    queryKey: ["tv-channels", user?.id ?? "guest"],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tv_channels")
        .select("*, category:tv_categories(id,name,name_ar,icon,slug)")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data as TVChannel[]) ?? [];
    },
  });

  const { data: categories = [] } = useQuery<TVCategory[]>({
    queryKey: ["tv-categories", user?.id ?? "guest"],
    enabled: !!user,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tv_categories")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data as TVCategory[]) ?? [];
    },
  });

  const { data: plans = [] } = useQuery<TVPlan[]>({
    queryKey: ["tv-plans"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tv_subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data as TVPlan[]) ?? [];
    },
  });

  const isSubscribed = isOnTrial || !!(
    subscription &&
    subscription.status === "active" &&
    new Date(subscription.expires_at) > new Date()
  );

  // Returns days remaining — show trial days when user has no paid subscription
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
      const { data, error } = await supabase.rpc("subscribe_tv", { _plan_id: planId });
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
      queryClient.invalidateQueries({ queryKey: ["tv-subscription", user.id] });
      queryClient.invalidateQueries({ queryKey: ["points-total", user.id] });
      queryClient.invalidateQueries({ queryKey: ["points-history", user.id] });
      return true;
    },
    [user, queryClient, t]
  );

  const getStreamToken = useCallback(
    async (channelId: string): Promise<string | null> => {
      if (!user) return null;
      const { data, error } = await supabase.rpc("generate_stream_token", {
        _channel_id: channelId,
      });
      if (error) {
        toast.error(t("tv.toast.streamError").replace("{msg}", error.message));
        return null;
      }
      const result = data as { success: boolean; token?: string; error?: string };
      if (!result.success) {
        const msgKey: Record<string, string> = {
          no_active_subscription: "tv.toast.subExpired",
          channel_not_found:      "tv.toast.channelNotFound",
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
    channels,
    categories,
    plans,
    isLoading: subLoading || chLoading,
    subscribe,
    getStreamToken,
  };
}
