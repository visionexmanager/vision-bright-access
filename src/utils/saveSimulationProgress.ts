import { supabase } from "@/integrations/supabase/client";
import { isFallbackSimulationId } from "@/data/requiredSimulations";

interface SavePayload {
  current_step: number;
  decisions: any;
  score: number;
  completed: boolean;
}

/**
 * Saves simulation progress and dispatches a "simulation-completed" event
 * when the simulation is marked as completed, triggering achievement checks.
 */
export async function saveSimulationProgress(
  userId: string,
  simulationId: string,
  payload: SavePayload
) {
  if (isFallbackSimulationId(simulationId)) {
    localStorage.setItem(
      `visionex:simulation-progress:${userId}:${simulationId}`,
      JSON.stringify({ id: simulationId, ...payload })
    );
    if (payload.completed) {
      window.dispatchEvent(new Event("simulation-completed"));
    }
    return;
  }

  const { data: existing } = await supabase
    .from("simulation_progress")
    .select("id")
    .eq("user_id", userId)
    .eq("simulation_id", simulationId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("simulation_progress")
      .update(payload)
      .eq("id", existing.id);
  } else {
    await supabase
      .from("simulation_progress")
      .insert([{ user_id: userId, simulation_id: simulationId, ...payload }]);
  }

  if (payload.completed) {
    window.dispatchEvent(new Event("simulation-completed"));
  }
}
