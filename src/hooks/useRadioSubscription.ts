import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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

  const { data: stations = [], isLoading: stLoading } = useQuery<RadioStation[]>({
    queryKey: ["radio-stations"],
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
    queryKey: ["radio-genres"],
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

  const isSubscribed = !!(
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
    : 0;

  const subscribe = useCallback(
    async (planId: string): Promise<boolean> => {
      if (!user) {
        toast.error("يجب تسجيل الدخول أولاً");
        return false;
      }
      const { data, error } = await supabase.rpc("subscribe_radio", { _plan_id: planId });
      if (error) {
        toast.error("حدث خطأ أثناء الاشتراك: " + error.message);
        return false;
      }
      const result = data as { success: boolean; error?: string; vx_deducted?: number };
      if (!result.success) {
        const msgs: Record<string, string> = {
          already_subscribed:   "لديك اشتراك نشط بالفعل",
          insufficient_vx:      "رصيد VX غير كافٍ",
          plan_not_found:       "خطة الاشتراك غير موجودة",
          not_authenticated:    "يجب تسجيل الدخول أولاً",
        };
        toast.error(msgs[result.error ?? ""] ?? "فشل الاشتراك");
        return false;
      }
      toast.success(`تم الاشتراك! تم خصم ${result.vx_deducted?.toLocaleString()} VX`);
      queryClient.invalidateQueries({ queryKey: ["radio-subscription", user.id] });
      queryClient.invalidateQueries({ queryKey: ["points-total", user.id] });
      queryClient.invalidateQueries({ queryKey: ["points-history", user.id] });
      return true;
    },
    [user, queryClient]
  );

  const getStreamToken = useCallback(
    async (stationId: string): Promise<string | null> => {
      if (!user) return null;
      const { data, error } = await supabase.rpc("generate_radio_stream_token", {
        _station_id: stationId,
      });
      if (error) {
        toast.error("تعذر الوصول إلى البث: " + error.message);
        return null;
      }
      const result = data as { success: boolean; token?: string; error?: string };
      if (!result.success) {
        const msgs: Record<string, string> = {
          no_active_subscription: "اشتراكك منتهٍ، يرجى التجديد",
          station_not_found:      "المحطة غير متاحة حالياً",
          not_authenticated:      "يجب تسجيل الدخول أولاً",
        };
        toast.error(msgs[result.error ?? ""] ?? "تعذر تشغيل المحطة");
        return null;
      }
      return result.token ?? null;
    },
    [user]
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
