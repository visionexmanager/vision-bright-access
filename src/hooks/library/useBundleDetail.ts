import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchBundleById } from "@/services/library/pricing";

export function useBundleDetail(bundleId: string | undefined) {
  const { data: bundle, isLoading } = useQuery({
    queryKey: queryKeys.library.bundleById(bundleId ?? ""),
    queryFn: () => fetchBundleById(bundleId!),
    enabled: !!bundleId,
  });
  return { bundle: bundle ?? null, isLoading };
}
