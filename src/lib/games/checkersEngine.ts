export type Side = "w" | "b";
export interface Piece { side: Side; king: boolean; }
export type Board = (Piece | null)[];

export interface Move {
  /** Squares visited, starting at the origin and ending at the destination. */
  path: number[];
  captures: number[];
  promotes: boolean;
}

export const rowOf = (index: number) => Math.floor(index / 8);
export const colOf = (index: number) => index % 8;
/** Only dark squares are playable in draughts. */
export const isDark = (index: number) => (rowOf(index) + colOf(index)) % 2 === 1;

function at(row: number, col: number): number | null {
  if (row < 0 || row > 7 || col < 0 || col > 7) return null;
  return row * 8 + col;
}

const DIAGONALS: [number, number][] = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

/** White advances toward row 0, black toward row 7; kings use every diagonal. */
function directionsFor(piece: Piece): [number, number][] {
  if (piece.king) return DIAGONALS;
  return piece.side === "w"
    ? [[-1, -1], [-1, 1]]
    : [[1, -1], [1, 1]];
}

const LAST_ROW: Record<Side, number> = { w: 0, b: 7 };

export function createBoard(): Board {
  const board: Board = new Array(64).fill(null);
  for (let index = 0; index < 64; index += 1) {
    if (!isDark(index)) continue;
    const row = rowOf(index);
    if (row <= 2) board[index] = { side: "b", king: false };
    if (row >= 5) board[index] = { side: "w", king: false };
  }
  return board;
}

function simpleMoves(board: Board, from: number, piece: Piece): Move[] {
  const moves: Move[] = [];
  for (const [dr, dc] of directionsFor(piece)) {
    const target = at(rowOf(from) + dr, colOf(from) + dc);
    if (target === null || board[target]) continue;
    moves.push({
      path: [from, target],
      captures: [],
      promotes: !piece.king && rowOf(target) === LAST_ROW[piece.side],
    });
  }
  return moves;
}

/**
 * Depth-first walk over chained jumps. Captured pieces stay on the board so they
 * still block landing squares, but each may only be jumped once.
 */
function jumpMoves(board: Board, from: number, piece: Piece): Move[] {
  const results: Move[] = [];

  const walk = (current: number, captured: number[], path: number[]) => {
    let extended = false;

    for (const [dr, dc] of directionsFor(piece)) {
      const middle = at(rowOf(current) + dr, colOf(current) + dc);
      const landing = at(rowOf(current) + dr * 2, colOf(current) + dc * 2);
      if (middle === null || landing === null) continue;

      const victim = board[middle];
      if (!victim || victim.side === piece.side) continue;
      if (captured.includes(middle)) continue;
      // The origin square is vacant once the piece lifts off, so it may be reused.
      if (board[landing] && landing !== path[0]) continue;

      const promotes = !piece.king && rowOf(landing) === LAST_ROW[piece.side];
      const nextCaptured = [...captured, middle];
      const nextPath = [...path, landing];

      // Crowning ends the move, so a freshly promoted man cannot keep jumping.
      if (promotes) {
        results.push({ path: nextPath, captures: nextCaptured, promotes: true });
      } else {
        walk(landing, nextCaptured, nextPath);
      }
      extended = true;
    }

    if (!extended && captured.length > 0) {
      results.push({ path, captures: captured, promotes: false });
    }
  };

  walk(from, [], [from]);
  return results;
}

/** Captures are compulsory, so jumps hide every quiet move when one exists. */
export function legalMoves(board: Board, side: Side, from?: number): Move[] {
  const jumps: Move[] = [];
  const quiet: Move[] = [];

  for (let index = 0; index < 64; index += 1) {
    const piece = board[index];
    if (!piece || piece.side !== side) continue;
    if (from !== undefined && index !== from) continue;
    jumps.push(...jumpMoves(board, index, piece));
    quiet.push(...simpleMoves(board, index, piece));
  }

  // When `from` is given the compulsory rule still applies board-wide.
  if (from !== undefined) {
    const anyJump = legalMoves(board, side).some((move) => move.captures.length > 0);
    return anyJump ? jumps : quiet;
  }
  return jumps.length > 0 ? jumps : quiet;
}

export function applyMove(board: Board, move: Move): Board {
  const next = [...board];
  const from = move.path[0];
  const to = move.path[move.path.length - 1];
  const piece = next[from] as Piece;

  next[from] = null;
  move.captures.forEach((index) => { next[index] = null; });
  next[to] = { side: piece.side, king: piece.king || move.promotes };
  return next;
}

export function countPieces(board: Board, side: Side): number {
  return board.filter((piece) => piece?.side === side).length;
}

export type Result = "playing" | "w" | "b";

export function result(board: Board, turn: Side): Result {
  if (countPieces(board, "w") === 0) return "b";
  if (countPieces(board, "b") === 0) return "w";
  // A side with no legal move loses in draughts.
  if (legalMoves(board, turn).length === 0) return turn === "w" ? "b" : "w";
  return "playing";
}

const MAN = 100;
const KING = 175;

/** Positive scores favour white. */
export function evaluate(board: Board): number {
  let score = 0;
  board.forEach((piece, index) => {
    if (!piece) return;
    let value = piece.king ? KING : MAN;
    if (!piece.king) {
      // Reward men for pushing toward promotion.
      const advance = piece.side === "w" ? 7 - rowOf(index) : rowOf(index);
      value += advance * 4;
    }
    // Back-rank and edge squares are harder to attack.
    if (colOf(index) === 0 || colOf(index) === 7) value += 6;
    score += piece.side === "w" ? value : -value;
  });
  return score;
}

function orderMoves(moves: Move[]): Move[] {
  return [...moves].sort((a, b) => b.captures.length - a.captures.length);
}

function search(board: Board, turn: Side, depth: number, alpha: number, beta: number): number {
  const outcome = result(board, turn);
  if (outcome !== "playing") return outcome === "w" ? 100000 + depth : -100000 - depth;
  if (depth === 0) return evaluate(board);

  const moves = orderMoves(legalMoves(board, turn));
  let a = alpha;
  let b = beta;

  if (turn === "w") {
    let best = -Infinity;
    for (const move of moves) {
      best = Math.max(best, search(applyMove(board, move), "b", depth - 1, a, b));
      a = Math.max(a, best);
      if (b <= a) break;
    }
    return best;
  }

  let best = Infinity;
  for (const move of moves) {
    best = Math.min(best, search(applyMove(board, move), "w", depth - 1, a, b));
    b = Math.min(b, best);
    if (b <= a) break;
  }
  return best;
}

export type Level = "easy" | "medium" | "hard";
const DEPTH: Record<Level, number> = { easy: 2, medium: 4, hard: 6 };

export function bestMove(board: Board, side: Side, level: Level = "medium"): Move | null {
  const moves = orderMoves(legalMoves(board, side));
  if (moves.length === 0) return null;

  if (level === "easy" && Math.random() < 0.3) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const maximising = side === "w";
  let chosen = moves[0];
  let bestScore = maximising ? -Infinity : Infinity;

  for (const move of moves) {
    const score = search(applyMove(board, move), side === "w" ? "b" : "w", DEPTH[level] - 1, -Infinity, Infinity)
      + (Math.random() - 0.5) * 4;
    if (maximising ? score > bestScore : score < bestScore) {
      bestScore = score;
      chosen = move;
    }
  }
  return chosen;
}
