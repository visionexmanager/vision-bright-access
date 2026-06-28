import { useQuery } from "@tanstack/react-query";
import { getPlans } from "@/services/ai-media-studio/billingService";

export function usePlans() {
  return useQuery({
    queryKey: ["billing", "plans"],
    queryFn:  getPlans,
    staleTime: 300_000,  // plans rarely change
  });
}
