export type Level = "easy" | "medium" | "hard";

export interface Cell {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  /** Number of mines in the 8 surrounding cells. */
  adjacent: number;
}

export interface BoardConfig { rows: number; cols: number; mines: number; }

export const LEVELS: Record<Level, BoardConfig> = {
  easy: { rows: 9, cols: 9, mines: 10 },
  medium: { rows: 12, cols: 12, mines: 25 },
  hard: { rows: 14, cols: 14, mines: 45 },
};

export type Board = Cell[][];

export function createEmptyBoard({ rows, cols }: BoardConfig): Board {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ mine: false, revealed: false, flagged: false, adjacent: 0 })),
  );
}

function neighbours(board: Board, row: number, col: number): [number, number][] {
  const cells: [number, number][] = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < board.length && c >= 0 && c < board[0].length) cells.push([r, c]);
    }
  }
  return cells;
}

/**
 * Mines are placed after the first click so the opening move is always safe —
 * the clicked cell and its neighbours are excluded from the mine pool.
 */
export function placeMines(board: Board, config: BoardConfig, safeRow: number, safeCol: number): Board {
  const next = board.map((row) => row.map((cell) => ({ ...cell })));
  const forbidden = new Set<string>([`${safeRow},${safeCol}`]);
  neighbours(next, safeRow, safeCol).forEach(([r, c]) => forbidden.add(`${r},${c}`));

  const pool: [number, number][] = [];
  for (let row = 0; row < config.rows; row += 1) {
    for (let col = 0; col < config.cols; col += 1) {
      if (!forbidden.has(`${row},${col}`)) pool.push([row, col]);
    }
  }

  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  pool.slice(0, Math.min(config.mines, pool.length)).forEach(([row, col]) => {
    next[row][col].mine = true;
  });

  for (let row = 0; row < config.rows; row += 1) {
    for (let col = 0; col < config.cols; col += 1) {
      next[row][col].adjacent = neighbours(next, row, col)
        .filter(([r, c]) => next[r][c].mine).length;
    }
  }

  return next;
}

/** Reveals a cell, flood-filling outward while neighbouring mine counts are zero. */
export function reveal(board: Board, row: number, col: number): Board {
  const next = board.map((line) => line.map((cell) => ({ ...cell })));
  const stack: [number, number][] = [[row, col]];

  while (stack.length > 0) {
    const [r, c] = stack.pop() as [number, number];
    const cell = next[r][c];
    if (cell.revealed || cell.flagged) continue;
    cell.revealed = true;
    if (cell.adjacent === 0 && !cell.mine) {
      neighbours(next, r, c).forEach(([nr, nc]) => {
        if (!next[nr][nc].revealed) stack.push([nr, nc]);
      });
    }
  }

  return next;
}

export function toggleFlag(board: Board, row: number, col: number): Board {
  if (board[row][col].revealed) return board;
  const next = board.map((line) => line.map((cell) => ({ ...cell })));
  next[row][col].flagged = !next[row][col].flagged;
  return next;
}

export function revealAllMines(board: Board): Board {
  return board.map((line) => line.map((cell) => (cell.mine ? { ...cell, revealed: true } : cell)));
}

/** The board is won when every non-mine cell has been revealed. */
export function isCleared(board: Board): boolean {
  return board.every((line) => line.every((cell) => cell.mine || cell.revealed));
}

export function flagCount(board: Board): number {
  return board.reduce((total, line) => total + line.filter((cell) => cell.flagged).length, 0);
}

const NUMBER_COLORS = [
  "", "text-blue-500", "text-emerald-600", "text-rose-500", "text-indigo-600",
  "text-amber-600", "text-cyan-600", "text-fuchsia-600", "text-slate-500",
];

export function numberClass(adjacent: number): string {
  return NUMBER_COLORS[adjacent] ?? "";
}
