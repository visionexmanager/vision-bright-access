export type Disc = "r" | "y" | null;
export type Board = Disc[];

export const COLS = 7;
export const ROWS = 6;

/** Index 0 is the top-left cell; discs settle toward the highest row index. */
export const indexOf = (row: number, col: number) => row * COLS + col;

export function createBoard(): Board {
  return new Array(ROWS * COLS).fill(null);
}

/** Row a disc would land on in `col`, or -1 when the column is full. */
export function landingRow(board: Board, col: number): number {
  for (let row = ROWS - 1; row >= 0; row -= 1) {
    if (board[indexOf(row, col)] === null) return row;
  }
  return -1;
}

export function availableColumns(board: Board): number[] {
  return Array.from({ length: COLS }, (_, col) => col).filter((col) => landingRow(board, col) >= 0);
}

export function drop(board: Board, col: number, disc: Exclude<Disc, null>): Board {
  const row = landingRow(board, col);
  if (row < 0) return board;
  const next = [...board];
  next[indexOf(row, col)] = disc;
  return next;
}

const DIRECTIONS: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];

/** The four cells of a winning line, or null when there is no winner. */
export function winningLine(board: Board): number[] | null {
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const disc = board[indexOf(row, col)];
      if (!disc) continue;
      for (const [dr, dc] of DIRECTIONS) {
        const line = [indexOf(row, col)];
        for (let step = 1; step < 4; step += 1) {
          const r = row + dr * step;
          const c = col + dc * step;
          if (r < 0 || r >= ROWS || c < 0 || c >= COLS) break;
          if (board[indexOf(r, c)] !== disc) break;
          line.push(indexOf(r, c));
        }
        if (line.length === 4) return line;
      }
    }
  }
  return null;
}

export function isFull(board: Board): boolean {
  return board.every((cell) => cell !== null);
}

/** Counts how many of the four cells belong to `disc` with the rest empty. */
function scoreWindow(cells: Disc[], disc: Exclude<Disc, null>): number {
  const mine = cells.filter((cell) => cell === disc).length;
  const theirs = cells.filter((cell) => cell !== null && cell !== disc).length;
  if (mine > 0 && theirs > 0) return 0;
  if (mine === 3) return 50;
  if (mine === 2) return 10;
  if (mine === 1) return 1;
  if (theirs === 3) return -60;
  if (theirs === 2) return -12;
  return 0;
}

export function evaluate(board: Board, disc: Exclude<Disc, null>): number {
  let score = 0;
  // Central columns open more lines, so weight them directly.
  for (let row = 0; row < ROWS; row += 1) {
    if (board[indexOf(row, 3)] === disc) score += 6;
  }

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      for (const [dr, dc] of DIRECTIONS) {
        const endRow = row + dr * 3;
        const endCol = col + dc * 3;
        if (endRow < 0 || endRow >= ROWS || endCol < 0 || endCol >= COLS) continue;
        const cells = Array.from({ length: 4 }, (_, step) =>
          board[indexOf(row + dr * step, col + dc * step)]);
        score += scoreWindow(cells, disc);
      }
    }
  }
  return score;
}

const OTHER = (disc: Exclude<Disc, null>): Exclude<Disc, null> => (disc === "r" ? "y" : "r");

function search(
  board: Board, depth: number, alpha: number, beta: number,
  self: Exclude<Disc, null>, turn: Exclude<Disc, null>,
): number {
  const line = winningLine(board);
  if (line) {
    const winner = board[line[0]];
    // Deeper wins score lower so the engine prefers the quickest finish.
    return winner === self ? 100000 + depth : -100000 - depth;
  }
  if (depth === 0 || isFull(board)) return evaluate(board, self);

  const columns = availableColumns(board);
  let a = alpha;
  let b = beta;

  if (turn === self) {
    let best = -Infinity;
    for (const col of columns) {
      best = Math.max(best, search(drop(board, col, turn), depth - 1, a, b, self, OTHER(turn)));
      a = Math.max(a, best);
      if (b <= a) break;
    }
    return best;
  }

  let best = Infinity;
  for (const col of columns) {
    best = Math.min(best, search(drop(board, col, turn), depth - 1, a, b, self, OTHER(turn)));
    b = Math.min(b, best);
    if (b <= a) break;
  }
  return best;
}

export type Level = "easy" | "medium" | "hard";
const DEPTH: Record<Level, number> = { easy: 2, medium: 4, hard: 6 };

export function bestColumn(board: Board, disc: Exclude<Disc, null>, level: Level = "medium"): number | null {
  const columns = availableColumns(board);
  if (columns.length === 0) return null;

  if (level === "easy" && Math.random() < 0.3) {
    return columns[Math.floor(Math.random() * columns.length)];
  }

  // Centre-out ordering makes alpha-beta prune far more of the tree.
  const ordered = [...columns].sort((x, y) => Math.abs(3 - x) - Math.abs(3 - y));
  let bestScore = -Infinity;
  let chosen = ordered[0];

  for (const col of ordered) {
    const score = search(drop(board, col, disc), DEPTH[level] - 1, -Infinity, Infinity, disc, OTHER(disc));
    if (score > bestScore) { bestScore = score; chosen = col; }
  }
  return chosen;
}
