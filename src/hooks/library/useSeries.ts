import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchSeriesById, fetchSeriesBySlug, fetchSeriesBooks } from "@/services/library/series";

export function useSeries(seriesId: string | undefined) {
  const { data: series, isLoading: isLoadingSeries } = useQuery({
    queryKey: queryKeys.library.series(seriesId ?? ""),
    queryFn: () => fetchSeriesById(seriesId!),
    enabled: !!seriesId,
  });

  const { data: books = [], isLoading: isLoadingBooks } = useQuery({
    queryKey: queryKeys.library.seriesBooks(seriesId ?? ""),
    queryFn: () => fetchSeriesBooks(seriesId!),
    enabled: !!seriesId,
  });

  return { series: series ?? null, books, isLoading: isLoadingSeries || isLoadingBooks };
}

/** For the public /library/series/:slug route. */
export function useSeriesBySlug(slug: string | undefined) {
  const { data: series, isLoading: isLoadingSeries } = useQuery({
    queryKey: queryKeys.library.seriesBySlug(slug ?? ""),
    queryFn: () => fetchSeriesBySlug(slug!),
    enabled: !!slug,
  });

  const { data: books = [], isLoading: isLoadingBooks } = useQuery({
    queryKey: queryKeys.library.seriesBooks(series?.id ?? ""),
    queryFn: () => fetchSeriesBooks(series!.id),
    enabled: !!series,
  });

  return { series: series ?? null, books, isLoading: isLoadingSeries || isLoadingBooks };
}
