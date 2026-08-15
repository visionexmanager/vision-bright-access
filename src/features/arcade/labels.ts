import type { ArcadeAge, ArcadeCategory, ArcadeDifficulty } from "./catalog";

type Translate = (key: string) => string;

/**
 * Catalog values are English identifiers: they key the filters on /games and
 * are compared directly, so they must never be translated in place. These
 * helpers map a value to the key that carries its display text instead.
 *
 * Category keys drop the spaces — "Tower Defense" reads games.cat.TowerDefense
 * — so every key stays a plain identifier.
 */
export const categoryLabelKey = (category: ArcadeCategory) => `games.cat.${category.replace(/\s+/g, "")}`;
export const difficultyLabelKey = (difficulty: ArcadeDifficulty) => `games.difficulty.${difficulty.toLowerCase()}`;
export const ageLabelKey = (age: ArcadeAge) => `games.age.${age}`;

export const categoryLabel = (t: Translate, category: ArcadeCategory) => t(categoryLabelKey(category));
export const difficultyLabel = (t: Translate, difficulty: ArcadeDifficulty) => t(difficultyLabelKey(difficulty));
export const ageLabel = (t: Translate, age: ArcadeAge) => t(ageLabelKey(age));
