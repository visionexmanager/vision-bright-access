/**
 * Sudoku — puzzle generator, solver and rules.
 *
 * What it replaced shipped one hard-coded grid, so every player saw the same
 * puzzle every time, and a move was checked against a stored answer rather than
 * against the rules — entering a digit that was legal but not the one on file
 * was rejected as a conflict.
 *
 * This generates a fresh puzzle from a seed, removes clues only while the
 * solution stays unique, and judges a move by the rules of Sudoku.
 */

export type Difficulty = "easy" | "medium" | "hard";
export type Grid = number[][];

export interface SudokuPuzzle {
  puzzle: Grid;
  solution: Grid;
  /** True where the puzzle supplied the digit and the player may not change it. */
  given: boolean[][];
  difficulty: Difficulty;
  seed: number;
}

/** Clues left on the board. Fewer clues means more deduction, not guessing. */
const CLUES: Record<Difficulty, number> = { easy: 42, medium: 34, hard: 28 };

function nextRandom(seed: number): { value: number; seed: number } {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: t };
}

function shuffle<T>(items: T[], seed: number): { items: T[]; seed: number } {
  const result = [...items];
  let current = seed;
  for (let i = result.length - 1; i > 0; i -= 1) {
    const roll = nextRandom(current);
    current = roll.seed;
    const j = Math.floor(roll.value * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return { items: result, seed: current };
}

export const emptyGrid = (): Grid => Array.from({ length: 9 }, () => Array(9).fill(0));
export const cloneGrid = (grid: Grid): Grid => grid.map((row) => [...row]);
export const boxIndex = (row: number, column: number) => Math.floor(row / 3) * 3 + Math.floor(column / 3);

/** Whether `value` may go in this cell under the rules, ignoring what is there. */
export function isLegal(grid: Grid, row: number, column: number, value: number): boolean {
  if (value < 1 || value > 9) return false;
  for (let i = 0; i < 9; i += 1) {
    if (i !== column && grid[row][i] === value) return false;
    if (i !== row && grid[i][column] === value) return false;
  }
  const boxRow = Math.floor(row / 3) * 3;
  const boxColumn = Math.floor(column / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r += 1) {
    for (let c = boxColumn; c < boxColumn + 3; c += 1) {
      if ((r !== row || c !== column) && grid[r][c] === value) return false;
    }
  }
  return true;
}

/** Every filled cell that breaks a rule against another filled cell. */
export function conflicts(grid: Grid): { row: number; column: number }[] {
  const found: { row: number; column: number }[] = [];
  for (let row = 0; row < 9; row += 1) {
    for (let column = 0; column < 9; column += 1) {
      const value = grid[row][column];
      if (value && !isLegal(grid, row, column, value)) found.push({ row, column });
    }
  }
  return found;
}

export const isComplete = (grid: Grid) =>
  grid.every((row) => row.every((value) => value !== 0)) && conflicts(grid).length === 0;

function firstEmpty(grid: Grid): { row: number; column: number } | null {
  for (let row = 0; row < 9; row += 1) {
    for (let column = 0; column < 9; column += 1) {
      if (!grid[row][column]) return { row, column };
    }
  }
  return null;
}

/** Fills the grid by backtracking, trying digits in a seeded order. */
function fill(grid: Grid, seed: number): { filled: boolean; seed: number } {
  const cell = firstEmpty(grid);
  if (!cell) return { filled: true, seed };
  const order = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], seed);
  let current = order.seed;
  for (const value of order.items) {
    if (!isLegal(grid, cell.row, cell.column, value)) continue;
    grid[cell.row][cell.column] = value;
    const attempt = fill(grid, current);
    current = attempt.seed;
    if (attempt.filled) return { filled: true, seed: current };
    grid[cell.row][cell.column] = 0;
  }
  return { filled: false, seed: current };
}

/**
 * Counts solutions, stopping at `limit`. Generation only needs to know whether
 * there is more than one, and stopping early keeps that cheap.
 */
export function countSolutions(grid: Grid, limit = 2): number {
  const working = cloneGrid(grid);
  let found = 0;

  const search = (): boolean => {
    const cell = firstEmpty(working);
    if (!cell) {
      found += 1;
      return found >= limit;
    }
    for (let value = 1; value <= 9; value += 1) {
      if (!isLegal(working, cell.row, cell.column, value)) continue;
      working[cell.row][cell.column] = value;
      if (search()) { working[cell.row][cell.column] = 0; return true; }
      working[cell.row][cell.column] = 0;
    }
    return false;
  };

  search();
  return found;
}

export function solve(grid: Grid): Grid | null {
  const working = cloneGrid(grid);
  const result = fill(working, 1);
  return result.filled ? working : null;
}

export function generateSudoku(seed = Date.now(), difficulty: Difficulty = "medium"): SudokuPuzzle {
  const solution = emptyGrid();
  const filled = fill(solution, seed);

  // Take clues out one at a time, keeping only the removals that leave the
  // puzzle with exactly one solution. A puzzle with two answers is not a
  // Sudoku: it can only be finished by guessing.
  const positions = shuffle(
    Array.from({ length: 81 }, (_, index) => index),
    filled.seed,
  );
  const puzzle = cloneGrid(solution);
  let clues = 81;

  for (const index of positions.items) {
    if (clues <= CLUES[difficulty]) break;
    const row = Math.floor(index / 9);
    const column = index % 9;
    const removed = puzzle[row][column];
    puzzle[row][column] = 0;
    if (countSolutions(puzzle) === 1) clues -= 1;
    else puzzle[row][column] = removed;
  }

  return {
    puzzle,
    solution,
    given: puzzle.map((row) => row.map((value) => value !== 0)),
    difficulty,
    seed: positions.seed,
  };
}

export const clueCount = (grid: Grid) => grid.reduce((total, row) => total + row.filter(Boolean).length, 0);

/** Digits still to place, per value, for the number pad. */
export function remainingByDigit(grid: Grid): number[] {
  const counts = Array(10).fill(0);
  for (const row of grid) for (const value of row) if (value) counts[value] += 1;
  return Array.from({ length: 10 }, (_, digit) => (digit === 0 ? 0 : 9 - counts[digit]));
}

/**
 * The cell a hint should fill: the first empty one, so a hint is predictable
 * rather than a lottery, and a player using hints learns where to look.
 */
export function hintCell(puzzle: SudokuPuzzle, grid: Grid): { row: number; column: number; value: number } | null {
  for (let row = 0; row < 9; row += 1) {
    for (let column = 0; column < 9; column += 1) {
      if (grid[row][column] !== puzzle.solution[row][column]) {
        return { row, column, value: puzzle.solution[row][column] };
      }
    }
  }
  return null;
}

export function describeSudokuCell(grid: Grid, given: boolean[][], row: number, column: number): string {
  const value = grid[row][column];
  const where = `Row ${row + 1}, column ${column + 1}, box ${boxIndex(row, column) + 1}`;
  if (!value) return `${where}, empty.`;
  const kind = given[row][column] ? "given" : "yours";
  const clash = isLegal(grid, row, column, value) ? "" : ", conflicts with another cell";
  return `${where}, ${value}, ${kind}${clash}.`;
}

export function describeSudokuBoard(grid: Grid, difficulty: Difficulty): string {
  const remaining = 81 - clueCount(grid);
  const wrong = conflicts(grid).length;
  return [
    `${difficulty} puzzle.`,
    remaining ? `${remaining} cells left.` : "Every cell is filled.",
    wrong ? `${wrong} cells conflict.` : "No conflicts.",
  ].join(" ");
}
