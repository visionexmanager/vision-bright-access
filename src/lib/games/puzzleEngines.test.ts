import { describe, expect, it } from "vitest";
import {
  canPlace, conflictingCells, countSolutions, generatePuzzle, generateSolution, isSolved, solve,
} from "./sudokuEngine";
import { canMove, createBoard, hasWon, move, SIZE } from "./game2048Engine";
import {
  LEVELS, createEmptyBoard, flagCount, isCleared, placeMines, reveal, toggleFlag,
} from "./minesweeperEngine";
import {
  autoCollect, canStackOnFoundation, canStackOnTableau, createGame, drawFromStock, isWon, moveTo,
} from "./solitaireEngine";

describe("sudoku engine", () => {
  it("generates a fully valid solution grid", () => {
    const solution = generateSolution();
    expect(solution).toHaveLength(81);
    expect(solution.every((value) => value >= 1 && value <= 9)).toBe(true);
    expect(conflictingCells(solution).size).toBe(0);
    expect(isSolved(solution)).toBe(true);
  });

  it("produces puzzles with exactly one solution", () => {
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      const { puzzle, solution, givens } = generatePuzzle(difficulty);
      expect(countSolutions(puzzle, 3)).toBe(1);
      expect(solve(puzzle)).toEqual(solution);
      // Givens flag exactly the cells that start filled.
      puzzle.forEach((value, index) => expect(givens[index]).toBe(value !== 0));
    }
  });

  it("rejects a digit that already appears in the row, column, or box", () => {
    const grid = new Array(81).fill(0);
    grid[0] = 5;
    expect(canPlace(grid, 1, 5)).toBe(false);  // same row
    expect(canPlace(grid, 9, 5)).toBe(false);  // same column
    expect(canPlace(grid, 10, 5)).toBe(false); // same box
    expect(canPlace(grid, 40, 5)).toBe(true);
  });

  it("flags both cells of a clash", () => {
    const grid = new Array(81).fill(0);
    grid[0] = 7;
    grid[8] = 7;
    expect([...conflictingCells(grid)].sort((a, b) => a - b)).toEqual([0, 8]);
  });
});

describe("2048 engine", () => {
  const board = (rows: number[][]) => rows.flat();

  it("merges a pair once per move", () => {
    const start = board([
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const result = move(start, "left");
    expect(result.board.slice(0, 4)).toEqual([4, 0, 0, 0]);
    expect(result.gained).toBe(4);
    expect(result.moved).toBe(true);
  });

  it("does not chain three equal tiles into one", () => {
    const start = board([
      [2, 2, 2, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    expect(move(start, "left").board.slice(0, 4)).toEqual([4, 2, 0, 0]);
  });

  it("collapses toward the chosen edge", () => {
    const start = board([
      [0, 0, 0, 2],
      [0, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const result = move(start, "up");
    expect(result.board[3]).toBe(4);
    expect(result.board[7]).toBe(0);
  });

  it("reports no move when nothing shifts", () => {
    const start = board([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ]);
    expect(move(start, "left").moved).toBe(false);
    expect(canMove(start)).toBe(false);
  });

  it("starts with exactly two tiles and detects the winning tile", () => {
    const fresh = createBoard();
    expect(fresh.filter((value) => value !== 0)).toHaveLength(2);
    expect(fresh).toHaveLength(SIZE * SIZE);
    expect(hasWon(fresh)).toBe(false);
    expect(hasWon([2048, ...new Array(15).fill(0)])).toBe(true);
  });
});

describe("minesweeper engine", () => {
  const config = LEVELS.easy;

  it("never places a mine on the opening cell or its neighbours", () => {
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const board = placeMines(createEmptyBoard(config), config, 4, 4);
      for (let row = 3; row <= 5; row += 1) {
        for (let col = 3; col <= 5; col += 1) {
          expect(board[row][col].mine).toBe(false);
        }
      }
    }
  });

  it("places the requested number of mines and counts neighbours", () => {
    const board = placeMines(createEmptyBoard(config), config, 0, 0);
    const mines = board.flat().filter((cell) => cell.mine).length;
    expect(mines).toBe(config.mines);

    board.forEach((line, row) =>
      line.forEach((cell, col) => {
        let expected = 0;
        for (let dr = -1; dr <= 1; dr += 1) {
          for (let dc = -1; dc <= 1; dc += 1) {
            if (dr === 0 && dc === 0) continue;
            const r = row + dr;
            const c = col + dc;
            if (r >= 0 && r < config.rows && c >= 0 && c < config.cols && board[r][c].mine) expected += 1;
          }
        }
        expect(cell.adjacent).toBe(expected);
      }),
    );
  });

  it("flood-fills an empty region and stops at numbered cells", () => {
    const board = placeMines(createEmptyBoard(config), config, 0, 0);
    const opened = reveal(board, 0, 0);
    expect(opened[0][0].revealed).toBe(true);
    // Nothing revealed by the flood may be a mine.
    expect(opened.flat().filter((cell) => cell.revealed && cell.mine)).toHaveLength(0);
  });

  it("toggles flags and never flags a revealed cell", () => {
    const board = placeMines(createEmptyBoard(config), config, 0, 0);
    const flagged = toggleFlag(board, 5, 5);
    expect(flagCount(flagged)).toBe(1);
    expect(flagCount(toggleFlag(flagged, 5, 5))).toBe(0);

    const opened = reveal(board, 0, 0);
    const target = opened.findIndex((line) => line.some((cell) => cell.revealed));
    const col = opened[target].findIndex((cell) => cell.revealed);
    expect(toggleFlag(opened, target, col)).toBe(opened);
  });

  it("is cleared once every safe cell is revealed", () => {
    const board = placeMines(createEmptyBoard(config), config, 0, 0);
    expect(isCleared(board)).toBe(false);
    const solved = board.map((line) => line.map((cell) => ({ ...cell, revealed: !cell.mine })));
    expect(isCleared(solved)).toBe(true);
  });
});

describe("solitaire engine", () => {
  it("deals 28 tableau cards with only the last of each column face up", () => {
    const game = createGame();
    expect(game.tableau).toHaveLength(7);
    game.tableau.forEach((pile, column) => {
      expect(pile).toHaveLength(column + 1);
      pile.forEach((card, index) => expect(card.faceUp).toBe(index === pile.length - 1));
    });
    expect(game.stock).toHaveLength(24);
  });

  it("enforces foundation and tableau stacking rules", () => {
    const ace = { id: "hearts-1", suit: "hearts" as const, rank: 1, faceUp: true };
    const two = { id: "hearts-2", suit: "hearts" as const, rank: 2, faceUp: true };
    expect(canStackOnFoundation(ace, [])).toBe(true);
    expect(canStackOnFoundation(two, [])).toBe(false);
    expect(canStackOnFoundation(two, [ace])).toBe(true);

    const blackKing = { id: "spades-13", suit: "spades" as const, rank: 13, faceUp: true };
    const redQueen = { id: "hearts-12", suit: "hearts" as const, rank: 12, faceUp: true };
    const blackQueen = { id: "clubs-12", suit: "clubs" as const, rank: 12, faceUp: true };
    expect(canStackOnTableau(blackKing, [])).toBe(true);
    expect(canStackOnTableau(redQueen, [])).toBe(false);
    expect(canStackOnTableau(redQueen, [blackKing])).toBe(true);
    expect(canStackOnTableau(blackQueen, [blackKing])).toBe(false);
  });

  it("draws from stock and recycles the waste when the stock empties", () => {
    let game = createGame();
    const size = game.stock.length;
    game = drawFromStock(game);
    expect(game.stock).toHaveLength(size - 1);
    expect(game.waste).toHaveLength(1);
    expect(game.waste[0].faceUp).toBe(true);

    while (game.stock.length > 0) game = drawFromStock(game);
    expect(game.waste).toHaveLength(size);
    game = drawFromStock(game);
    expect(game.stock).toHaveLength(size);
    expect(game.waste).toHaveLength(0);
  });

  it("turns over the card exposed by moving a tableau run", () => {
    const game = createGame();
    // Column 1 holds two cards, so moving the top one must flip the one beneath.
    const source = { pile: "tableau" as const, column: 1, index: 1 };
    const card = game.tableau[1][1];
    const targetColumn = game.tableau.findIndex((pile, column) =>
      column !== 1 && canStackOnTableau(card, pile));
    if (targetColumn === -1) return;

    const next = moveTo(game, source, { pile: "tableau", column: targetColumn });
    expect(next.tableau[1]).toHaveLength(1);
    expect(next.tableau[1][0].faceUp).toBe(true);
  });

  it("rejects an illegal move by returning the same state", () => {
    const game = createGame();
    const before = game.tableau[0][0];
    const next = moveTo(game, { pile: "tableau", column: 0, index: 0 }, { pile: "foundation", suit: "spades" });
    if (before.suit !== "spades" || before.rank !== 1) expect(next).toBe(game);
  });

  it("auto-collects a fully solvable board", () => {
    const game = createGame();
    const collected = autoCollect(game);
    // Auto collect must never produce an invalid foundation ordering.
    (["hearts", "diamonds", "clubs", "spades"] as const).forEach((suit) => {
      collected.foundations[suit].forEach((card, index) => expect(card.rank).toBe(index + 1));
    });
    expect(isWon(collected)).toBe(false);
  });
});
