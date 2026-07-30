import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as economy from "@/features/visionkids/services/world/economy";

export function useCoinBalance() {
  return useQuery({ queryKey: ["points-total", "kids-world"], queryFn: economy.fetchCoinBalance });
}

export function useBuyItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemSlug: string) => economy.buyItem(itemSlug),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-world", "inventory"] });
      qc.invalidateQueries({ queryKey: ["kids-world", "stats"] });
      qc.invalidateQueries({ queryKey: ["points-total"] });
    },
  });
}
