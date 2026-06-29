import { useQuery } from "@tanstack/react-query";
import { fetchWatchlists, fetchWatchlist } from "@/services/finance";
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
