import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const toastShown = useRef(false);

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
        if (!toastShown.current) {
          toastShown.current = true;
          const sp = data as SavedProgress;
          toast.info("🔄 " + (sp.completed ? "مرحباً بعودتك! لقد أكملت هذه المحاكاة سابقاً." : `مرحباً بعودتك! تم استعادة تقدمك — النقاط: ${sp.score}`), {
            duration: 4000,
          });
        }
      }
      setLoading(false);
    };
    load();
  }, [user, simulationId]);

  return { savedProgress, loading, wasRestored: !!savedProgress };
}
