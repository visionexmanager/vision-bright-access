import type { AudioAssetDefinition, AudioCategory } from "./types";

/**
 * Production audio registry. Empty sources are deliberate: the engine refuses
 * to play an asset until licensing and mastering are approved. This prevents
 * preview URLs or unlicensed files from silently shipping as final audio.
 */
const required = (asset: Omit<AudioAssetDefinition, "quality" | "sources" | "sourceAttribution" | "license" | "licenseStatus">): AudioAssetDefinition => ({
  ...asset,
  quality: "replacement-required",
  sources: [],
  sourceAttribution: "Visionex commissioned production — pending",
  license: "Exclusive commercial usage rights required",
  licenseStatus: "pending",
});

const mixkit = (
  asset: Omit<AudioAssetDefinition, "quality" | "sources" | "sourceAttribution" | "license" | "licenseStatus">,
  sourceId: number,
  sourceTitle: string,
): AudioAssetDefinition => ({
  ...asset,
  quality: "production",
  sources: [{ src:`/audio/arcade/${asset.id}.mp3`, codec:"mp3", bitrateKbps:192, sampleRateHz:48_000 }],
  sourceAttribution: `Mixkit — ${sourceTitle} (SFX ${sourceId})`,
  license: "Mixkit Sound Effects Free License — commercial and personal use; attribution not required",
  licenseStatus: "approved",
  notes: `Original WAV downloaded from Mixkit and web-mastered by Visionex. Provenance: public/audio/arcade/ASSET_MANIFEST.md`,
});

export const AUDIO_LIBRARY: readonly AudioAssetDefinition[] = [
  mixkit({ id:"ui-select", name:"Arcade UI Select", gameIds:["*"], category:"ui", channel:"effects", maxInstances:3, normalizedLufs:-18 }, 3124, "Modern technology select"),
  mixkit({ id:"button-confirm", name:"Natural Button Confirm", gameIds:["*"], category:"button", channel:"effects", maxInstances:3, normalizedLufs:-18 }, 2867, "Confirmation tone"),
  mixkit({ id:"puzzle-place", name:"Puzzle Piece Placement", gameIds:["memory","word-puzzle","logiquest","neon-breach"], category:"game-effect", channel:"effects", maxInstances:4, normalizedLufs:-18 }, 960, "Tile game reveal"),
  mixkit({ id:"puzzle-success", name:"Calm Puzzle Success", gameIds:["memory","word-puzzle","logiquest","quiz-challenge"], category:"victory", channel:"effects", maxInstances:2, normalizedLufs:-16 }, 2870, "Correct answer tone"),
  mixkit({ id:"puzzle-failure", name:"Soft Puzzle Failure", gameIds:["memory","word-puzzle","logiquest","quiz-challenge"], category:"failure", channel:"effects", maxInstances:2, normalizedLufs:-18 }, 946, "Wrong answer fail notification"),
  mixkit({ id:"wood-piece-place", name:"Solid Wood Piece Placement", gameIds:["visionopoly","dominoes"], category:"game-effect", channel:"effects", maxInstances:4, normalizedLufs:-18 }, 2182, "Wood hard hit"),
  required({ id:"chess-piece-move", name:"Solid Wood Chess Piece Move", gameIds:["chess"], category:"game-effect", channel:"effects", maxInstances:4, normalizedLufs:-18 }),
  required({ id:"chess-piece-capture", name:"Solid Wood Chess Piece Capture", gameIds:["chess"], category:"game-effect", channel:"effects", maxInstances:3, normalizedLufs:-18 }),
  mixkit({ id:"card-place", name:"Real Card Table Placement", gameIds:["uno-ultra","briscola","card-99"], category:"game-effect", channel:"effects", maxInstances:4, normalizedLufs:-18 }, 2001, "Poker card placement"),
  required({ id:"dice-roll", name:"Real Dice Roll on Wood", gameIds:["farkle","visionopoly"], category:"game-effect", channel:"effects", maxInstances:2, normalizedLufs:-18 }),
  mixkit({ id:"car-engine-idle", name:"Performance Engine Idle", gameIds:["velocity-racing"], category:"environment", channel:"ambient", maxInstances:1, normalizedLufs:-22 }, 1535, "Car ignition"),
  mixkit({ id:"car-engine-acceleration", name:"Performance Engine Acceleration", gameIds:["velocity-racing"], category:"game-effect", channel:"effects", maxInstances:1, normalizedLufs:-18 }, 1560, "Transport car start"),
  required({ id:"car-gear-shift", name:"Mechanical Gear Shift", gameIds:["velocity-racing"], category:"game-effect", channel:"effects", maxInstances:2, normalizedLufs:-18 }),
  required({ id:"car-brake", name:"Performance Brake", gameIds:["velocity-racing"], category:"game-effect", channel:"effects", maxInstances:2, normalizedLufs:-18 }),
  required({ id:"car-tire-screech", name:"Real Tire Friction", gameIds:["velocity-racing"], category:"game-effect", channel:"effects", maxInstances:2, normalizedLufs:-18 }),
  mixkit({ id:"jungle-ambience", name:"Natural Jungle Ambience", gameIds:["jungle-survival"], category:"environment", channel:"ambient", loop:true, maxInstances:1, normalizedLufs:-24 }, 2434, "Birds in the jungle"),
  mixkit({ id:"kitchen-ambience", name:"Professional Kitchen Ambience", gameIds:["star-chef"], category:"environment", channel:"ambient", loop:true, maxInstances:1, normalizedLufs:-24 }, 1831, "Gas stove hum"),
  mixkit({ id:"natural-victory", name:"Premium Victory Resolve", gameIds:["*"], category:"victory", channel:"music", maxInstances:1, normalizedLufs:-16 }, 502, "Auditorium moderate applause and cheering"),
  mixkit({ id:"natural-failure", name:"Respectful Failure Resolve", gameIds:["*"], category:"failure", channel:"music", maxInstances:1, normalizedLufs:-18 }, 633, "Game over dark orchestra"),
  required({ id:"narration-instructions", name:"Natural Instructions Narration", gameIds:["*"], category:"narration", channel:"voice", maxInstances:1, normalizedLufs:-16 }),
  required({ id:"kids-natural-guidance", name:"Natural Child-Friendly Guidance", gameIds:["kids"], category:"character", channel:"voice", maxInstances:1, normalizedLufs:-16 }),
  required({ id:"music-menu", name:"Arcade Menu Score", gameIds:["*"], category:"music", channel:"music", loop:true, maxInstances:1, normalizedLufs:-23 }),
  required({ id:"music-active", name:"Adaptive Active Gameplay Score", gameIds:["*"], category:"music", channel:"music", loop:true, maxInstances:1, normalizedLufs:-23 }),
  required({ id:"music-danger", name:"Adaptive Danger Gameplay Score", gameIds:["*"], category:"music", channel:"music", loop:true, maxInstances:1, normalizedLufs:-23 }),
];

const byId = new Map(AUDIO_LIBRARY.map((asset) => [asset.id, asset]));

export const audioLibrary = {
  all: () => AUDIO_LIBRARY,
  get: (id: string) => byId.get(id),
  forGame: (gameId: string) => AUDIO_LIBRARY.filter((asset) => asset.gameIds.includes("*") || asset.gameIds.includes(gameId)),
  byCategory: (category: AudioCategory) => AUDIO_LIBRARY.filter((asset) => asset.category === category),
  playable: () => AUDIO_LIBRARY.filter((asset) => asset.licenseStatus === "approved" && asset.quality === "production" && asset.sources.length > 0),
};
