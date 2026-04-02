import { lazy, ComponentType } from "react";

type SimComponentProps = { simulationId?: string };

const componentRegistry: Record<string, React.LazyExoticComponent<ComponentType<SimComponentProps>>> = {
  "egg-incubator": lazy(() =>
    import("@/pages/simulations/IncubatorSimulation").then((m) => ({
      default: m.IncubatorSimulation,
    }))
  ),
  "network-noc": lazy(() =>
    import("@/pages/simulations/NetworkNocSimulation").then((m) => ({
      default: m.NetworkNocSimulation,
    }))
  ),
  "perfume-lab": lazy(() =>
    import("@/pages/simulations/PerfumeLabSimulation").then((m) => ({
      default: m.PerfumeLabSimulation,
    }))
  ),
};

export function getSimulationComponent(slug: string) {
  return componentRegistry[slug] || null;
}

export function hasCustomComponent(slug: string) {
  return slug in componentRegistry;
}
