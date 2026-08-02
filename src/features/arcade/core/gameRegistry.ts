import { ARCADE_GAMES } from "../catalog";
import { GAME_LOADERS } from "./gameLoaders";
import type { GameDefinition } from "./types";

export const GAME_REGISTRY: readonly GameDefinition[] = ARCADE_GAMES.map((game) => ({
  ...game,
  version: "1.0.0",
  status: "active",
  loader: GAME_LOADERS[game.slug],
  assets: [{ id: `${game.slug}-cover`, kind: "cover", src: game.image, width: 800, height: 512 }],
  defaultSettings: { keyboardMode: true, screenReaderMode: game.accessible },
}));

const byId = new Map(GAME_REGISTRY.map((game) => [game.slug, game]));
const byPath = new Map(GAME_REGISTRY.map((game) => [game.to, game]));

export const gameRegistry = {
  all: () => GAME_REGISTRY,
  get: (id: string) => byId.get(id),
  fromPath: (path: string) => byPath.get(path),
  has: (id: string) => byId.has(id),
  load: async (id: string) => {
    const definition = byId.get(id);
    if (!definition) throw new Error(`Unknown arcade game: ${id}`);
    return definition.loader();
  },
};
