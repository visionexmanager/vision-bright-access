import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as portfolio from "@/features/visionkids/services/talent/portfolio";

export function useMyPortfolio() {
  return useQuery({ queryKey: ["kids-talent", "portfolio"], queryFn: portfolio.fetchMyPortfolio });
}

export function useAddPortfolioItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: portfolio.NewPortfolioItem) => portfolio.addPortfolioItem(item),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-talent", "portfolio"] });
      qc.invalidateQueries({ queryKey: ["kids-talent", "stats"] });
    },
  });
}

export function useRemovePortfolioItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => portfolio.removePortfolioItem(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-talent", "portfolio"] });
      qc.invalidateQueries({ queryKey: ["kids-talent", "stats"] });
    },
  });
}
