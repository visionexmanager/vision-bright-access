/**
 * useFavorites
 *
 * Full favorites management for TV channels.
 * Toggle is optimistic: UI updates immediately, DB syncs in background.
 */

import { useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

export function useFavorites() {
  const { user } = useAuth();
  const { t }    = useLanguage();
  const qc       = useQueryClient();

  const queryKey   = ["tv-favorites", user?.id];
  // Track in-flight toggle calls to prevent race conditions from rapid clicks
  const pendingRef = useRef<Set<string>>(new Set());

  const { data: favoriteIds = [], isLoading } = useQuery<string[]>({
    queryKey,
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tv_favorites")
        .select("channel_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r: { channel_id: string }) => r.channel_id);
    },
  });

  const toggle = useCallback(async (channelId: string) => {
    if (!user) {
      toast.error(t("auth.loginRequired") || "Please log in to save favorites");
      return;
    }

    // Prevent concurrent toggles for the same channel
    if (pendingRef.current.has(channelId)) return;
    pendingRef.current.add(channelId);

    const isFav = favoriteIds.includes(channelId);

    // Optimistic update
    qc.setQueryData<string[]>(queryKey, prev =>
      isFav
        ? (prev ?? []).filter(id => id !== channelId)
        : [...(prev ?? []), channelId]
    );

    try {
      const { data, error } = await supabase.rpc("toggle_tv_favorite", {
        _channel_id: channelId,
      });

      if (error) {
        // Roll back optimistic update
        qc.setQueryData<string[]>(queryKey, prev =>
          isFav
            ? [...(prev ?? []), channelId]
            : (prev ?? []).filter(id => id !== channelId)
        );
        toast.error("Failed to update favorites");
        return;
      }

      const result = data as { success: boolean; action?: "added" | "removed" };
      if (result.success) {
        if (result.action === "added") toast.success("Added to favorites ♥");
        else                           toast.success("Removed from favorites");
      }
    } finally {
      pendingRef.current.delete(channelId);
    }
  }, [user, favoriteIds, qc, queryKey, t]);

  return {
    favoriteIds,
    isLoading,
    isFavorite: (id: string) => favoriteIds.includes(id),
    toggle,
  };
}
