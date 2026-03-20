import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function usePoints() {
  const { user } = useAuth();

  const { data: totalPoints = 0, isLoading: loadingTotal } = useQuery({
    queryKey: ["points-total", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_points")
        .select("points")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data.reduce((sum, row) => sum + row.points, 0);
    },
  });

  const { data: history = [], isLoading: loadingHistory } = useQuery({
    queryKey: ["points-history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_points")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  return { totalPoints, history, loadingTotal, loadingHistory };
}
