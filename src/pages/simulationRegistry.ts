// Legacy registry kept for backwards-compatibility (unused when a custom
// component exists for the simulation).
export type SimulationStep = {
  title: string;
  description: string;
  choices?: { label: string; value: string; feedback: string; points: number }[];
};
export const simulationRegistry: Record<string, SimulationStep[]> = {};
