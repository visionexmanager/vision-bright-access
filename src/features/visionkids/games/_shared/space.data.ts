/**
 * Solar-system facts shared by the planet-explorer and solar-system-quiz
 * games. Proper nouns stay in English, the same precedent flag-quiz set with
 * flags.data.ts — a planet name is not UI copy.
 */
export interface PlanetEntry {
  name: string;
  emoji: string;
  /** 1 = closest to the Sun. */
  order: number;
  moons: number;
  /** Short, kid-sized distinguishing fact. */
  fact: string;
  /** "rocky" or "gas" — the one classification a child is asked for. */
  kind: "rocky" | "gas";
}

export const PLANETS: PlanetEntry[] = [
  { name: "Mercury", emoji: "☿️", order: 1, moons: 0, fact: "The smallest planet and the closest one to the Sun.", kind: "rocky" },
  { name: "Venus", emoji: "♀️", order: 2, moons: 0, fact: "The hottest planet, wrapped in thick yellow clouds.", kind: "rocky" },
  { name: "Earth", emoji: "🌍", order: 3, moons: 1, fact: "The only planet we know of with living things on it.", kind: "rocky" },
  { name: "Mars", emoji: "🔴", order: 4, moons: 2, fact: "The red planet, covered in rusty dust.", kind: "rocky" },
  { name: "Jupiter", emoji: "🪐", order: 5, moons: 95, fact: "The biggest planet, with a giant storm called the Great Red Spot.", kind: "gas" },
  { name: "Saturn", emoji: "🪐", order: 6, moons: 146, fact: "Famous for its bright rings made of ice and rock.", kind: "gas" },
  { name: "Uranus", emoji: "🔵", order: 7, moons: 28, fact: "It rolls around the Sun on its side, like a barrel.", kind: "gas" },
  { name: "Neptune", emoji: "🌊", order: 8, moons: 16, fact: "The windiest planet, and the farthest from the Sun.", kind: "gas" },
];

export const PLANET_NAMES = PLANETS.map((p) => p.name);
