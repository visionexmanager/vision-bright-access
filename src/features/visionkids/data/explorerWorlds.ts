import type { ExplorerWorldColor } from "@/features/visionkids/types/explorer.types";

/** The 9 "browse and learn" worlds share ONE generic list+detail template
 *  (see components/explorer/WorldExplorerTemplate.tsx). This config is what
 *  makes that possible: category tabs and which `content.*` JSONB fields to
 *  surface as fact rows, per world — driven entirely by data, so adding a
 *  10th content world later means adding one entry here, never a new page. */
export interface WorldFactField {
  key: string;
  labelKey: string;
  suffix?: string;
}

export interface WorldCategoryTab {
  value: string;
  labelKey: string;
}

export interface ContentWorldConfig {
  categories: WorldCategoryTab[];
  factFields: WorldFactField[];
}

export const CONTENT_WORLD_CONFIG: Record<string, ContentWorldConfig> = {
  "planet-explorer": {
    categories: [
      { value: "all", labelKey: "kids.explorer.categoryAll" },
      { value: "star", labelKey: "kids.explorer.planet.star" },
      { value: "planet", labelKey: "kids.explorer.planet.planet" },
      { value: "moon", labelKey: "kids.explorer.planet.moon" },
      { value: "dwarf_planet", labelKey: "kids.explorer.planet.dwarfPlanet" },
    ],
    factFields: [
      { key: "diameter_km", labelKey: "kids.explorer.fact.diameter", suffix: " km" },
      { key: "distance_from_sun_km", labelKey: "kids.explorer.fact.distanceFromSun", suffix: " km" },
      { key: "moons", labelKey: "kids.explorer.fact.moons" },
      { key: "day_length", labelKey: "kids.explorer.fact.dayLength" },
      { key: "year_length", labelKey: "kids.explorer.fact.yearLength" },
      { key: "temp_c", labelKey: "kids.explorer.fact.temperature" },
    ],
  },
  "ocean-explorer": {
    categories: [
      { value: "all", labelKey: "kids.explorer.categoryAll" },
      { value: "creature", labelKey: "kids.explorer.ocean.creature" },
      { value: "place", labelKey: "kids.explorer.ocean.place" },
    ],
    factFields: [
      { key: "habitat", labelKey: "kids.explorer.fact.habitat" },
      { key: "diet", labelKey: "kids.explorer.fact.diet" },
      { key: "size", labelKey: "kids.explorer.fact.size" },
      { key: "depth_range", labelKey: "kids.explorer.fact.depthRange" },
    ],
  },
  "animal-kingdom": {
    categories: [
      { value: "all", labelKey: "kids.explorer.categoryAll" },
      { value: "mammal", labelKey: "kids.explorer.animal.mammal" },
      { value: "bird", labelKey: "kids.explorer.animal.bird" },
      { value: "reptile", labelKey: "kids.explorer.animal.reptile" },
      { value: "fish", labelKey: "kids.explorer.animal.fish" },
      { value: "insect", labelKey: "kids.explorer.animal.insect" },
      { value: "amphibian", labelKey: "kids.explorer.animal.amphibian" },
    ],
    factFields: [
      { key: "habitat", labelKey: "kids.explorer.fact.habitat" },
      { key: "diet", labelKey: "kids.explorer.fact.diet" },
      { key: "lifespan", labelKey: "kids.explorer.fact.lifespan" },
      { key: "distribution", labelKey: "kids.explorer.fact.distribution" },
    ],
  },
  "human-body-explorer": {
    categories: [{ value: "all", labelKey: "kids.explorer.categoryAll" }],
    factFields: [
      { key: "function_summary", labelKey: "kids.explorer.fact.function" },
    ],
  },
  "dinosaur-world": {
    categories: [
      { value: "all", labelKey: "kids.explorer.categoryAll" },
      { value: "dinosaur", labelKey: "kids.explorer.dinosaur.dinosaur" },
      { value: "flying_reptile", labelKey: "kids.explorer.dinosaur.flyingReptile" },
    ],
    factFields: [
      { key: "period", labelKey: "kids.explorer.fact.period" },
      { key: "diet", labelKey: "kids.explorer.fact.diet" },
      { key: "length_m", labelKey: "kids.explorer.fact.length", suffix: " m" },
      { key: "weight_kg", labelKey: "kids.explorer.fact.weight", suffix: " kg" },
      { key: "region", labelKey: "kids.explorer.fact.region" },
    ],
  },
  "history-explorer": {
    categories: [{ value: "all", labelKey: "kids.explorer.categoryAll" }],
    factFields: [
      { key: "era", labelKey: "kids.explorer.fact.era" },
      { key: "region", labelKey: "kids.explorer.fact.region" },
    ],
  },
  "geography-explorer": {
    categories: [
      { value: "all", labelKey: "kids.explorer.categoryAll" },
      { value: "continent", labelKey: "kids.explorer.geography.continent" },
      { value: "country", labelKey: "kids.explorer.geography.country" },
      { value: "mountain", labelKey: "kids.explorer.geography.mountain" },
      { value: "river", labelKey: "kids.explorer.geography.river" },
      { value: "desert", labelKey: "kids.explorer.geography.desert" },
      { value: "forest", labelKey: "kids.explorer.geography.forest" },
    ],
    factFields: [
      { key: "capital", labelKey: "kids.explorer.fact.capital" },
      { key: "population", labelKey: "kids.explorer.fact.population" },
      { key: "height_m", labelKey: "kids.explorer.fact.height", suffix: " m" },
      { key: "length_km", labelKey: "kids.explorer.fact.length", suffix: " km" },
      { key: "area_km2", labelKey: "kids.explorer.fact.area", suffix: " km²" },
    ],
  },
  "weather-lab": {
    categories: [
      { value: "all", labelKey: "kids.explorer.categoryAll" },
      { value: "phenomenon", labelKey: "kids.explorer.weather.phenomenon" },
      { value: "season", labelKey: "kids.explorer.weather.season" },
    ],
    factFields: [
      { key: "causes", labelKey: "kids.explorer.fact.causes" },
      { key: "effects", labelKey: "kids.explorer.fact.effects" },
    ],
  },
  "nature-explorer": {
    categories: [
      { value: "all", labelKey: "kids.explorer.categoryAll" },
      { value: "plant", labelKey: "kids.explorer.nature.plant" },
      { value: "tree", labelKey: "kids.explorer.nature.tree" },
      { value: "flower", labelKey: "kids.explorer.nature.flower" },
      { value: "ecosystem", labelKey: "kids.explorer.nature.ecosystem" },
      { value: "conservation", labelKey: "kids.explorer.nature.conservation" },
    ],
    factFields: [
      { key: "habitat", labelKey: "kids.explorer.fact.habitat" },
      { key: "note", labelKey: "kids.explorer.fact.note" },
    ],
  },
};

export const WORLD_COLOR_CLASSES: Record<ExplorerWorldColor, string> = {
  primary: "border-kids-primary/30 bg-kids-primary/10 text-kids-primary",
  secondary: "border-kids-secondary/30 bg-kids-secondary/10 text-kids-secondary",
  accent: "border-kids-accent/30 bg-kids-accent/10 text-kids-accent",
  pink: "border-kids-pink/30 bg-kids-pink/10 text-kids-pink",
  green: "border-kids-green/30 bg-kids-green/10 text-kids-green",
  purple: "border-kids-purple/30 bg-kids-purple/10 text-kids-purple",
};

export const SIMULATOR_ROUTES: Record<string, string> = {
  "space-mission": "/kids/explorer/space-mission",
  "city-builder": "/kids/explorer/city-builder",
  "farm-simulator": "/kids/explorer/farm-simulator",
  "eco-world": "/kids/explorer/eco-world",
};
