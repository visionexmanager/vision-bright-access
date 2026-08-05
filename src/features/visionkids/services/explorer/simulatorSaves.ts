import { kidsDb, jsonPayload } from "@/features/visionkids/services/stories/kidsSupabase";
import type { SimulatorSave, SimulatorType } from "@/features/visionkids/types/explorer.types";

async function requireUserId(): Promise<string> {
  const { data } = await kidsDb.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Must be signed in");
  return id;
}

export async function fetchSimulatorSave<TState = Record<string, unknown>>(
  simulatorType: SimulatorType,
): Promise<SimulatorSave<TState> | null> {
  const userId = await requireUserId();
  const { data, error } = await kidsDb
    .from("kids_explorer_simulator_saves").select("*")
    .eq("user_id", userId).eq("simulator_type", simulatorType).maybeSingle()
    .returns<SimulatorSave<TState>>();
  if (error) throw error;
  return data ?? null;
}

export async function saveSimulatorState<TState extends object = Record<string, unknown>>(
  simulatorType: SimulatorType,
  state: TState,
): Promise<void> {
  const userId = await requireUserId();
  const { error } = await kidsDb
    .from("kids_explorer_simulator_saves")
    .upsert({ user_id: userId, simulator_type: simulatorType, state: jsonPayload(state) }, { onConflict: "user_id,simulator_type" });
  if (error) throw error;
}
