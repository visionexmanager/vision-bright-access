/**
 * useDailyQuote — the deterministic quote of the day (same for every
 * visitor all day — see services/library/quotes.ts). Query key includes
 * today's date so it naturally refetches once a day without any timer.
 */

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchDailyQuote } from "@/services/library/quotes";

export function useDailyQuote() {
  const dateKey = new Date().toISOString().slice(0, 10);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.library.dailyQuote(dateKey),
    queryFn: fetchDailyQuote,
    staleTime: 60 * 60 * 1000,
  });
  return { quote: data ?? null, isLoading, error: error ? (error as Error).message : null, refetch };
}
