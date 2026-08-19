/**
 * Bubble Shooter — deterministic hex-grid engine.
 *
 * What it replaced had no shooter and no aiming: the player tapped a bubble in
 * a square grid and any connected group of three or more vanished. This is the
 * real game — a launcher with an angle, a bubble that travels and bounces off
 * the walls, snapping to the hex grid where it lands, matches that pop, and
 * unsupported clusters that fall.
 *
 * The flight is resolved here rather than in the component, so where a shot
 * lands is a pure function of the board and the angle. The component animates
 * the same path for feel, and the tests assert the landing exactly.
 */

export type BubbleColor = 1 | 2 | 3 | 4 | 5;
export type BubbleStatus = "ready" | "running" | "over" | "won";
export type BubbleEvent = "fire" | "bounce" | "land" | "pop" | "drop" | "row" | "over" | "won";

export interface BubbleCell { row: number; column: number }

export interface BubbleShooterConfig {
  /** Cells in an even (wide) row. Odd rows hold one fewer, offset by half. */
  columns: number;
  /** Rows that fit on screen. Crossing the last one ends the game. */
  rows: number;
  /** Rows filled when a board is dealt. */
  startingRows: number;
  colors: number;
  /** Shots without a pop before a new row is pushed in from the top. */
  shotsPerRow: number;
  /** Largest angle from vertical the launcher can reach, in degrees. */
  maxAngle: number;
}

export const BUBBLE_SHOOTER_CONFIG: BubbleShooterConfig = {
  columns: 8,
  rows: 12,
  startingRows: 5,
  colors: 4,
  shotsPerRow: 6,
  maxAngle: 78,
};

export interface BubbleShooterState {
  config: BubbleShooterConfig;
  /** `grid[row][column]`; 0 is empty. Odd rows leave the last column unused. */
  grid: number[][];
  /** Degrees from vertical: negative is left, positive is right. */
  angle: number;
  loaded: BubbleColor;
  queued: BubbleColor;
  score: number;
  shotsSincePop: number;
  poppedTotal: number;
  status: BubbleStatus;
  events: BubbleEvent[];
  seed: number;
}

/** Row spacing in cell diameters for a hexagonal packing. */
export const ROW_HEIGHT = Math.sqrt(3) / 2;

function nextRandom(seed: number): { value: number; seed: number } {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: t };
}

export const isOddRow = (row: number) => row % 2 === 1;
export const columnsInRow = (config: BubbleShooterConfig, row: number) => config.columns - (isOddRow(row) ? 1 : 0);

/** Centre of a cell, in cell diameters from the left edge and the top. */
export function cellCentre(config: BubbleShooterConfig, cell: BubbleCell): { x: number; y: number } {
  return {
    x: cell.column + (isOddRow(cell.row) ? 1 : 0.5),
    y: cell.row * ROW_HEIGHT + 0.5,
  };
}

export function boardWidth(config: BubbleShooterConfig): number {
  return config.columns;
}

export function boardHeight(config: BubbleShooterConfig): number {
  return (config.rows - 1) * ROW_HEIGHT + 1;
}

export function neighbours(config: BubbleShooterConfig, cell: BubbleCell): BubbleCell[] {
  const shift = isOddRow(cell.row) ? 1 : -1;
  const candidates: BubbleCell[] = [
    { row: cell.row, column: cell.column - 1 },
    { row: cell.row, column: cell.column + 1 },
    { row: cell.row - 1, column: cell.column },
    { row: cell.row - 1, column: cell.column + shift },
    { row: cell.row + 1, column: cell.column },
    { row: cell.row + 1, column: cell.column + shift },
  ];
  return candidates.filter(
    (item) => item.row >= 0 && item.row < config.rows && item.column >= 0 && item.column < columnsInRow(config, item.row),
  );
}

function emptyGrid(config: BubbleShooterConfig): number[][] {
  return Array.from({ length: config.rows }, () => Array(config.columns).fill(0));
}

export function createBubbleShooterState(
  seed = Date.now(),
  config: BubbleShooterConfig = BUBBLE_SHOOTER_CONFIG,
): BubbleShooterState {
  let current = seed;
  const roll = (max: number) => {
    const { value, seed: next } = nextRandom(current);
    current = next;
    return Math.floor(value * max) + 1;
  };

  const grid = emptyGrid(config);
  for (let row = 0; row < config.startingRows; row += 1) {
    for (let column = 0; column < columnsInRow(config, row); column += 1) {
      grid[row][column] = roll(config.colors);
    }
  }

  return {
    config,
    grid,
    angle: 0,
    loaded: roll(config.colors) as BubbleColor,
    queued: roll(config.colors) as BubbleColor,
    score: 0,
    shotsSincePop: 0,
    poppedTotal: 0,
    status: "ready",
    events: [],
    seed: current,
  };
}

export function startBubbleShooter(state: BubbleShooterState): BubbleShooterState {
  return state.status === "ready" ? { ...state, status: "running", events: [] } : state;
}

export function aim(state: BubbleShooterState, angle: number): BubbleShooterState {
  if (state.status === "over" || state.status === "won") return state;
  const clamped = Math.max(-state.config.maxAngle, Math.min(state.config.maxAngle, angle));
  return clamped === state.angle ? state : { ...state, angle: clamped };
}

/**
 * Walks the shot from the launcher until it touches a bubble or the ceiling,
 * and reports the cell it would occupy. Wall bounces are part of the path
 * because banking off a wall is how the game is really played.
 */
export function simulateShot(
  state: BubbleShooterState,
  angle = state.angle,
): { cell: BubbleCell | null; path: { x: number; y: number }[]; bounces: number } {
  const { config } = state;
  const radians = (angle * Math.PI) / 180;
  const width = boardWidth(config);
  const step = 0.06;

  let x = width / 2;
  let y = boardHeight(config) + 0.5;
  let dx = Math.sin(radians) * step;
  const dy = -Math.cos(radians) * step;
  const path = [{ x, y }];
  let bounces = 0;

  const occupied: { cell: BubbleCell; x: number; y: number }[] = [];
  for (let row = 0; row < config.rows; row += 1) {
    for (let column = 0; column < columnsInRow(config, row); column += 1) {
      if (state.grid[row][column]) occupied.push({ cell: { row, column }, ...cellCentre(config, { row, column }) });
    }
  }

  for (let i = 0; i < 4000; i += 1) {
    x += dx;
    y += dy;

    if (x < 0.5) { x = 0.5; dx = Math.abs(dx); bounces += 1; path.push({ x, y }); }
    else if (x > width - 0.5) { x = width - 0.5; dx = -Math.abs(dx); bounces += 1; path.push({ x, y }); }
    else if (i % 4 === 0) path.push({ x, y });

    const hit = occupied.find((item) => (item.x - x) ** 2 + (item.y - y) ** 2 < 1);
    if (hit) return { cell: freeCellNear(state, hit.cell, x, y), path, bounces };

    if (y <= 0.5) {
      path.push({ x, y: 0.5 });
      return { cell: freeCellInRowNear(state, 0, x), path, bounces };
    }
  }
  return { cell: null, path, bounces };
}

/** The empty neighbour of `anchor` closest to where the shot actually was. */
function freeCellNear(state: BubbleShooterState, anchor: BubbleCell, x: number, y: number): BubbleCell | null {
  const options = neighbours(state.config, anchor).filter((cell) => state.grid[cell.row][cell.column] === 0);
  if (!options.length) return null;
  return options.reduce((best, cell) => {
    const a = cellCentre(state.config, cell);
    const b = cellCentre(state.config, best);
    return (a.x - x) ** 2 + (a.y - y) ** 2 < (b.x - x) ** 2 + (b.y - y) ** 2 ? cell : best;
  });
}

function freeCellInRowNear(state: BubbleShooterState, row: number, x: number): BubbleCell | null {
  const options: BubbleCell[] = [];
  for (let column = 0; column < columnsInRow(state.config, row); column += 1) {
    if (state.grid[row][column] === 0) options.push({ row, column });
  }
  if (!options.length) return null;
  return options.reduce((best, cell) =>
    Math.abs(cellCentre(state.config, cell).x - x) < Math.abs(cellCentre(state.config, best).x - x) ? cell : best,
  );
}

/** Every bubble of one colour connected to `start`. */
export function matchingCluster(state: BubbleShooterState, start: BubbleCell): BubbleCell[] {
  const colour = state.grid[start.row][start.column];
  if (!colour) return [];
  const seen = new Set<string>([`${start.row},${start.column}`]);
  const cluster = [start];
  const queue = [start];
  while (queue.length) {
    for (const cell of neighbours(state.config, queue.shift()!)) {
      const key = `${cell.row},${cell.column}`;
      if (seen.has(key) || state.grid[cell.row][cell.column] !== colour) continue;
      seen.add(key);
      cluster.push(cell);
      queue.push(cell);
    }
  }
  return cluster;
}

/** Bubbles with no path back to the top row: they have nothing holding them up. */
export function floatingCells(state: BubbleShooterState): BubbleCell[] {
  const supported = new Set<string>();
  const queue: BubbleCell[] = [];
  for (let column = 0; column < columnsInRow(state.config, 0); column += 1) {
    if (state.grid[0][column]) { supported.add(`0,${column}`); queue.push({ row: 0, column }); }
  }
  while (queue.length) {
    for (const cell of neighbours(state.config, queue.shift()!)) {
      const key = `${cell.row},${cell.column}`;
      if (supported.has(key) || !state.grid[cell.row][cell.column]) continue;
      supported.add(key);
      queue.push(cell);
    }
  }

  const floating: BubbleCell[] = [];
  for (let row = 0; row < state.config.rows; row += 1) {
    for (let column = 0; column < columnsInRow(state.config, row); column += 1) {
      if (state.grid[row][column] && !supported.has(`${row},${column}`)) floating.push({ row, column });
    }
  }
  return floating;
}

export function lowestOccupiedRow(state: BubbleShooterState): number {
  for (let row = state.config.rows - 1; row >= 0; row -= 1) {
    if (state.grid[row].some((cell, column) => cell && column < columnsInRow(state.config, row))) return row;
  }
  return -1;
}

export function remainingBubbles(state: BubbleShooterState): number {
  return state.grid.reduce((total, row) => total + row.filter(Boolean).length, 0);
}

/** Pushes a fresh row in at the top and shifts everything down one row. */
export function pushRow(state: BubbleShooterState): BubbleShooterState {
  let seed = state.seed;
  const row = Array.from({ length: state.config.columns }, (_, column) => {
    if (column >= columnsInRow(state.config, 0)) return 0;
    const next = nextRandom(seed);
    seed = next.seed;
    return Math.floor(next.value * state.config.colors) + 1;
  });

  // Shifting by one flips every row's parity, so the board is rebuilt rather
  // than simply unshifted: a cell that was on a wide row is now on a narrow one.
  const grid = [row, ...state.grid.slice(0, -1)].map((cells, index) =>
    cells.map((value, column) => (column < columnsInRow(state.config, index) ? value : 0)),
  );

  const next: BubbleShooterState = { ...state, grid, seed, shotsSincePop: 0, events: [...state.events, "row"] };
  return lowestOccupiedRow(next) >= state.config.rows - 1
    ? { ...next, status: "over", events: [...next.events, "over"] }
    : next;
}

export function fire(state: BubbleShooterState): BubbleShooterState {
  if (state.status !== "running") return state;

  const { cell } = simulateShot(state);
  if (!cell) return { ...state, events: ["fire"] };

  const grid = state.grid.map((row) => [...row]);
  grid[cell.row][cell.column] = state.loaded;
  let next: BubbleShooterState = { ...state, grid, events: ["fire", "land"] };

  const cluster = matchingCluster(next, cell);
  let popped = 0;
  if (cluster.length >= 3) {
    for (const item of cluster) grid[item.row][item.column] = 0;
    popped = cluster.length;
    next = { ...next, grid, events: [...next.events, "pop"] };

    const floating = floatingCells(next);
    if (floating.length) {
      for (const item of floating) grid[item.row][item.column] = 0;
      // Bubbles you bring down by cutting their support are worth double: it is
      // the shot worth planning for.
      popped += floating.length;
      next = { ...next, grid, events: [...next.events, "drop"] };
      next = { ...next, score: next.score + floating.length * 20 };
    }
  }

  const { value, seed } = nextRandom(next.seed);
  next = {
    ...next,
    seed,
    loaded: next.queued,
    queued: (Math.floor(value * next.config.colors) + 1) as BubbleColor,
    score: next.score + cluster.length * (cluster.length >= 3 ? 10 : 0),
    poppedTotal: next.poppedTotal + popped,
    shotsSincePop: popped ? 0 : next.shotsSincePop + 1,
  };

  if (!remainingBubbles(next)) return { ...next, status: "won", events: [...next.events, "won"] };
  if (next.shotsSincePop >= next.config.shotsPerRow) next = pushRow(next);
  if (lowestOccupiedRow(next) >= next.config.rows - 1) {
    return { ...next, status: "over", events: [...next.events, "over"] };
  }
  return next;
}

const COLOR_NAMES = ["", "red", "amber", "green", "blue", "violet"];
export const colorName = (colour: number) => COLOR_NAMES[colour] ?? "unknown";

export function describeBubbleBoard(state: BubbleShooterState): string {
  if (state.status === "won") return `Board cleared with ${state.score} points.`;
  if (state.status === "over") return `Game over with ${state.score} points. ${remainingBubbles(state)} bubbles left.`;

  const shot = simulateShot(state);
  const parts = [
    `Score ${state.score}. ${remainingBubbles(state)} bubbles left.`,
    `Holding ${colorName(state.loaded)}, next ${colorName(state.queued)}.`,
    `Aiming ${state.angle === 0 ? "straight up" : `${Math.abs(state.angle)} degrees ${state.angle < 0 ? "left" : "right"}`}.`,
  ];

  if (!shot.cell) parts.push("This shot has nowhere to land.");
  else {
    const landing = state.grid[shot.cell.row][shot.cell.column];
    void landing;
    const preview: BubbleShooterState = {
      ...state,
      grid: state.grid.map((row, index) =>
        index === shot.cell!.row ? row.map((value, column) => (column === shot.cell!.column ? state.loaded : value)) : row,
      ),
    };
    const cluster = matchingCluster(preview, shot.cell);
    parts.push(`It lands on row ${shot.cell.row + 1}, column ${shot.cell.column + 1}${shot.bounces ? `, after ${shot.bounces} wall bounce${shot.bounces > 1 ? "s" : ""}` : ""}.`);
    parts.push(cluster.length >= 3 ? `That pops ${cluster.length} bubbles.` : `That joins ${cluster.length - 1} of the same colour: not enough to pop.`);
  }

  parts.push(`${state.config.shotsPerRow - state.shotsSincePop} shots before a new row drops in.`);
  return parts.join(" ");
}
