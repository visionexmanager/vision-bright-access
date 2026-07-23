import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchTodayPlan, generateDailyPlan } from "@/services/library/librarianDailyPlan";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function useLibrarianDailyPlan() {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: plan, isLoading } = useQuery({
    queryKey: queryKeys.library.librarianDailyPlan(uid, todayKey()),
    queryFn: () => fetchTodayPlan(uid),
    enabled: !!user,
  });

  const generate = async (force = false) => {
    setIsGenerating(true);
    try {
      await generateDailyPlan(force);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.librarianDailyPlan(uid, todayKey()) });
    } catch (err) {
      toast({ title: "Couldn't generate today's plan", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return { plan: plan ?? null, isLoading, isGenerating, generate };
}
