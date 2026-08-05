import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as saves from "@/features/visionkids/services/explorer/simulatorSaves";
import type { SimulatorType } from "@/features/visionkids/types/explorer.types";

export function useSimulatorSave<TState = Record<string, unknown>>(simulatorType: SimulatorType) {
  return useQuery({
    queryKey: ["kids-explorer", "simulator-save", simulatorType],
    queryFn: () => saves.fetchSimulatorSave<TState>(simulatorType),
  });
}

export function useSaveSimulatorState<TState extends object = Record<string, unknown>>(simulatorType: SimulatorType) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (state: TState) => saves.saveSimulatorState<TState>(simulatorType, state),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-explorer", "simulator-save", simulatorType] }),
  });
}
