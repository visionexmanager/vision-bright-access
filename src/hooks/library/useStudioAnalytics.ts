/**
 * useStudioAnalytics — one book's analytics for the Studio Analytics page:
 * readers/downloads/reading-time/completion-rate/revenue plus
 * country/device/traffic-source breakdowns and a daily series for charts.
 */

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchBookDailyStats, fetchBookDimensionStats } from "@/services/library/analytics";
import type { StudioBookAnalyticsSummary } from "@/lib/types/library-studio";

export function useStudioAnalytics(bookId: string | undefined, days = 30) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.library.studio.analytics(bookId ?? "", days),
    queryFn: async (): Promise<StudioBookAnalyticsSummary> => {
      const from = new Date();
      from.setDate(from.getDate() - days);
      const fromDate = from.toISOString().slice(0, 10);

      const [daily, countries, devices, trafficSources] = await Promise.all([
        fetchBookDailyStats(bookId!, fromDate),
        fetchBookDimensionStats(bookId!, "country", fromDate),
        fetchBookDimensionStats(bookId!, "device", fromDate),
        fetchBookDimensionStats(bookId!, "traffic_source", fromDate),
      ]);

      const totals = daily.reduce(
        (acc, row) => {
          acc.readers += row.views;
          acc.downloads += row.downloads;
          acc.readingMinutes += row.reading_minutes;
          acc.revenueUsd += Number(row.revenue_usd);
          acc.revenueVx += Number(row.revenue_vx);
          acc.started += row.reading_sessions_started;
          acc.completed += row.reading_sessions_completed;
          return acc;
        },
        { readers: 0, downloads: 0, readingMinutes: 0, revenueUsd: 0, revenueVx: 0, started: 0, completed: 0 }
      );

      return {
        readers: totals.readers,
        downloads: totals.downloads,
        readingMinutes: totals.readingMinutes,
        completionRate: totals.started > 0 ? Math.round((totals.completed / totals.started) * 100) : 0,
        revenueUsd: totals.revenueUsd,
        revenueVx: totals.revenueVx,
        countries: countries.map((c) => ({ value: c.dimension_value, count: c.count })),
        devices: devices.map((d) => ({ value: d.dimension_value, count: d.count })),
        trafficSources: trafficSources.map((t) => ({ value: t.dimension_value, count: t.count })),
        dailySeries: daily.map((row) => ({ date: row.stat_date, readers: row.views, downloads: row.downloads, revenueUsd: Number(row.revenue_usd) })),
      };
    },
    enabled: !!bookId,
  });

  return { analytics: data ?? null, isLoading };
}
