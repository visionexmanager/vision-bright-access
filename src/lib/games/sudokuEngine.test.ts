import { describe, expect, it } from "vitest";
import {
  boxIndex,
  clueCount,
  cloneGrid,
  conflicts,
  countSolutions,
  describeSudokuBoard,
  describeSudokuCell,
  emptyGrid,
  generateSudoku,
  hintCell,
  isComplete,
  isLegal,
  remainingByDigit,
  solve,
  type Difficulty,
  type Grid,
} from "./sudokuEngine";

const rowsAreValid = (grid: Grid) =>
  grid.every((row) => new Set(row).size === 9 && row.every((value) => value >= 1 && value <= 9));

const columnsAreValid = (grid: Grid) =>
  Array.from({ length: 9 }, (_, column) => new Set(grid.map((row) => row[column])).size === 9).every(Boolean);

const boxesAreValid = (grid: Grid) =>
  Array.from({ length: 9 }, (_, box) => {
    const values = new Set<number>();
    const rowStart = Math.floor(box / 3) * 3;
    const columnStart = (box % 3) * 3;
    for (let r = rowStart; r < rowStart + 3; r += 1) {
      for (let c = columnStart; c < columnStart + 3; c += 1) values.add(grid[r][c]);
    }
    return values.size === 9;
  }).every(Boolean);

describe("sudoku engine — the rules", () => {
  it("rejects a digit that repeats in the row, the column or the box", () => {
    const grid = emptyGrid();
    grid[0][0] = 5;
    expect(isLegal(grid, 0, 8, 5)).toBe(false);
    expect(isLegal(grid, 8, 0, 5)).toBe(false);
    expect(isLegal(grid, 2, 2, 5)).toBe(false);
    expect(isLegal(grid, 4, 4, 5)).toBe(true);
  });

  it("judges a move by the rules, not by a stored answer", () => {
    // Any digit that breaks no rule is legal, whichever one the solver chose.
    const grid = emptyGrid();
    const legal = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((value) => isLegal(grid, 4, 4, value));
    expect(legal).toHaveLength(9);
  });

  it("refuses anything outside one to nine", () => {
    expect(isLegal(emptyGrid(), 0, 0, 0)).toBe(false);
    expect(isLegal(emptyGrid(), 0, 0, 10)).toBe(false);
  });

  it("names the box a cell belongs to", () => {
    expect(boxIndex(0, 0)).toBe(0);
    expect(boxIndex(4, 4)).toBe(4);
    expect(boxIndex(8, 8)).toBe(8);
  });

  it("lists every filled cell that clashes with another", () => {
    const grid = emptyGrid();
    grid[0][0] = 5;
    grid[0][5] = 5;
    expect(conflicts(grid)).toHaveLength(2);
    expect(conflicts(emptyGrid())).toHaveLength(0);
  });

  it("counts a grid finished only when it is full and clean", () => {
    const { solution } = generateSudoku(4, "easy");
    expect(isComplete(solution)).toBe(true);

    const broken = cloneGrid(solution);
    broken[0][0] = broken[0][1];
    expect(isComplete(broken)).toBe(false);

    const unfinished = cloneGrid(solution);
    unfinished[3][3] = 0;
    expect(isComplete(unfinished)).toBe(false);
  });
});

describe("sudoku engine — generation", () => {
  const difficulties: Difficulty[] = ["easy", "medium", "hard"];

  it.each(difficulties)("produces a valid, uniquely solvable %s puzzle", (difficulty) => {
    const puzzle = generateSudoku(7, difficulty);

    expect(rowsAreValid(puzzle.solution)).toBe(true);
    expect(columnsAreValid(puzzle.solution)).toBe(true);
    expect(boxesAreValid(puzzle.solution)).toBe(true);
    expect(countSolutions(puzzle.puzzle), "a puzzle with two answers can only be guessed").toBe(1);

    for (let row = 0; row < 9; row += 1) {
      for (let column = 0; column < 9; column += 1) {
        const value = puzzle.puzzle[row][column];
        if (value) expect(value).toBe(puzzle.solution[row][column]);
        expect(puzzle.given[row][column]).toBe(value !== 0);
      }
    }
  });

  it("leaves fewer clues on a harder puzzle", () => {
    const easy = clueCount(generateSudoku(11, "easy").puzzle);
    const hard = clueCount(generateSudoku(11, "hard").puzzle);
    expect(hard).toBeLessThan(easy);
    expect(hard).toBeGreaterThanOrEqual(17);
  });

  it("deals a different puzzle for a different seed, and the same one twice", () => {
    const a = generateSudoku(21, "medium").puzzle.flat().join("");
    const b = generateSudoku(21, "medium").puzzle.flat().join("");
    const c = generateSudoku(99, "medium").puzzle.flat().join("");
    expect(a).toBe(b);
    expect(a, "the previous game shipped one hard-coded grid for everybody").not.toBe(c);
  });

  it("solves any puzzle it generates", () => {
    const puzzle = generateSudoku(33, "hard");
    const solved = solve(puzzle.puzzle)!;
    expect(solved).toEqual(puzzle.solution);
  });

  it("counts more than one solution for a board with too few clues", () => {
    const sparse = emptyGrid();
    sparse[0][0] = 1;
    expect(countSolutions(sparse)).toBe(2);
  });
});

describe("sudoku engine — play aids", () => {
  it("counts how many of each digit are still to place", () => {
    const grid = emptyGrid();
    grid[0][0] = 3;
    const remaining = remainingByDigit(grid);
    expect(remaining[3]).toBe(8);
    expect(remaining[4]).toBe(9);
  });

  it("hints the first cell that does not match the solution", () => {
    const puzzle = generateSudoku(5, "easy");
    const working = cloneGrid(puzzle.puzzle);
    const hint = hintCell(puzzle, working)!;

    expect(working[hint.row][hint.column]).toBe(0);
    expect(hint.value).toBe(puzzle.solution[hint.row][hint.column]);

    expect(hintCell(puzzle, puzzle.solution)).toBeNull();
  });

  it("also hints a cell the player filled in wrongly", () => {
    const puzzle = generateSudoku(5, "easy");
    const working = cloneGrid(puzzle.solution);
    working[8][8] = working[8][8] === 1 ? 2 : 1;
    const hint = hintCell(puzzle, working)!;
    expect(hint).toMatchObject({ row: 8, column: 8, value: puzzle.solution[8][8] });
  });
});

describe("sudoku engine — non-visual guidance", () => {
  it("describes a cell by row, column, box and where its digit came from", () => {
    const puzzle = generateSudoku(5, "easy");
    const grid = cloneGrid(puzzle.puzzle);
    const filled = puzzle.given.flatMap((row, r) => row.map((given, c) => (given ? { r, c } : null))).find(Boolean)!;

    expect(describeSudokuCell(grid, puzzle.given, filled.r, filled.c)).toMatch(
      new RegExp(`Row ${filled.r + 1}, column ${filled.c + 1}, box \\d, \\d, given\\.`),
    );
  });

  it("says a cell is empty when it is", () => {
    expect(describeSudokuCell(emptyGrid(), emptyGrid().map((row) => row.map(() => false)), 2, 3)).toBe(
      "Row 3, column 4, box 2, empty.",
    );
  });

  it("flags a conflicting cell in its description", () => {
    const grid = emptyGrid();
    grid[0][0] = 5;
    grid[0][5] = 5;
    const given = grid.map((row) => row.map(() => false));
    expect(describeSudokuCell(grid, given, 0, 5)).toContain("conflicts with another cell");
  });

  it("summarises how much is left and whether anything clashes", () => {
    const puzzle = generateSudoku(5, "medium");
    const spoken = describeSudokuBoard(puzzle.puzzle, "medium");
    expect(spoken).toContain("medium puzzle");
    expect(spoken).toMatch(/\d+ cells left/);
    expect(spoken).toContain("No conflicts");
    expect(describeSudokuBoard(puzzle.solution, "medium")).toContain("Every cell is filled");
  });
});
