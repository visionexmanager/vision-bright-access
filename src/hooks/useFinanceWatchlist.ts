import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchWatchlists,
  fetchWatchlist,
  createWatchlist,
  addWatchlistItem,
  removeWatchlistItem,
} from "@/services/finance";
import type { WatchlistItem } from "@/lib/types/finance";
import { useAuth } from "@/contexts/AuthContext";

export function useWatchlists() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["finance", "watchlists", user?.id],
    queryFn: () => fetchWatchlists(user!.id),
    enabled: Boolean(user),
    staleTime: 300_000,
  });
}

export function useWatchlist(id: string) {
  return useQuery({
    queryKey: ["finance", "watchlist", id],
    queryFn: () => fetchWatchlist(id),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}

export function useCreateWatchlist() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => {
      if (!user?.id) throw new Error("Must be signed in to create a watchlist");
      return createWatchlist(user.id, name);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance", "watchlists", user?.id] });
    },
  });
}

export function useAddWatchlistItem(watchlistId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: Pick<WatchlistItem, "symbol" | "name" | "assetClass">) =>
      addWatchlistItem(watchlistId, item),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance", "watchlist", watchlistId] });
    },
  });
}

export function useRemoveWatchlistItem(watchlistId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => removeWatchlistItem(watchlistId, itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance", "watchlist", watchlistId] });
    },
  });
}
