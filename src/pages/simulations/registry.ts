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
  "english-journey": lazy(() =>
    import("@/pages/simulations/EnglishJourneySimulation").then((m) => ({
      default: m.EnglishJourneySimulation,
    }))
  ),
  "board-surgeon": lazy(() =>
    import("@/pages/simulations/BoardSurgeonSimulation").then((m) => ({
      default: m.BoardSurgeonSimulation,
    }))
  ),
  "dairy-farm": lazy(() =>
    import("@/pages/simulations/DairyFarmSimulation").then((m) => ({
      default: m.DairyFarmSimulation,
    }))
  ),
  "detergent-lab": lazy(() =>
    import("@/pages/simulations/DetergentLabSimulation").then((m) => ({
      default: m.DetergentLabSimulation,
    }))
  ),
  "barber-salon": lazy(() =>
    import("@/pages/simulations/BarberSalonSimulation").then((m) => ({
      default: m.BarberSalonSimulation,
    }))
  ),
  "global-kitchen": lazy(() =>
    import("@/pages/simulations/GlobalKitchenSimulation").then((m) => ({
      default: m.GlobalKitchenSimulation,
    }))
  ),
  "skin-care-lab": lazy(() =>
    import("@/pages/simulations/SkinCareLabSimulation").then((m) => ({
      default: m.SkinCareLabSimulation,
    }))
  ),
  "poultry-farm": lazy(() =>
    import("@/pages/simulations/PoultryFarmSimulation").then((m) => ({
      default: m.PoultryFarmSimulation,
    }))
  ),
  "chocolate-factory": lazy(() =>
    import("@/pages/simulations/ChocolateFactorySimulation").then((m) => ({
      default: m.ChocolateFactorySimulation,
    }))
  ),
  "cattle-dairy": lazy(() =>
    import("@/pages/simulations/CattleDairySimulation").then((m) => ({
      default: m.CattleDairySimulation,
    }))
  ),
  "mobile-repair": lazy(() =>
    import("@/pages/simulations/MobileRepairSimulation").then((m) => ({
      default: m.MobileRepairSimulation,
    }))
  ),
  "sheep-farm": lazy(() =>
    import("@/pages/simulations/SheepFarmSimulation").then((m) => ({
      default: m.SheepFarmSimulation,
    }))
  ),
  "logistics-supply": lazy(() =>
    import("@/pages/simulations/LogisticsSimulation").then((m) => ({
      default: m.LogisticsSimulation,
    }))
  ),
  "hvac-systems": lazy(() =>
    import("@/pages/simulations/HvacSimulation").then((m) => ({
      default: m.HvacSimulation,
    }))
  ),
  "aluminum-glazing": lazy(() =>
    import("@/pages/simulations/AluminumGlazingSimulation").then((m) => ({
      default: m.AluminumGlazingSimulation,
    }))
  ),
  "solar-energy": lazy(() =>
    import("@/pages/simulations/SolarEnergySimulation").then((m) => ({
      default: m.SolarEnergySimulation,
    }))
  ),
  "woodworking": lazy(() =>
    import("@/pages/simulations/WoodworkingSimulation").then((m) => ({
      default: m.WoodworkingSimulation,
    }))
  ),
};

export function getSimulationComponent(slug: string) {
  return componentRegistry[slug] || null;
}

export function hasCustomComponent(slug: string) {
  return slug in componentRegistry;
}
