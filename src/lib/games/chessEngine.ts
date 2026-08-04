export type Color = "w" | "b";
export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";

export interface Piece { color: Color; type: PieceType; }
export type Square = Piece | null;
export type Board = Square[];

export interface CastlingRights { wk: boolean; wq: boolean; bk: boolean; bq: boolean; }

export interface Position {
  board: Board;
  turn: Color;
  castling: CastlingRights;
  /** Square a pawn may capture onto this turn, or null. */
  epTarget: number | null;
  halfmove: number;
  fullmove: number;
}

export interface Move {
  from: number;
  to: number;
  promotion?: PieceType;
  captured?: Piece;
  castle?: "k" | "q";
  enPassant?: boolean;
}

/** Index 0 is a8 and index 63 is h1, so white advances toward lower indexes. */
export const fileOf = (index: number) => index % 8;
export const rankOf = (index: number) => Math.floor(index / 8);
export const squareName = (index: number) => `${"abcdefgh"[fileOf(index)]}${8 - rankOf(index)}`;

export const PIECE_GLYPH: Record<Color, Record<PieceType, string>> = {
  w: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔" },
  b: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" },
};

const PIECE_NAME_EN: Record<PieceType, string> = {
  p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king",
};
const PIECE_NAME_AR: Record<PieceType, string> = {
  p: "بيدق", n: "حصان", b: "فيل", r: "رخ", q: "وزير", k: "ملك",
};

export function pieceName(piece: Piece, ar: boolean): string {
  const color = ar ? (piece.color === "w" ? "أبيض" : "أسود") : piece.color === "w" ? "white" : "black";
  return ar
    ? `${PIECE_NAME_AR[piece.type]} ${color}`
    : `${color} ${PIECE_NAME_EN[piece.type]}`;
}

const BACK_RANK: PieceType[] = ["r", "n", "b", "q", "k", "b", "n", "r"];

export function initialPosition(): Position {
  const board: Board = new Array(64).fill(null);
  BACK_RANK.forEach((type, file) => {
    board[file] = { color: "b", type };
    board[56 + file] = { color: "w", type };
    board[8 + file] = { color: "b", type: "p" };
    board[48 + file] = { color: "w", type: "p" };
  });
  return {
    board,
    turn: "w",
    castling: { wk: true, wq: true, bk: true, bq: true },
    epTarget: null,
    halfmove: 0,
    fullmove: 1,
  };
}

const KNIGHT_STEPS: [number, number][] = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const KING_STEPS: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const BISHOP_DIRS: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ROOK_DIRS: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];

function at(file: number, rank: number): number | null {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return rank * 8 + file;
}

/** Moves that ignore whether the mover's own king would be left in check. */
function pseudoMoves(position: Position, index: number): Move[] {
  const piece = position.board[index];
  if (!piece) return [];
  const { board } = position;
  const moves: Move[] = [];
  const file = fileOf(index);
  const rank = rankOf(index);

  const pushTarget = (target: number | null) => {
    if (target === null) return false;
    const occupant = board[target];
    if (!occupant) { moves.push({ from: index, to: target }); return true; }
    if (occupant.color !== piece.color) moves.push({ from: index, to: target, captured: occupant });
    return false;
  };

  const slide = (dirs: [number, number][]) => {
    for (const [df, dr] of dirs) {
      for (let step = 1; step < 8; step += 1) {
        if (!pushTarget(at(file + df * step, rank + dr * step))) break;
      }
    }
  };

  switch (piece.type) {
    case "p": {
      const dir = piece.color === "w" ? -1 : 1;
      const startRank = piece.color === "w" ? 6 : 1;
      const promoteRank = piece.color === "w" ? 0 : 7;
      const one = at(file, rank + dir);

      if (one !== null && !board[one]) {
        if (rankOf(one) === promoteRank) {
          (["q", "r", "b", "n"] as PieceType[]).forEach((promotion) => moves.push({ from: index, to: one, promotion }));
        } else {
          moves.push({ from: index, to: one });
          const two = at(file, rank + dir * 2);
          if (rank === startRank && two !== null && !board[two]) moves.push({ from: index, to: two });
        }
      }

      for (const df of [-1, 1]) {
        const target = at(file + df, rank + dir);
        if (target === null) continue;
        const occupant = board[target];
        if (occupant && occupant.color !== piece.color) {
          if (rankOf(target) === promoteRank) {
            (["q", "r", "b", "n"] as PieceType[]).forEach((promotion) =>
              moves.push({ from: index, to: target, promotion, captured: occupant }));
          } else {
            moves.push({ from: index, to: target, captured: occupant });
          }
        } else if (!occupant && target === position.epTarget) {
          const capturedIndex = at(file + df, rank) as number;
          moves.push({ from: index, to: target, enPassant: true, captured: board[capturedIndex] as Piece });
        }
      }
      break;
    }
    case "n":
      KNIGHT_STEPS.forEach(([df, dr]) => pushTarget(at(file + df, rank + dr)));
      break;
    case "b": slide(BISHOP_DIRS); break;
    case "r": slide(ROOK_DIRS); break;
    case "q": slide([...BISHOP_DIRS, ...ROOK_DIRS]); break;
    case "k":
      KING_STEPS.forEach(([df, dr]) => pushTarget(at(file + df, rank + dr)));
      break;
  }

  return moves;
}

export function isSquareAttacked(board: Board, index: number, by: Color): boolean {
  const file = fileOf(index);
  const rank = rankOf(index);

  for (const [df, dr] of KNIGHT_STEPS) {
    const target = at(file + df, rank + dr);
    const piece = target === null ? null : board[target];
    if (piece && piece.color === by && piece.type === "n") return true;
  }

  for (const [df, dr] of KING_STEPS) {
    const target = at(file + df, rank + dr);
    const piece = target === null ? null : board[target];
    if (piece && piece.color === by && piece.type === "k") return true;
  }

  // Pawns attack toward the defender, so step back along the attacker's direction.
  const pawnRank = rank + (by === "w" ? 1 : -1);
  for (const df of [-1, 1]) {
    const target = at(file + df, pawnRank);
    const piece = target === null ? null : board[target];
    if (piece && piece.color === by && piece.type === "p") return true;
  }

  const rays: [[number, number][], PieceType][] = [[BISHOP_DIRS, "b"], [ROOK_DIRS, "r"]];
  for (const [dirs, sliderType] of rays) {
    for (const [df, dr] of dirs) {
      for (let step = 1; step < 8; step += 1) {
        const target = at(file + df * step, rank + dr * step);
        if (target === null) break;
        const piece = board[target];
        if (!piece) continue;
        if (piece.color === by && (piece.type === sliderType || piece.type === "q")) return true;
        break;
      }
    }
  }

  return false;
}

export function kingIndex(board: Board, color: Color): number {
  return board.findIndex((piece) => piece?.color === color && piece.type === "k");
}

export function isInCheck(position: Position, color: Color = position.turn): boolean {
  const king = kingIndex(position.board, color);
  return king !== -1 && isSquareAttacked(position.board, king, color === "w" ? "b" : "w");
}

export function makeMove(position: Position, move: Move): Position {
  const board = [...position.board];
  const piece = board[move.from] as Piece;
  const opponent: Color = piece.color === "w" ? "b" : "w";

  board[move.from] = null;
  board[move.to] = move.promotion ? { color: piece.color, type: move.promotion } : piece;

  if (move.enPassant) {
    board[at(fileOf(move.to), rankOf(move.from)) as number] = null;
  }

  if (move.castle) {
    const rank = rankOf(move.from);
    const [rookFrom, rookTo] = move.castle === "k" ? [7, 5] : [0, 3];
    board[rank * 8 + rookTo] = board[rank * 8 + rookFrom];
    board[rank * 8 + rookFrom] = null;
  }

  const castling = { ...position.castling };
  if (piece.type === "k") {
    if (piece.color === "w") { castling.wk = false; castling.wq = false; }
    else { castling.bk = false; castling.bq = false; }
  }
  // Losing a rook — by moving it or by having it captured — clears that side's right.
  const clearRook = (index: number) => {
    if (index === 63) castling.wk = false;
    if (index === 56) castling.wq = false;
    if (index === 7) castling.bk = false;
    if (index === 0) castling.bq = false;
  };
  clearRook(move.from);
  clearRook(move.to);

  const doubleStep = piece.type === "p" && Math.abs(rankOf(move.to) - rankOf(move.from)) === 2;

  return {
    board,
    turn: opponent,
    castling,
    epTarget: doubleStep ? at(fileOf(move.from), (rankOf(move.from) + rankOf(move.to)) / 2) : null,
    halfmove: piece.type === "p" || move.captured ? 0 : position.halfmove + 1,
    fullmove: position.fullmove + (piece.color === "b" ? 1 : 0),
  };
}

function castlingMoves(position: Position): Move[] {
  const color = position.turn;
  const opponent: Color = color === "w" ? "b" : "w";
  const rank = color === "w" ? 7 : 0;
  const king = rank * 8 + 4;
  if (position.board[king]?.type !== "k") return [];
  if (isSquareAttacked(position.board, king, opponent)) return [];

  const moves: Move[] = [];
  const rights = position.castling;

  const tryside = (side: "k" | "q", allowed: boolean, empties: number[], crossed: number[], rookFile: number) => {
    if (!allowed) return;
    const rook = position.board[rank * 8 + rookFile];
    if (!rook || rook.type !== "r" || rook.color !== color) return;
    if (empties.some((file) => position.board[rank * 8 + file])) return;
    if (crossed.some((file) => isSquareAttacked(position.board, rank * 8 + file, opponent))) return;
    moves.push({ from: king, to: rank * 8 + (side === "k" ? 6 : 2), castle: side });
  };

  tryside("k", color === "w" ? rights.wk : rights.bk, [5, 6], [5, 6], 7);
  tryside("q", color === "w" ? rights.wq : rights.bq, [1, 2, 3], [2, 3], 0);
  return moves;
}

export function legalMoves(position: Position, from?: number): Move[] {
  const candidates: Move[] = [];
  for (let index = 0; index < 64; index += 1) {
    if (from !== undefined && index !== from) continue;
    const piece = position.board[index];
    if (piece?.color === position.turn) candidates.push(...pseudoMoves(position, index));
  }
  if (from === undefined || position.board[from]?.type === "k") {
    candidates.push(...castlingMoves(position).filter((move) => from === undefined || move.from === from));
  }

  return candidates.filter((move) => {
    const after = makeMove(position, move);
    return !isInCheck(after, position.turn);
  });
}

export type Result = "playing" | "checkmate" | "stalemate" | "draw";

export function gameResult(position: Position): Result {
  if (legalMoves(position).length === 0) return isInCheck(position) ? "checkmate" : "stalemate";
  if (position.halfmove >= 100) return "draw";

  const pieces = position.board.filter(Boolean) as Piece[];
  const heavy = pieces.filter((piece) => piece.type !== "k" && piece.type !== "n" && piece.type !== "b");
  if (heavy.length === 0 && pieces.length <= 3) return "draw";
  return "playing";
}

const VALUES: Record<PieceType, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

/** Piece-square tables laid out rank 8 → rank 1 from white's point of view. */
const PST: Record<PieceType, number[]> = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20,
  ],
};

/** Score from white's perspective, in centipawns. */
export function evaluate(position: Position): number {
  let score = 0;
  for (let index = 0; index < 64; index += 1) {
    const piece = position.board[index];
    if (!piece) continue;
    // XOR 56 mirrors the rank so black reads the same table from its own side.
    const table = PST[piece.type][piece.color === "w" ? index : index ^ 56];
    const value = VALUES[piece.type] + table;
    score += piece.color === "w" ? value : -value;
  }
  return score;
}

function orderMoves(moves: Move[]): Move[] {
  return [...moves].sort((a, b) => {
    const gain = (move: Move) => (move.captured ? VALUES[move.captured.type] - VALUES[(move.promotion ?? "p")] : 0);
    return gain(b) - gain(a);
  });
}

function search(position: Position, depth: number, alpha: number, beta: number): number {
  const moves = legalMoves(position);
  if (moves.length === 0) {
    // Prefer the fastest mate by biasing the score with the remaining depth.
    if (isInCheck(position)) return position.turn === "w" ? -100000 - depth : 100000 + depth;
    return 0;
  }
  if (depth === 0) return evaluate(position);

  let a = alpha;
  let b = beta;

  if (position.turn === "w") {
    let best = -Infinity;
    for (const move of orderMoves(moves)) {
      best = Math.max(best, search(makeMove(position, move), depth - 1, a, b));
      a = Math.max(a, best);
      if (b <= a) break;
    }
    return best;
  }

  let best = Infinity;
  for (const move of orderMoves(moves)) {
    best = Math.min(best, search(makeMove(position, move), depth - 1, a, b));
    b = Math.min(b, best);
    if (b <= a) break;
  }
  return best;
}

export type Level = "easy" | "medium" | "hard";
const DEPTH: Record<Level, number> = { easy: 1, medium: 2, hard: 3 };

export function bestMove(position: Position, level: Level = "medium"): Move | null {
  const moves = orderMoves(legalMoves(position));
  if (moves.length === 0) return null;

  // Easy plays a random legal move often enough to stay beatable for beginners.
  if (level === "easy" && Math.random() < 0.35) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const maximising = position.turn === "w";
  let best = moves[0];
  let bestScore = maximising ? -Infinity : Infinity;

  for (const move of moves) {
    // A small jitter keeps repeated games from following identical lines.
    const score = search(makeMove(position, move), DEPTH[level] - 1, -Infinity, Infinity)
      + (Math.random() - 0.5) * 8;
    if (maximising ? score > bestScore : score < bestScore) {
      bestScore = score;
      best = move;
    }
  }

  return best;
}

export function describeMove(position: Position, move: Move, ar: boolean): string {
  const piece = position.board[move.from];
  if (!piece) return `${squareName(move.from)}→${squareName(move.to)}`;
  if (move.castle) return move.castle === "k" ? (ar ? "تبييت صغير" : "castles kingside") : (ar ? "تبييت كبير" : "castles queenside");
  const action = move.captured ? (ar ? "يأكل" : "takes") : "→";
  return `${PIECE_GLYPH[piece.color][piece.type]} ${squareName(move.from)} ${action} ${squareName(move.to)}`;
}
