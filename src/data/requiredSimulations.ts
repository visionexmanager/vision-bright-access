export type RequiredSimulation = {
  id: string;
  slug: string;
  title: string;
  description: string;
  subcategory: string;
  difficulty: string;
  estimated_duration: number;
  points: number;
  sort_order: number;
  published: boolean;
};

export const FALLBACK_SIMULATION_PREFIX = "fallback:";

export const REQUIRED_SIMULATIONS: RequiredSimulation[] = [
  {
    id: `${FALLBACK_SIMULATION_PREFIX}vehicle-diagnostics`,
    slug: "vehicle-diagnostics",
    title: "Ultimate Vehicle Diagnostics & Repair Simulator",
    description:
      "Diagnose OBD-II fault codes, trace electrical faults, and manage a real-world auto repair workflow from intake to road-test sign-off.",
    subcategory: "Automotive",
    difficulty: "Advanced",
    estimated_duration: 45,
    points: 250,
    sort_order: 24,
    published: true,
  },
  {
    id: `${FALLBACK_SIMULATION_PREFIX}marine-vessel`,
    slug: "marine-vessel",
    title: "Live Marine Vessel Tracking & Maritime Logistics Simulator",
    description:
      "Command a global fleet - track vessels by IMO/MMSI, navigate port congestion, weather emergencies, piracy zones, and canal delays from a professional maritime operations center.",
    subcategory: "Maritime",
    difficulty: "Advanced",
    estimated_duration: 50,
    points: 300,
    sort_order: 25,
    published: true,
  },
];

export function isFallbackSimulationId(id?: string | null) {
  return !!id && id.startsWith(FALLBACK_SIMULATION_PREFIX);
}

export function getRequiredSimulation(slug?: string | null) {
  return REQUIRED_SIMULATIONS.find((simulation) => simulation.slug === slug) ?? null;
}

export function includeRequiredSimulations<T extends { slug: string; sort_order?: number }>(
  simulations: T[]
) {
  const existing = new Set(simulations.map((simulation) => simulation.slug));
  return [
    ...simulations,
    ...REQUIRED_SIMULATIONS.filter((simulation) => !existing.has(simulation.slug)),
  ].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}
