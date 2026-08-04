/**
 * Skybound Quest — a platform adventure played one discrete action at a time.
 *
 * A real-time jumping game cannot be played by a screen-reader user: the board
 * changes faster than it can be announced, and every input is a reflex test.
 * This keeps the platforming vocabulary — gravity, ledges, jump arcs, hazards,
 * collectibles — but resolves it in whole steps, so each action produces one
 * settled board that can be read out before the next one is chosen.
 *
 * Every rule below is deterministic. The same actions on the same level always
 * produce the same result, which is what makes the level solvable by reasoning
 * rather than by timing.
 */

export type Tile = "empty" | "solid" | "hazard" | "gem" | "exit";

export type Cell = { row: number; col: number };

/** Horizontal component of an action: step or jump, left, right, or in place. */
export type Direction = -1 | 0 | 1;

export type Action =
  | { kind: "step"; dx: -1 | 1 }
  | { kind: "jump"; dx: Direction };

export type Status = "playing" | "won" | "lost";

export type State = {
  readonly level: number;
  readonly grid: readonly Tile[][];
  readonly player: Cell;
  /** Keys of gems already collected, as `row,col`. */
  readonly collected: ReadonlySet<string>;
  readonly gemTotal: number;
  readonly moves: number;
  readonly status: Status;
  /** Cells the player passed through during the last action, in order. */
  readonly path: readonly Cell[];
};

/** How high a jump rises before horizontal travel. */
export const JUMP_RISE = 2;
/** How far a jump carries horizontally at the top of the arc. */
export const JUMP_REACH = 2;

const LEGEND: Record<string, Tile> = {
  ".": "empty",
  "#": "solid",
  "^": "hazard",
  "*": "gem",
  E: "exit",
};

/**
 * Level maps. `@` marks the start and is stored as an empty tile.
 * Each level is a rectangle; row 0 is the top of the sky.
 *
 * Reachable standing heights are a lattice, not a free choice: a jump rises
 * exactly {@link JUMP_RISE} rows, so from the floor at row 8 the player can
 * stand at rows 6, 4, 2, and 0 — and only where a platform occupies the row
 * directly beneath. Platform surfaces therefore sit on the odd rows, two apart,
 * and each is within {@link JUMP_REACH} columns of the one below it. Gems and
 * exits are placed on those standing rows. `skyboundEngine.test.ts` searches
 * every level for a winning line, so a map that breaks the lattice fails there
 * rather than stranding a player.
 */
export const LEVELS: readonly string[][] = [
  [
    "..............",
    "..............",
    "..............",
    "..............",
    ".......*......",
    ".......###....",
    "....*.........",
    "...###........",
    "@.*.....^^..E.",
    "##############",
  ],
  [
    "..............",
    "..............",
    ".........*....",
    "........###...",
    ".....*........",
    "....###.......",
    "..*...........",
    ".###..........",
    "@.....^^...E..",
    "##############",
  ],
  [
    "..............",
    "..............",
    "..*........*..",
    ".###......###.",
    "......*.......",
    ".....####.....",
    "..*...........",
    ".###..........",
    "@...^^...E....",
    "###.######.###",
  ],
];

const keyOf = (cell: Cell) => `${cell.row},${cell.col}`;

function parse(rows: readonly string[]): { grid: Tile[][]; start: Cell } {
  let start: Cell | undefined;
  const grid = rows.map((row, rowIndex) =>
    [...row].map((character, colIndex) => {
      if (character === "@") {
        start = { row: rowIndex, col: colIndex };
        return "empty" as Tile;
      }
      const tile = LEGEND[character];
      if (!tile) throw new Error(`Unknown level character: ${character}`);
      return tile;
    }),
  );
  if (!start) throw new Error("Level has no start position");
  return { grid, start };
}

export function gemCount(grid: readonly Tile[][]): number {
  return grid.reduce((total, row) => total + row.filter((tile) => tile === "gem").length, 0);
}

export function createGame(level = 0): State {
  const rows = LEVELS[level];
  if (!rows) throw new Error(`Unknown level: ${level}`);
  const { grid, start } = parse(rows);
  return {
    level,
    grid,
    player: start,
    collected: new Set<string>(),
    gemTotal: gemCount(grid),
    moves: 0,
    status: "playing",
    path: [start],
  };
}

export const rowCount = (state: State) => state.grid.length;
export const colCount = (state: State) => state.grid[0].length;

export function tileAt(state: State, row: number, col: number): Tile | "outside" {
  return state.grid[row]?.[col] ?? "outside";
}

/**
 * Solid tiles stop movement, and so do the map edges: the level is walled in,
 * so walking or jumping into the boundary is refused rather than fatal. The
 * floor is the one exception — falling out of the bottom is handled by
 * {@link drop}, which checks for it before consulting this.
 */
const isBlocking = (tile: Tile | "outside") => tile === "solid" || tile === "outside";

/** A gem already picked up behaves like empty space. */
export function visibleTile(state: State, row: number, col: number): Tile | "outside" {
  const tile = tileAt(state, row, col);
  if (tile === "gem" && state.collected.has(keyOf({ row, col }))) return "empty";
  return tile;
}

/** True when the player is resting on solid ground (or on the floor of the map). */
export function isGrounded(state: State): boolean {
  return isBlocking(tileAt(state, state.player.row + 1, state.player.col));
}

/**
 * Falls from `cell` until it lands on something solid, recording each cell
 * passed through. Falling out of the bottom of the map is a loss.
 */
function drop(grid: readonly Tile[][], cell: Cell): { cell: Cell; path: Cell[]; fell: boolean } {
  const path: Cell[] = [];
  let current = cell;
  for (;;) {
    const below = { row: current.row + 1, col: current.col };
    if (below.row >= grid.length) return { cell: current, path, fell: true };
    if (isBlocking(grid[below.row]?.[below.col] ?? "outside")) return { cell: current, path, fell: false };
    current = below;
    path.push(current);
  }
}

/**
 * Resolves one action into the cells the player travels through.
 *
 * A step moves one column then falls. A jump rises up to {@link JUMP_RISE}
 * rows, stopping early under a ceiling, travels up to {@link JUMP_REACH}
 * columns, stopping early against a wall, then falls. Every intermediate cell
 * counts for hazards and gems, so an arc that clips a spike is fatal even when
 * the landing square is safe.
 */
export function resolvePath(state: State, action: Action): Cell[] {
  const { grid } = state;
  const path: Cell[] = [];
  let current = state.player;

  const advance = (next: Cell) => {
    current = next;
    path.push(next);
  };

  if (action.kind === "step") {
    const target = { row: current.row, col: current.col + action.dx };
    if (isBlocking(grid[target.row]?.[target.col] ?? "outside")) return path;
    advance(target);
  } else {
    // Jumping is only possible from the ground, exactly as in a real platformer.
    if (!isGrounded(state)) return path;
    for (let rise = 0; rise < JUMP_RISE; rise += 1) {
      const above = { row: current.row - 1, col: current.col };
      if (above.row < 0 || isBlocking(grid[above.row]?.[above.col] ?? "outside")) break;
      advance(above);
    }
    if (action.dx !== 0) {
      for (let reach = 0; reach < JUMP_REACH; reach += 1) {
        const side = { row: current.row, col: current.col + action.dx };
        if (isBlocking(grid[side.row]?.[side.col] ?? "outside")) break;
        advance(side);
      }
    }
  }

  const landing = drop(grid, current);
  path.push(...landing.path);
  if (landing.fell) path.push({ row: grid.length, col: landing.cell.col });
  return path;
}

/**
 * Applies an action and returns the settled state. An action that cannot move
 * the player — walking into a wall, jumping in mid-air — returns the state
 * unchanged, so a blocked input never burns a move.
 */
export function applyAction(state: State, action: Action): State {
  if (state.status !== "playing") return state;

  const path = resolvePath(state, action);
  if (path.length === 0) return state;

  const collected = new Set(state.collected);
  let status: Status = "playing";
  let player = state.player;

  for (const cell of path) {
    if (cell.row >= state.grid.length) {
      status = "lost";
      player = { row: state.grid.length - 1, col: cell.col };
      break;
    }
    player = cell;
    const tile = tileAt(state, cell.row, cell.col);
    if (tile === "hazard") {
      status = "lost";
      break;
    }
    if (tile === "gem") collected.add(keyOf(cell));
    if (tile === "exit" && collected.size === state.gemTotal) {
      status = "won";
      break;
    }
  }

  return { ...state, player, collected, moves: state.moves + 1, status, path };
}

export function remainingGems(state: State): number {
  return state.gemTotal - state.collected.size;
}

/** True when the player is standing on the exit but still owes gems. */
export function atLockedExit(state: State): boolean {
  return (
    tileAt(state, state.player.row, state.player.col) === "exit" &&
    state.status === "playing" &&
    remainingGems(state) > 0
  );
}

/** Score for the economy gate: level progress, gems, and efficiency. */
export function score(state: State): number {
  if (state.status !== "won") return state.collected.size * 20;
  const efficiency = Math.max(0, 60 - state.moves) * 5;
  return 300 + state.level * 100 + state.gemTotal * 20 + efficiency;
}
