export type Difficulty = "easy" | "medium" | "hard";
export type Grid = number[];

/** Number of clues left on the board for each difficulty. */
const GIVENS: Record<Difficulty, number> = { easy: 42, medium: 34, hard: 27 };

const ROWS = Array.from({ length: 9 }, (_, row) =>
  Array.from({ length: 9 }, (_, col) => row * 9 + col),
);
const COLS = Array.from({ length: 9 }, (_, col) =>
  Array.from({ length: 9 }, (_, row) => row * 9 + col),
);
const BOXES = Array.from({ length: 9 }, (_, box) => {
  const top = Math.floor(box / 3) * 3;
  const left = (box % 3) * 3;
  return Array.from({ length: 9 }, (_, cell) =>
    (top + Math.floor(cell / 3)) * 9 + left + (cell % 3),
  );
});

export function rowOf(index: number) { return Math.floor(index / 9); }
export function colOf(index: number) { return index % 9; }
export function boxOf(index: number) { return Math.floor(rowOf(index) / 3) * 3 + Math.floor(colOf(index) / 3); }

/** Peers are the 20 cells that may not repeat a value with `index`. */
function peersOf(index: number): number[] {
  const peers = new Set<number>([
    ...ROWS[rowOf(index)],
    ...COLS[colOf(index)],
    ...BOXES[boxOf(index)],
  ]);
  peers.delete(index);
  return [...peers];
}

const PEERS = Array.from({ length: 81 }, (_, index) => peersOf(index));

export function canPlace(grid: Grid, index: number, value: number): boolean {
  return !PEERS[index].some((peer) => grid[peer] === value);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Fills an empty grid with a random valid solution. */
export function generateSolution(): Grid {
  const grid: Grid = new Array(81).fill(0);
  const fill = (index: number): boolean => {
    if (index === 81) return true;
    for (const value of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (!canPlace(grid, index, value)) continue;
      grid[index] = value;
      if (fill(index + 1)) return true;
      grid[index] = 0;
    }
    return false;
  };
  fill(0);
  return grid;
}

/**
 * Counts solutions, stopping as soon as `limit` is reached. Digging only keeps a
 * removal when the count stays at exactly 1, which guarantees a unique puzzle.
 */
export function countSolutions(grid: Grid, limit = 2): number {
  const working = [...grid];
  let found = 0;

  const search = (): void => {
    if (found >= limit) return;
    let target = -1;
    let candidates: number[] = [];
    for (let index = 0; index < 81; index += 1) {
      if (working[index] !== 0) continue;
      const options: number[] = [];
      for (let value = 1; value <= 9; value += 1) {
        if (canPlace(working, index, value)) options.push(value);
      }
      if (target === -1 || options.length < candidates.length) {
        target = index;
        candidates = options;
      }
      // A cell with a single candidate is the best possible branch.
      if (options.length <= 1) break;
    }
    if (target === -1) {
      found += 1;
      return;
    }
    for (const value of candidates) {
      working[target] = value;
      search();
      working[target] = 0;
      if (found >= limit) return;
    }
  };

  search();
  return found;
}

export function solve(grid: Grid): Grid | null {
  const working = [...grid];
  const search = (): boolean => {
    let target = -1;
    for (let index = 0; index < 81; index += 1) {
      if (working[index] === 0) { target = index; break; }
    }
    if (target === -1) return true;
    for (let value = 1; value <= 9; value += 1) {
      if (!canPlace(working, target, value)) continue;
      working[target] = value;
      if (search()) return true;
      working[target] = 0;
    }
    return false;
  };
  return search() ? working : null;
}

export interface Puzzle {
  puzzle: Grid;
  solution: Grid;
  givens: boolean[];
}

export function generatePuzzle(difficulty: Difficulty): Puzzle {
  const solution = generateSolution();
  const puzzle = [...solution];
  const target = GIVENS[difficulty];
  let remaining = 81;

  for (const index of shuffle(Array.from({ length: 81 }, (_, i) => i))) {
    if (remaining <= target) break;
    const backup = puzzle[index];
    puzzle[index] = 0;
    if (countSolutions(puzzle) === 1) {
      remaining -= 1;
    } else {
      puzzle[index] = backup;
    }
  }

  return { puzzle, solution, givens: puzzle.map((value) => value !== 0) };
}

/** Indexes whose current value clashes with a peer — used to paint errors. */
export function conflictingCells(grid: Grid): Set<number> {
  const conflicts = new Set<number>();
  for (let index = 0; index < 81; index += 1) {
    const value = grid[index];
    if (value === 0) continue;
    if (PEERS[index].some((peer) => grid[peer] === value)) {
      conflicts.add(index);
    }
  }
  return conflicts;
}

export function isSolved(grid: Grid): boolean {
  return grid.every((value) => value !== 0) && conflictingCells(grid).size === 0;
}

/** Reveals one correct cell, preferring the cells the player already touched. */
export function hintCell(grid: Grid, solution: Grid): number | null {
  const empty = grid
    .map((value, index) => ({ value, index }))
    .filter((cell) => cell.value !== solution[cell.index]);
  if (empty.length === 0) return null;
  return empty[Math.floor(Math.random() * empty.length)].index;
}
