export type ExplorerWorldKind = "hub" | "content" | "simulator";
export type ExplorerWorldColor = "primary" | "secondary" | "accent" | "pink" | "green" | "purple";

export interface ExplorerWorld {
  slug: string;
  kind: ExplorerWorldKind;
  title: string;
  description: string | null;
  emoji: string;
  color: ExplorerWorldColor;
  order_index: number;
  status: "published" | "draft";
  created_at: string;
}

/** `content` varies per world — see the seed migration's own per-world
 *  comments for the field names used by each. Read through the typed
 *  `as*Content()` helpers below rather than accessing it raw, so a missing
 *  field degrades to "not shown" instead of a runtime crash. */
export interface ExplorerLocation {
  id: string;
  world_slug: string;
  category: string;
  slug: string;
  name: string;
  emoji: string;
  summary: string | null;
  image_url: string | null;
  video_url: string | null;
  audio_url: string | null;
  fun_facts: string[];
  content: Record<string, unknown>;
  order_index: number;
  status: "published" | "draft";
  created_at: string;
}

export interface PlanetContent {
  order?: number;
  diameter_km?: number;
  distance_from_sun_km?: number | null;
  moons?: number;
  day_length?: string;
  year_length?: string;
  temp_c?: string;
}

export interface OceanContent {
  habitat?: string;
  diet?: string;
  size?: string;
  depth_range?: string;
}

export interface AnimalContent {
  habitat?: string;
  diet?: string;
  lifespan?: string;
  distribution?: string;
}

export interface BodySystemContent {
  organs?: string[];
  function_summary?: string;
}

export interface DinosaurContent {
  period?: string;
  diet?: string;
  length_m?: number;
  weight_kg?: number;
  region?: string;
}

export interface CivilizationContent {
  era?: string;
  region?: string;
  famous_for?: string[];
}

export interface GeographyContent {
  capital?: string;
  flag_emoji?: string;
  height_m?: number;
  length_km?: number;
  area_km2?: number;
  population?: number;
}

export interface WeatherContent {
  causes?: string;
  effects?: string;
}

export interface NatureContent {
  habitat?: string;
  note?: string;
}

export interface PassportStamp {
  user_id: string;
  world_slug: string;
  stamped_at: string;
}

export type SimulatorType = "space_mission" | "city_builder" | "farm_simulator" | "eco_world";

export interface SimulatorSave<TState = Record<string, unknown>> {
  id: string;
  user_id: string;
  simulator_type: SimulatorType;
  state: TState;
  updated_at: string;
}

export type BuildingType = "road" | "house" | "school" | "hospital" | "park" | "power_plant" | "water_tower";

export interface CityBuilderState {
  gridSize: number;
  grid: (BuildingType | null)[];
  money: number;
  happiness: number;
}

export type CropType = "wheat" | "carrot" | "tomato" | "corn";

export interface FarmPlot {
  crop: CropType | null;
  plantedAtMs: number | null;
  wateredAtMs: number | null;
}

export type FarmAnimalType = "chicken" | "cow" | "sheep";

export interface FarmAnimal {
  id: string;
  type: FarmAnimalType;
  happiness: number;
  lastFedAtMs: number | null;
}

export interface FarmSimulatorState {
  plots: FarmPlot[];
  animals: FarmAnimal[];
  coins: number;
  harvestCount: number;
}

export interface SpaceMissionState {
  visitedPlanetSlugs: string[];
  samplesCollected: string[];
  fuel: number;
  missionsCompleted: number;
}

export interface EcoScenarioChoice {
  scenarioId: string;
  choiceId: string;
  correct: boolean;
}

export interface EcoWorldState {
  scenarioIndex: number;
  ecoScore: number;
  choicesMade: EcoScenarioChoice[];
}
