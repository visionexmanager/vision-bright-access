import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchRecommendations, dismissRecommendation, regenerateRecommendations } from "@/services/library/librarianRecommendations";

export function useLibrarianRecommendations() {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const queryClient = useQueryClient();
  const [isRegenerating, setIsRegenerating] = useState(false);

  const { data: recommendations = [], isLoading } = useQuery({
    queryKey: queryKeys.library.librarianRecommendations(uid),
    queryFn: () => fetchRecommendations(uid),
    enabled: !!user,
  });

  const dismiss = async (id: string) => {
    try {
      await dismissRecommendation(id);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.librarianRecommendations(uid) });
    } catch (err) {
      toast({ title: "Couldn't dismiss", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const regenerate = async () => {
    setIsRegenerating(true);
    try {
      await regenerateRecommendations();
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.librarianRecommendations(uid) });
    } catch (err) {
      toast({ title: "Couldn't refresh recommendations", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsRegenerating(false);
    }
  };

  return { recommendations, isLoading, isRegenerating, dismiss, regenerate };
}
