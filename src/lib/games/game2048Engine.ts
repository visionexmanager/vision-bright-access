export type Direction = "up" | "down" | "left" | "right";
export type Board = number[];

export const SIZE = 4;
export const WIN_TILE = 2048;

export interface MoveResult {
  board: Board;
  gained: number;
  moved: boolean;
}

function emptyCells(board: Board): number[] {
  const cells: number[] = [];
  board.forEach((value, index) => { if (value === 0) cells.push(index); });
  return cells;
}

/** Adds a 2 (90%) or 4 (10%) to a random empty cell. Returns a new board. */
export function spawnTile(board: Board): Board {
  const cells = emptyCells(board);
  if (cells.length === 0) return board;
  const next = [...board];
  const target = cells[Math.floor(Math.random() * cells.length)];
  next[target] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

export function createBoard(): Board {
  return spawnTile(spawnTile(new Array(SIZE * SIZE).fill(0)));
}

/** Collapses one line toward index 0, merging each pair at most once. */
function collapse(line: number[]): { line: number[]; gained: number } {
  const filled = line.filter((value) => value !== 0);
  const merged: number[] = [];
  let gained = 0;

  for (let i = 0; i < filled.length; i += 1) {
    if (filled[i] === filled[i + 1]) {
      const value = filled[i] * 2;
      merged.push(value);
      gained += value;
      i += 1;
    } else {
      merged.push(filled[i]);
    }
  }

  while (merged.length < SIZE) merged.push(0);
  return { line: merged, gained };
}

/** Indexes of one row/column, ordered so that collapsing toward 0 matches `direction`. */
function lineIndexes(direction: Direction, line: number): number[] {
  const indexes = Array.from({ length: SIZE }, (_, step) => {
    switch (direction) {
      case "left":
      case "right":
        return line * SIZE + step;
      default:
        return step * SIZE + line;
    }
  });
  return direction === "right" || direction === "down" ? indexes.reverse() : indexes;
}

export function move(board: Board, direction: Direction): MoveResult {
  const next = [...board];
  let gained = 0;
  let moved = false;

  for (let line = 0; line < SIZE; line += 1) {
    const indexes = lineIndexes(direction, line);
    const values = indexes.map((index) => board[index]);
    const collapsed = collapse(values);
    gained += collapsed.gained;
    indexes.forEach((index, position) => {
      if (next[index] !== collapsed.line[position]) moved = true;
      next[index] = collapsed.line[position];
    });
  }

  return { board: next, gained, moved };
}

export function canMove(board: Board): boolean {
  if (board.some((value) => value === 0)) return true;
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const value = board[row * SIZE + col];
      if (col + 1 < SIZE && board[row * SIZE + col + 1] === value) return true;
      if (row + 1 < SIZE && board[(row + 1) * SIZE + col] === value) return true;
    }
  }
  return false;
}

export function hasWon(board: Board): boolean {
  return board.some((value) => value >= WIN_TILE);
}

/** Tailwind classes per tile value, so the grid stays readable in both themes. */
export function tileClass(value: number): string {
  switch (value) {
    case 0: return "bg-muted/40 text-transparent";
    case 2: return "bg-slate-200 text-slate-900";
    case 4: return "bg-amber-100 text-amber-900";
    case 8: return "bg-orange-300 text-orange-950";
    case 16: return "bg-orange-400 text-white";
    case 32: return "bg-rose-400 text-white";
    case 64: return "bg-rose-500 text-white";
    case 128: return "bg-amber-400 text-amber-950";
    case 256: return "bg-amber-500 text-white";
    case 512: return "bg-emerald-500 text-white";
    case 1024: return "bg-cyan-500 text-white";
    default: return "bg-violet-600 text-white";
  }
}
