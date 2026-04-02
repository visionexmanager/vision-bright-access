import { lazy, ComponentType } from "react";

// Registry mapping simulation slugs to their custom React components
// Each component receives { simulationId?: string }
type SimComponentProps = { simulationId?: string };

const componentRegistry: Record<string, React.LazyExoticComponent<ComponentType<SimComponentProps>>> = {
  "egg-incubator": lazy(() =>
    import("@/pages/simulations/IncubatorSimulation").then((m) => ({
      default: m.IncubatorSimulation,
    }))
  ),
};

export function getSimulationComponent(slug: string) {
  return componentRegistry[slug] || null;
}

export function hasCustomComponent(slug: string) {
  return slug in componentRegistry;
}
