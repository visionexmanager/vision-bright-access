/**
 * usePublishers — for the Explorer's publisher filter dropdown.
 */

import { useQuery } from "@tanstack/react-query";
import { fetchPublishers } from "@/services/library/catalog";

export function usePublishers() {
  const { data, isLoading } = useQuery({
    queryKey: ["library", "publishers"] as const,
    queryFn: fetchPublishers,
    staleTime: 15 * 60 * 1000,
  });
  return { publishers: data ?? [], isLoading };
}
