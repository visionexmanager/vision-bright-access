export type PlayerId = 0 | 1 | 2 | 3;

export const PLAYERS: PlayerId[] = [0, 1, 2, 3];
export const TOKENS = 4;
/** Relative positions: -1 in base, 0–50 on the shared track, 51–55 home column, 56 home. */
export const TRACK_STEPS = 51;
export const FINISH = 56;

/** Where each colour joins the shared 52-square loop. */
export const START: Record<PlayerId, number> = { 0: 0, 1: 13, 2: 26, 3: 39 };
/** Start squares plus the four star squares, where a token cannot be captured. */
const SAFE_SQUARES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

export type Cell = [row: number, col: number];

/** The 52 loop squares of a 15×15 cross board, clockwise from red's entry. */
function buildTrack(): Cell[] {
  const cells: Cell[] = [];
  const push = (row: number, col: number) => cells.push([row, col]);

  for (let col = 1; col <= 5; col += 1) push(6, col);
  for (let row = 5; row >= 0; row -= 1) push(row, 6);
  push(0, 7);
  for (let row = 0; row <= 5; row += 1) push(row, 8);
  for (let col = 9; col <= 14; col += 1) push(6, col);
  push(7, 14);
  for (let col = 14; col >= 9; col -= 1) push(8, col);
  for (let row = 9; row <= 14; row += 1) push(row, 8);
  push(14, 7);
  for (let row = 14; row >= 9; row -= 1) push(row, 6);
  for (let col = 5; col >= 0; col -= 1) push(8, col);
  push(7, 0);
  push(6, 0);

  return cells;
}

export const TRACK_CELLS = buildTrack();

export const HOME_CELLS: Record<PlayerId, Cell[]> = {
  0: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  1: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  2: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  3: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
};

export const BASE_CELLS: Record<PlayerId, Cell[]> = {
  0: [[1, 1], [1, 3], [3, 1], [3, 3]],
  1: [[1, 11], [1, 13], [3, 11], [3, 13]],
  2: [[11, 11], [11, 13], [13, 11], [13, 13]],
  3: [[11, 1], [11, 3], [13, 1], [13, 3]],
};

export const CENTER: Cell = [7, 7];

export const COLORS: Record<PlayerId, string> = {
  0: "#dc2626", 1: "#16a34a", 2: "#eab308", 3: "#2563eb",
};

export interface State {
  /** tokens[player][token] holds that token's relative position. */
  tokens: number[][];
  turn: PlayerId;
  die: number | null;
}

export function createGame(): State {
  return {
    tokens: PLAYERS.map(() => new Array(TOKENS).fill(-1)),
    turn: 0,
    die: null,
  };
}

export function rollDie(): number {
  return 1 + Math.floor(Math.random() * 6);
}

/** Square on the shared loop, or null when the token is in base or past the loop. */
export function globalSquare(player: PlayerId, pos: number): number | null {
  if (pos < 0 || pos > TRACK_STEPS - 1) return null;
  return (START[player] + pos) % 52;
}

/** The board cell a token occupies, for rendering. */
export function cellOf(player: PlayerId, pos: number, tokenIndex: number): Cell {
  if (pos === -1) return BASE_CELLS[player][tokenIndex];
  if (pos === FINISH) return CENTER;
  if (pos >= TRACK_STEPS) return HOME_CELLS[player][pos - TRACK_STEPS];
  return TRACK_CELLS[globalSquare(player, pos) as number];
}

/** Token indexes that can legally use `die` this turn. */
export function legalTokens(state: State, player: PlayerId, die: number): number[] {
  const moves: number[] = [];
  state.tokens[player].forEach((pos, index) => {
    if (pos === FINISH) return;
    // Only a six releases a token from base.
    if (pos === -1) {
      if (die === 6) moves.push(index);
      return;
    }
    // Entering home needs an exact roll; overshooting is not allowed.
    if (pos + die <= FINISH) moves.push(index);
  });
  return moves;
}

export interface MoveOutcome {
  state: State;
  captured: boolean;
  finished: boolean;
  /** A six, a capture, or bringing a token home all grant another roll. */
  extraTurn: boolean;
}

export function applyMove(state: State, player: PlayerId, tokenIndex: number, die: number): MoveOutcome {
  const tokens = state.tokens.map((row) => [...row]);
  const current = tokens[player][tokenIndex];
  const next = current === -1 ? 0 : current + die;
  tokens[player][tokenIndex] = next;

  let captured = false;
  const square = globalSquare(player, next);
  if (square !== null && !SAFE_SQUARES.has(square)) {
    for (const other of PLAYERS) {
      if (other === player) continue;
      tokens[other] = tokens[other].map((pos) => {
        if (globalSquare(other, pos) === square) {
          captured = true;
          return -1;
        }
        return pos;
      });
    }
  }

  const finished = next === FINISH;
  const extraTurn = die === 6 || captured || finished;

  return {
    state: { tokens, turn: player, die: null },
    captured,
    finished,
    extraTurn,
  };
}

export function nextPlayer(player: PlayerId): PlayerId {
  return ((player + 1) % 4) as PlayerId;
}

export function winner(state: State): PlayerId | null {
  return PLAYERS.find((player) => state.tokens[player].every((pos) => pos === FINISH)) ?? null;
}

export function homeCount(state: State, player: PlayerId): number {
  return state.tokens[player].filter((pos) => pos === FINISH).length;
}

/**
 * Bot choice, in priority order: capture, finish, leave base, then the token
 * furthest along so stragglers do not linger in danger.
 */
export function chooseToken(state: State, player: PlayerId, die: number): number | null {
  const options = legalTokens(state, player, die);
  if (options.length === 0) return null;

  const capturing = options.find((index) => applyMove(state, player, index, die).captured);
  if (capturing !== undefined) return capturing;

  const finishing = options.find((index) => state.tokens[player][index] + die === FINISH);
  if (finishing !== undefined) return finishing;

  const leaving = options.find((index) => state.tokens[player][index] === -1);
  if (leaving !== undefined) return leaving;

  return options.reduce((best, index) =>
    state.tokens[player][index] > state.tokens[player][best] ? index : best, options[0]);
}
