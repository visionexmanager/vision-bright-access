import { useQuery } from "@tanstack/react-query";
import {
  getProviderStats,
  getAllProviderStats,
  getMetricsTimeSeries,
  getProviderLogs,
  getFailovers,
} from "@/services/ai-media-studio/providerHubService";
import type { ProviderType } from "@/lib/types/provider-hub";

export function useProviderStats(providerId: string, hours = 24) {
  return useQuery({
    queryKey: ["ph", "stats", providerId, hours],
    queryFn:  () => getProviderStats(providerId, hours),
    staleTime: 60_000,
    enabled:  !!providerId,
  });
}

export function useAllProviderStats(hours = 24) {
  return useQuery({
    queryKey: ["ph", "stats", "all", hours],
    queryFn:  () => getAllProviderStats(hours),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

export function useProviderTimeSeries(providerId: string, hours = 24) {
  return useQuery({
    queryKey: ["ph", "timeseries", providerId, hours],
    queryFn:  () => getMetricsTimeSeries(providerId, hours),
    staleTime: 60_000,
    enabled:  !!providerId,
  });
}

export function useProviderLogs(params: {
  provider_id?: string;
  job_type?:    ProviderType;
  limit?:       number;
}) {
  return useQuery({
    queryKey: ["ph", "logs", params],
    queryFn:  () => getProviderLogs(params),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useFailovers(limit = 50) {
  return useQuery({
    queryKey: ["ph", "failovers", limit],
    queryFn:  () => getFailovers(limit),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
