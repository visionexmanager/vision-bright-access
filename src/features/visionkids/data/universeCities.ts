/** Maps each Kids Universe city to the event categories that belong there
 *  (for the "events happening in this city" list) and, where there's no
 *  direct event category match, a cross-link into the matching existing
 *  VisionKids phase — so every city has something real to do, not just
 *  the ones that happen to have events. */
export const CITY_EVENT_CATEGORIES: Record<string, string[]> = {
  "science-city": ["science"],
  "story-city": ["stories", "reading"],
  "game-city": [],
  "space-city": [],
  "music-city": ["music"],
  "art-city": ["drawing"],
  "code-city": ["coding", "ai"],
  "nature-city": [],
};

export const CITY_CROSS_LINK: Record<string, { href: string; labelKey: string } | undefined> = {
  "game-city": { href: "/kids/games", labelKey: "kids.universe.crossLink.games" },
  "space-city": { href: "/kids/explorer/world/planet-explorer", labelKey: "kids.universe.crossLink.space" },
  "art-city": { href: "/kids/studio/drawing-studio/new", labelKey: "kids.universe.crossLink.art" },
  "nature-city": { href: "/kids/explorer/world/nature-explorer", labelKey: "kids.universe.crossLink.nature" },
};
