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

const cc0 = (
  asset: Omit<AudioAssetDefinition, "quality" | "sources" | "sourceAttribution" | "license" | "licenseStatus">,
  source: { title: string; creator: string },
): AudioAssetDefinition => ({
  ...asset,
  quality: "production",
  sources: [{ src:`/audio/arcade/${asset.id}.mp3`, codec:"mp3", bitrateKbps:192, sampleRateHz:48_000 }],
  sourceAttribution: `Freesound — "${source.title}" by ${source.creator} (CC0, found through Openverse)`,
  license: "Creative Commons CC0 1.0 Universal — public-domain dedication; attribution not required",
  licenseStatus: "approved",
  notes: `Freesound CC0 preview (128 kbps MP3 source) trimmed and mastered by Visionex. Provenance: public/audio/arcade/ASSET_MANIFEST.md`,
});

export const AUDIO_LIBRARY: readonly AudioAssetDefinition[] = [
  mixkit({ id:"ui-select", name:"Arcade UI Select", gameIds:["*"], category:"ui", channel:"effects", maxInstances:3, normalizedLufs:-18 }, 3124, "Modern technology select"),
  mixkit({ id:"button-confirm", name:"Natural Button Confirm", gameIds:["*"], category:"button", channel:"effects", maxInstances:3, normalizedLufs:-18 }, 2867, "Confirmation tone"),
  mixkit({ id:"puzzle-place", name:"Puzzle Piece Placement", gameIds:["memory","word-puzzle","logiquest","neon-breach"], category:"game-effect", channel:"effects", maxInstances:4, normalizedLufs:-18 }, 960, "Tile game reveal"),
  mixkit({ id:"puzzle-success", name:"Calm Puzzle Success", gameIds:["memory","word-puzzle","logiquest","quiz-challenge"], category:"victory", channel:"effects", maxInstances:2, normalizedLufs:-16 }, 2870, "Correct answer tone"),
  mixkit({ id:"puzzle-failure", name:"Soft Puzzle Failure", gameIds:["memory","word-puzzle","logiquest","quiz-challenge"], category:"failure", channel:"effects", maxInstances:2, normalizedLufs:-18 }, 946, "Wrong answer fail notification"),
  mixkit({ id:"wood-piece-place", name:"Solid Wood Piece Placement", gameIds:["visionopoly","dominoes","chess","backgammon","ludo"], category:"game-effect", channel:"effects", maxInstances:4, normalizedLufs:-18 }, 2182, "Wood hard hit"),
  cc0({ id:"chess-piece-move", name:"Solid Wood Chess Piece Move", gameIds:["chess"], category:"game-effect", channel:"effects", maxInstances:4, normalizedLufs:-18 }, { title:"Chess Pieces hitting wooden board.wav", creator:"XfiXy8" }),
  cc0({ id:"chess-piece-capture", name:"Solid Wood Chess Piece Capture", gameIds:["chess"], category:"game-effect", channel:"effects", maxInstances:3, normalizedLufs:-18 }, { title:"Forcefully knocking over chess piece, with roll FINAL.wav", creator:"mht23SD" }),
  mixkit({ id:"card-place", name:"Real Card Table Placement", gameIds:["uno-ultra","briscola","card-99"], category:"game-effect", channel:"effects", maxInstances:4, normalizedLufs:-18 }, 2001, "Poker card placement"),
  cc0({ id:"dice-roll", name:"Real Dice Roll on Wood", gameIds:["farkle","visionopoly"], category:"game-effect", channel:"effects", maxInstances:2, normalizedLufs:-18 }, { title:"dice roll_wooden table_1.wav", creator:"ekfink" }),
  mixkit({ id:"car-engine-idle", name:"Performance Engine Idle", gameIds:["velocity-racing"], category:"environment", channel:"ambient", maxInstances:1, normalizedLufs:-22 }, 1535, "Car ignition"),
  mixkit({ id:"car-engine-acceleration", name:"Performance Engine Acceleration", gameIds:["velocity-racing"], category:"game-effect", channel:"effects", maxInstances:1, normalizedLufs:-18 }, 1560, "Transport car start"),
  cc0({ id:"car-gear-shift", name:"Mechanical Gear Shift", gameIds:["velocity-racing"], category:"game-effect", channel:"effects", maxInstances:2, normalizedLufs:-18 }, { title:"Column Gear Select Up (mono).wav", creator:"E-Audio" }),
  required({ id:"car-brake", name:"Performance Brake", gameIds:["velocity-racing"], category:"game-effect", channel:"effects", maxInstances:2, normalizedLufs:-18 }),
  cc0({ id:"car-tire-screech", name:"Real Tire Friction", gameIds:["velocity-racing"], category:"game-effect", channel:"effects", maxInstances:2, normalizedLufs:-18 }, { title:"[SFX] car screech 2", creator:"waveplaySFX" }),
  mixkit({ id:"jungle-ambience", name:"Natural Jungle Ambience", gameIds:["jungle-survival"], category:"environment", channel:"ambient", loop:true, maxInstances:1, normalizedLufs:-24 }, 2434, "Birds in the jungle"),
  mixkit({ id:"kitchen-ambience", name:"Professional Kitchen Ambience", gameIds:["star-chef"], category:"environment", channel:"ambient", loop:true, maxInstances:1, normalizedLufs:-24 }, 1831, "Gas stove hum"),
  mixkit({ id:"natural-victory", name:"Premium Victory Resolve", gameIds:["*"], category:"victory", channel:"music", maxInstances:1, normalizedLufs:-16 }, 502, "Auditorium moderate applause and cheering"),
  mixkit({ id:"natural-failure", name:"Respectful Failure Resolve", gameIds:["*"], category:"failure", channel:"music", maxInstances:1, normalizedLufs:-18 }, 633, "Game over dark orchestra"),
  required({ id:"narration-instructions", name:"Natural Instructions Narration", gameIds:["*"], category:"narration", channel:"voice", maxInstances:1, normalizedLufs:-16 }),
  required({ id:"kids-natural-guidance", name:"Natural Child-Friendly Guidance", gameIds:["kids"], category:"character", channel:"voice", maxInstances:1, normalizedLufs:-16 }),
  required({ id:"music-menu", name:"Arcade Menu Score", gameIds:["*"], category:"music", channel:"music", loop:true, maxInstances:1, normalizedLufs:-23 }),
  required({ id:"music-active", name:"Adaptive Active Gameplay Score", gameIds:["*"], category:"music", channel:"music", loop:true, maxInstances:1, normalizedLufs:-23 }),
  required({ id:"music-danger", name:"Adaptive Danger Gameplay Score", gameIds:["*"], category:"music", channel:"music", loop:true, maxInstances:1, normalizedLufs:-23 }),
  cc0({ id:"card-flip", name:"Real Card Flip", gameIds:["uno-ultra","briscola","card-99","solitaire","spider-solitaire","freecell"], category:"game-effect", channel:"effects", maxInstances:4, normalizedLufs:-18 }, { title:"Card.wav", creator:"CaptainYulef" }),
  cc0({ id:"card-shuffle", name:"Real Card Shuffle", gameIds:["uno-ultra","briscola","card-99","solitaire","spider-solitaire","freecell"], category:"game-effect", channel:"effects", maxInstances:2, normalizedLufs:-18 }, { title:"shuffle.wav", creator:"deathpie" }),
  cc0({ id:"answer-correct", name:"Quiz Correct Answer", gameIds:["trivia","geography-quiz","history-quiz","nature-quiz","science-quiz","space-quiz","sports-quiz","technology-quiz"], category:"game-effect", channel:"effects", maxInstances:2, normalizedLufs:-18 }, { title:"correct", creator:"ertfelda" }),
  cc0({ id:"answer-wrong", name:"Quiz Wrong Answer", gameIds:["trivia","geography-quiz","history-quiz","nature-quiz","science-quiz","space-quiz","sports-quiz","technology-quiz"], category:"game-effect", channel:"effects", maxInstances:2, normalizedLufs:-18 }, { title:"buzzer2.wav", creator:"hypocore" }),
  cc0({ id:"key-click", name:"Keyboard Key Click", gameIds:["typing-speed"], category:"game-effect", channel:"effects", maxInstances:6, normalizedLufs:-18 }, { title:"qKey.wav", creator:"UberBosser" }),
  cc0({ id:"typewriter-key", name:"Typewriter Key", gameIds:["typing-speed","spelling-master"], category:"game-effect", channel:"effects", maxInstances:6, normalizedLufs:-18 }, { title:"keyboard5.wav", creator:"jim-ph" }),
  cc0({ id:"pencil-write", name:"Pencil on Paper", gameIds:["sudoku"], category:"game-effect", channel:"effects", maxInstances:2, normalizedLufs:-18 }, { title:"PEN SIGNATURE SIGNING 2.wav", creator:"ListenTonyBoy" }),
  cc0({ id:"coin-pickup", name:"Coin Pickup", gameIds:["trade-tycoon"], category:"game-effect", channel:"effects", maxInstances:3, normalizedLufs:-18 }, { title:"Retro, Coin 02.wav", creator:"MATRIXXX_" }),
  cc0({ id:"piano-note", name:"Piano Note (E4, re-pitched per key)", gameIds:["piano-trainer","melody-memory","music-ear","rhythm-keys"], category:"game-effect", channel:"effects", maxInstances:4, normalizedLufs:-18 }, { title:"Mi.WAV", creator:"LuckyLux" }),
  cc0({ id:"drum-hit", name:"Snare Drum Hit", gameIds:["rhythm-keys","beat-matcher","rhythm-navigation"], category:"game-effect", channel:"effects", maxInstances:3, normalizedLufs:-18 }, { title:"Rpeople_Snare2.wav", creator:"rhythmpeople" }),
  cc0({ id:"metronome-click", name:"Metronome Click", gameIds:["beat-matcher"], category:"game-effect", channel:"effects", maxInstances:3, normalizedLufs:-18 }, { title:"Quick Clack", creator:"effectator" }),
];

const byId = new Map(AUDIO_LIBRARY.map((asset) => [asset.id, asset]));

export const audioLibrary = {
  all: () => AUDIO_LIBRARY,
  get: (id: string) => byId.get(id),
  forGame: (gameId: string) => AUDIO_LIBRARY.filter((asset) => asset.gameIds.includes("*") || asset.gameIds.includes(gameId)),
  byCategory: (category: AudioCategory) => AUDIO_LIBRARY.filter((asset) => asset.category === category),
  playable: () => AUDIO_LIBRARY.filter((asset) => asset.licenseStatus === "approved" && asset.quality === "production" && asset.sources.length > 0),
};
