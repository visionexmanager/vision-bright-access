import { useQuery } from "@tanstack/react-query";
import * as amsService from "@/services/ai-media-studio/amsService";

export function useAMSStorage() {
  const query = useQuery({
    queryKey: ["ams", "storage"],
    queryFn: () => amsService.getStorageUsage(),
    staleTime: 30_000,
  });

  const usage = query.data;
  const usedBytes = usage?.used_bytes ?? 0;
  const quotaBytes = usage?.quota_bytes ?? 5_368_709_120; // 5 GB
  const percentUsed = Math.min(100, (usedBytes / quotaBytes) * 100);
  const isWarning = percentUsed > 80;
  const isCritical = percentUsed > 95;

  return {
    usage,
    usedBytes,
    quotaBytes,
    percentUsed,
    isWarning,
    isCritical,
    assetCount: usage?.asset_count ?? 0,
    projectCount: usage?.project_count ?? 0,
    isLoading: query.isLoading,
    formatBytes,
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
