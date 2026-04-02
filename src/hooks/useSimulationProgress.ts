import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface SavedProgress {
  decisions: any;
  score: number;
  completed: boolean;
  current_step: number;
}

export function useSimulationProgress(simulationId?: string) {
  const { user } = useAuth();
  const [savedProgress, setSavedProgress] = useState<SavedProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user || !simulationId) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("simulation_progress")
        .select("decisions, score, completed, current_step")
        .eq("simulation_id", simulationId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setSavedProgress(data as SavedProgress);
      }
      setLoading(false);
    };
    load();
  }, [user, simulationId]);

  return { savedProgress, loading };
}
