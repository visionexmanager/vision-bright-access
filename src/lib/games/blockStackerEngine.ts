/**
 * Block Stacker — deterministic falling-block engine.
 *
 * What it replaced had no falling piece, no rotation and no gravity: the player
 * clicked one of four column pairs and two cells appeared at the bottom. This
 * is the real game — pieces that fall, rotate against the walls and the stack,
 * lock, clear full rows and speed up — written as pure functions over an
 * immutable state.
 *
 * The piece set, palette and scoring are Visionex's own. Falling-block puzzles
 * are a genre, but nothing here is taken from another publisher's game: no
 * borrowed name, art, sounds or presentation.
 */

export type BlockStackerStatus = "ready" | "running" | "over";
export type BlockStackerEvent = "move" | "rotate" | "lock" | "clear" | "level" | "over";

/** A shape is a list of filled cells per rotation, on a 4×4 lattice. */
export interface PieceShape {
  id: string;
  /** Rotation states, each a list of [x, y] offsets. */
  rotations: readonly (readonly (readonly [number, number])[])[];
}

const shape = (id: string, cells: readonly (readonly [number, number])[]): PieceShape => ({
  id,
  rotations: buildRotations(cells),
});

/** Rotates a cell list a quarter turn clockwise inside its bounding box. */
function rotateCells(cells: readonly (readonly [number, number])[]): (readonly [number, number])[] {
  const maxY = Math.max(...cells.map(([, y]) => y));
  return cells.map(([x, y]) => [maxY - y, x] as const);
}

function buildRotations(cells: readonly (readonly [number, number])[]) {
  const states = [cells];
  for (let i = 0; i < 3; i += 1) states.push(rotateCells(states[states.length - 1]));
  // Symmetric shapes repeat; keeping duplicates would make rotation a no-op that
  // still costs the player a keypress.
  const seen = new Set<string>();
  return states.filter((state) => {
    const key = [...state].map(([x, y]) => `${x},${y}`).sort().join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const PIECES: readonly PieceShape[] = [
  shape("bar", [[0, 0], [1, 0], [2, 0], [3, 0]]),
  shape("square", [[0, 0], [1, 0], [0, 1], [1, 1]]),
  shape("tee", [[0, 0], [1, 0], [2, 0], [1, 1]]),
  shape("ell", [[0, 0], [0, 1], [1, 1], [2, 1]]),
  shape("jay", [[2, 0], [0, 1], [1, 1], [2, 1]]),
  shape("step", [[1, 0], [2, 0], [0, 1], [1, 1]]),
  shape("kick", [[0, 0], [1, 0], [1, 1], [2, 1]]),
];

export interface BlockStackerConfig {
  columns: number;
  rows: number;
  /** Drop interval at level 1, in milliseconds. */
  startDropMs: number;
  minDropMs: number;
  dropMsPerLevel: number;
  /** Rows cleared before the level rises. */
  rowsPerLevel: number;
}

export const BLOCK_STACKER_CONFIG: BlockStackerConfig = {
  columns: 10,
  rows: 18,
  startDropMs: 700,
  minDropMs: 110,
  dropMsPerLevel: 60,
  rowsPerLevel: 8,
};

export interface ActivePiece {
  shapeIndex: number;
  rotation: number;
  x: number;
  y: number;
}

export interface BlockStackerState {
  config: BlockStackerConfig;
  /** Row-major; 0 is empty, otherwise the 1-based index of the shape that locked there. */
  grid: number[][];
  piece: ActivePiece | null;
  nextShapeIndex: number;
  score: number;
  level: number;
  rowsCleared: number;
  /** Rows cleared by the most recent lock, for feedback. */
  lastCleared: number;
  status: BlockStackerStatus;
  events: BlockStackerEvent[];
  seed: number;
}

function nextRandom(seed: number): { value: number; seed: number } {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: t };
}

export function emptyGrid(config: BlockStackerConfig): number[][] {
  return Array.from({ length: config.rows }, () => Array(config.columns).fill(0));
}

export function pieceCells(piece: ActivePiece): (readonly [number, number])[] {
  return PIECES[piece.shapeIndex].rotations[piece.rotation % PIECES[piece.shapeIndex].rotations.length].map(
    ([x, y]) => [piece.x + x, piece.y + y] as const,
  );
}

export function fits(state: BlockStackerState, piece: ActivePiece): boolean {
  return pieceCells(piece).every(([x, y]) => {
    if (x < 0 || x >= state.config.columns || y >= state.config.rows) return false;
    // Above the ceiling is allowed while a piece is still entering the field.
    return y < 0 || state.grid[y][x] === 0;
  });
}

function spawn(state: BlockStackerState, shapeIndex: number): ActivePiece {
  const cells = PIECES[shapeIndex].rotations[0];
  const width = Math.max(...cells.map(([x]) => x)) + 1;
  return { shapeIndex, rotation: 0, x: Math.floor((state.config.columns - width) / 2), y: 0 };
}

export function dropIntervalMs(state: BlockStackerState): number {
  const { startDropMs, dropMsPerLevel, minDropMs } = state.config;
  return Math.max(minDropMs, startDropMs - (state.level - 1) * dropMsPerLevel);
}

export function createBlockStackerState(seed = Date.now(), config: BlockStackerConfig = BLOCK_STACKER_CONFIG): BlockStackerState {
  const first = nextRandom(seed);
  const second = nextRandom(first.seed);
  const base: BlockStackerState = {
    config,
    grid: emptyGrid(config),
    piece: null,
    nextShapeIndex: Math.floor(second.value * PIECES.length),
    score: 0,
    level: 1,
    rowsCleared: 0,
    lastCleared: 0,
    status: "ready",
    events: [],
    seed: second.seed,
  };
  return { ...base, piece: spawn(base, Math.floor(first.value * PIECES.length)) };
}

export function startBlockStacker(state: BlockStackerState): BlockStackerState {
  return state.status === "ready" ? { ...state, status: "running", events: [] } : state;
}

export function moveHorizontally(state: BlockStackerState, dx: number): BlockStackerState {
  if (state.status !== "running" || !state.piece) return state;
  const moved = { ...state.piece, x: state.piece.x + dx };
  return fits(state, moved) ? { ...state, piece: moved, events: ["move"] } : state;
}

/**
 * Rotates, nudging the piece off a wall or the stack if the plain rotation
 * would not fit. Without the nudge a piece against the left wall simply cannot
 * be turned, which players read as the game ignoring them.
 */
export function rotatePiece(state: BlockStackerState): BlockStackerState {
  if (state.status !== "running" || !state.piece) return state;
  const rotations = PIECES[state.piece.shapeIndex].rotations.length;
  if (rotations === 1) return state;
  const rotated = { ...state.piece, rotation: (state.piece.rotation + 1) % rotations };
  for (const nudge of [0, -1, 1, -2, 2]) {
    const candidate = { ...rotated, x: rotated.x + nudge };
    if (fits(state, candidate)) return { ...state, piece: candidate, events: ["rotate"] };
  }
  return state;
}

function clearRows(state: BlockStackerState): BlockStackerState {
  const kept = state.grid.filter((row) => row.some((cell) => cell === 0));
  const cleared = state.grid.length - kept.length;
  if (!cleared) return { ...state, lastCleared: 0 };

  // Four at once is worth far more than four one at a time, which is what makes
  // building a deep well worth the risk.
  const table = [0, 100, 300, 600, 1000];
  const score = state.score + table[Math.min(cleared, 4)] * state.level;
  const rowsCleared = state.rowsCleared + cleared;
  const level = Math.floor(rowsCleared / state.config.rowsPerLevel) + 1;
  const grid = [...Array.from({ length: cleared }, () => Array(state.config.columns).fill(0)), ...kept];

  return {
    ...state,
    grid,
    score,
    rowsCleared,
    level,
    lastCleared: cleared,
    events: [...state.events, "clear", ...(level > state.level ? (["level"] as const) : [])],
  };
}

function lockPiece(state: BlockStackerState): BlockStackerState {
  if (!state.piece) return state;
  const grid = state.grid.map((row) => [...row]);
  for (const [x, y] of pieceCells(state.piece)) {
    // A cell still above the ceiling means the stack reached the top.
    if (y < 0) return { ...state, piece: null, status: "over", events: [...state.events, "over"] };
    grid[y][x] = state.piece.shapeIndex + 1;
  }

  const locked = clearRows({ ...state, grid, piece: null, events: [...state.events, "lock"] });
  const { value, seed } = nextRandom(locked.seed);
  const piece = spawn(locked, locked.nextShapeIndex);
  const next: BlockStackerState = { ...locked, seed, nextShapeIndex: Math.floor(value * PIECES.length), piece };

  if (!fits(next, piece)) return { ...next, piece, status: "over", events: [...next.events, "over"] };
  return next;
}

/** One gravity step, or one soft drop. Locks the piece when it cannot fall. */
export function stepDown(state: BlockStackerState): BlockStackerState {
  if (state.status !== "running" || !state.piece) return state;
  const moved = { ...state.piece, y: state.piece.y + 1 };
  if (fits(state, moved)) return { ...state, piece: moved, events: [] };
  return lockPiece({ ...state, events: [] });
}

/** Where the piece would land, for the landing preview and for a hard drop. */
export function ghostPiece(state: BlockStackerState): ActivePiece | null {
  if (!state.piece) return null;
  let piece = state.piece;
  while (fits(state, { ...piece, y: piece.y + 1 })) piece = { ...piece, y: piece.y + 1 };
  return piece;
}

export function hardDrop(state: BlockStackerState): BlockStackerState {
  if (state.status !== "running" || !state.piece) return state;
  const landing = ghostPiece(state)!;
  const dropped = landing.y - state.piece.y;
  return lockPiece({ ...state, piece: landing, score: state.score + dropped * 2, events: [] });
}

export function columnHeights(state: BlockStackerState): number[] {
  return Array.from({ length: state.config.columns }, (_, x) => {
    const row = state.grid.findIndex((cells) => cells[x] !== 0);
    return row < 0 ? 0 : state.config.rows - row;
  });
}

export function describeBlockStackerBoard(state: BlockStackerState): string {
  if (state.status === "over") {
    return `Game over with ${state.score} points at level ${state.level}, ${state.rowsCleared} rows cleared.`;
  }
  const heights = columnHeights(state);
  const lowest = heights.reduce((best, height, index) => (height < heights[best] ? index : best), 0);
  const parts = [
    `Level ${state.level}. Score ${state.score}. ${state.rowsCleared} rows cleared.`,
  ];
  if (state.piece) {
    const cells = pieceCells(state.piece);
    const left = Math.min(...cells.map(([x]) => x)) + 1;
    const right = Math.max(...cells.map(([x]) => x)) + 1;
    const landing = ghostPiece(state);
    parts.push(`${PIECES[state.piece.shapeIndex].id} piece over columns ${left} to ${right}.`);
    if (landing) {
      // How far there is left to steer matters more than the absolute row: a
      // player who cannot see the piece needs to know how long they have.
      const toFall = landing.y - state.piece.y;
      parts.push(
        toFall === 0
          ? "About to lock."
          : `${toFall} ${toFall === 1 ? "row" : "rows"} above its landing spot, on row ${state.config.rows - Math.max(...pieceCells(landing).map(([, y]) => y))}.`,
      );
    }
  }
  parts.push(`Next piece ${PIECES[state.nextShapeIndex].id}.`);
  parts.push(`Lowest column is ${lowest + 1}, at height ${heights[lowest]}. Tallest is ${Math.max(...heights)}.`);
  return parts.join(" ");
}
