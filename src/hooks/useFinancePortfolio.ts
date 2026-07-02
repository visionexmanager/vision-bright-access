import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPortfolios, fetchPortfolio, createPortfolio } from "@/services/finance";
import { useAuth } from "@/contexts/AuthContext";

export function usePortfolios() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["finance", "portfolios", user?.id],
    queryFn: () => fetchPortfolios(user!.id),
    enabled: Boolean(user),
    staleTime: 300_000,
  });
}

export function usePortfolio(id: string) {
  return useQuery({
    queryKey: ["finance", "portfolio", id],
    queryFn: () => fetchPortfolio(id),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}

export function useCreatePortfolio() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => {
      if (!user?.id) throw new Error("Must be signed in to create a portfolio");
      return createPortfolio(user.id, name);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance", "portfolios", user?.id] });
    },
  });
}
