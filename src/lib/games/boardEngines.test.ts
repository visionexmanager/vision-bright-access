import { describe, expect, it } from "vitest";
import {
  Board as C4Board, COLS, ROWS, availableColumns, bestColumn, createBoard as createC4,
  drop, indexOf, isFull, landingRow, winningLine,
} from "./connectFourEngine";
import {
  Board as CheckersBoard, applyMove, bestMove, countPieces, createBoard as createCheckers,
  isDark, legalMoves, result,
} from "./checkersEngine";
import {
  FINISH, PLAYERS, START, TRACK_CELLS, applyMove as ludoMove, cellOf, chooseToken,
  createGame as createLudo, globalSquare, legalTokens, nextPlayer, winner as ludoWinner,
} from "./ludoEngine";
import { GRID, createSnake, step, turn } from "./snakeEngine";
import {
  MAX_GUESSES, WORD_LENGTH, WORDS, isKnownWord, keyboardMarks, letters, scoreGuess,
} from "./wordMasterEngine";

describe("connect four engine", () => {
  it("stacks discs from the bottom of a column", () => {
    let board = createC4();
    board = drop(board, 3, "r");
    expect(board[indexOf(ROWS - 1, 3)]).toBe("r");
    board = drop(board, 3, "y");
    expect(board[indexOf(ROWS - 2, 3)]).toBe("y");
    expect(landingRow(board, 3)).toBe(ROWS - 3);
  });

  it("removes a full column from the available list", () => {
    let board = createC4();
    for (let i = 0; i < ROWS; i += 1) board = drop(board, 0, i % 2 === 0 ? "r" : "y");
    expect(landingRow(board, 0)).toBe(-1);
    expect(availableColumns(board)).toHaveLength(COLS - 1);
    // Dropping into a full column is a no-op.
    expect(drop(board, 0, "r")).toBe(board);
  });

  it("finds horizontal, vertical, and diagonal wins", () => {
    const horizontal = createC4();
    for (let col = 0; col < 4; col += 1) horizontal[indexOf(5, col)] = "r";
    expect(winningLine(horizontal)).toHaveLength(4);

    const vertical = createC4();
    for (let row = 2; row < 6; row += 1) vertical[indexOf(row, 2)] = "y";
    expect(winningLine(vertical)).toHaveLength(4);

    const diagonal = createC4();
    for (let i = 0; i < 4; i += 1) diagonal[indexOf(5 - i, i)] = "r";
    expect(winningLine(diagonal)).toHaveLength(4);

    expect(winningLine(createC4())).toBeNull();
  });

  it("does not call three in a row a win", () => {
    const board = createC4();
    for (let col = 0; col < 3; col += 1) board[indexOf(5, col)] = "r";
    expect(winningLine(board)).toBeNull();
  });

  it("takes the winning drop when one is available", () => {
    const board: C4Board = createC4();
    // Yellow has three on the bottom row; column 3 completes the line.
    for (let col = 0; col < 3; col += 1) board[indexOf(5, col)] = "y";
    expect(bestColumn(board, "y", "hard")).toBe(3);
  });

  it("blocks the opponent's winning drop", () => {
    const board: C4Board = createC4();
    for (let col = 0; col < 3; col += 1) board[indexOf(5, col)] = "r";
    expect(bestColumn(board, "y", "hard")).toBe(3);
  });

  it("reports a full board", () => {
    let board = createC4();
    // Fill in a pattern that avoids four in a row.
    const pattern = ["r", "r", "y", "y"] as const;
    for (let col = 0; col < COLS; col += 1) {
      for (let row = 0; row < ROWS; row += 1) {
        board = drop(board, col, pattern[(row + col * 2) % 4]);
      }
    }
    expect(isFull(board)).toBe(true);
    expect(availableColumns(board)).toHaveLength(0);
  });
});

describe("checkers engine", () => {
  it("sets up twelve pieces per side on dark squares only", () => {
    const board = createCheckers();
    expect(countPieces(board, "w")).toBe(12);
    expect(countPieces(board, "b")).toBe(12);
    board.forEach((piece, index) => {
      if (piece) expect(isDark(index)).toBe(true);
    });
  });

  it("offers seven opening moves for each side", () => {
    const board = createCheckers();
    expect(legalMoves(board, "w")).toHaveLength(7);
    expect(legalMoves(board, "b")).toHaveLength(7);
  });

  it("makes capturing compulsory", () => {
    const board: CheckersBoard = new Array(64).fill(null);
    board[44] = { side: "w", king: false };  // row 5, col 4
    board[35] = { side: "b", king: false };  // row 4, col 3 — jumpable onto row 3, col 2
    board[40] = { side: "w", king: false };  // a piece that only has quiet moves

    const moves = legalMoves(board, "w");
    expect(moves.length).toBeGreaterThan(0);
    // Every offered move must be a capture while one exists anywhere on the board.
    expect(moves.every((move) => move.captures.length > 0)).toBe(true);
    // The quiet-only piece therefore has nothing it may legally play.
    expect(legalMoves(board, "w", 40)).toHaveLength(0);
  });

  it("chains a double jump and removes both victims", () => {
    const board: CheckersBoard = new Array(64).fill(null);
    board[44] = { side: "w", king: false };  // row 5, col 4
    board[35] = { side: "b", king: false };  // row 4, col 3
    board[17] = { side: "b", king: false };  // row 2, col 1

    const doubles = legalMoves(board, "w").filter((move) => move.captures.length === 2);
    expect(doubles).toHaveLength(1);
    expect(doubles[0].path).toEqual([44, 26, 8]);

    const after = applyMove(board, doubles[0]);
    expect(countPieces(after, "b")).toBe(0);
    expect(countPieces(after, "w")).toBe(1);
  });

  it("crowns a piece that reaches the far row", () => {
    const board: CheckersBoard = new Array(64).fill(null);
    board[10] = { side: "w", king: false }; // row 1, col 2 — one step from row 0
    const promoting = legalMoves(board, "w").find((move) => move.promotes);
    expect(promoting).toBeDefined();
    const after = applyMove(board, promoting!);
    expect(after[promoting!.path[promoting!.path.length - 1]]).toMatchObject({ side: "w", king: true });
  });

  it("lets a king move backwards", () => {
    const board: CheckersBoard = new Array(64).fill(null);
    board[35] = { side: "w", king: true }; // row 4, col 3
    const rows = legalMoves(board, "w").map((move) => Math.floor(move.path[1] / 8));
    // A king reaches both the row above and the row below.
    expect(rows).toContain(3);
    expect(rows).toContain(5);
  });

  it("declares the side with no pieces the loser", () => {
    const board: CheckersBoard = new Array(64).fill(null);
    board[35] = { side: "w", king: false };
    expect(result(board, "b")).toBe("w");
  });

  it("returns a legal move from the engine", () => {
    const board = createCheckers();
    const move = bestMove(board, "b", "medium");
    expect(move).not.toBeNull();
    expect(legalMoves(board, "b")).toContainEqual(move);
  });
});

describe("ludo engine", () => {
  it("builds a 52-square loop with no duplicate cells", () => {
    expect(TRACK_CELLS).toHaveLength(52);
    const unique = new Set(TRACK_CELLS.map(([row, col]) => `${row},${col}`));
    expect(unique.size).toBe(52);
  });

  it("spaces the four starting squares 13 apart", () => {
    expect(Object.values(START)).toEqual([0, 13, 26, 39]);
    PLAYERS.forEach((player) => expect(globalSquare(player, 0)).toBe(START[player]));
  });

  it("starts every token in base with no legal move below a six", () => {
    const game = createLudo();
    expect(game.tokens.flat().every((pos) => pos === -1)).toBe(true);
    for (let die = 1; die <= 5; die += 1) {
      expect(legalTokens(game, 0, die)).toHaveLength(0);
    }
    expect(legalTokens(game, 0, 6)).toHaveLength(4);
  });

  it("releases a token onto the track with a six", () => {
    const game = createLudo();
    const outcome = ludoMove(game, 0, 0, 6);
    expect(outcome.state.tokens[0][0]).toBe(0);
    expect(outcome.extraTurn).toBe(true);
  });

  it("refuses to overshoot the finish and accepts an exact roll", () => {
    const game = createLudo();
    game.tokens[0][0] = FINISH - 3;
    expect(legalTokens(game, 0, 4)).not.toContain(0);
    expect(legalTokens(game, 0, 3)).toContain(0);
    const outcome = ludoMove(game, 0, 0, 3);
    expect(outcome.state.tokens[0][0]).toBe(FINISH);
    expect(outcome.finished).toBe(true);
    expect(outcome.extraTurn).toBe(true);
  });

  it("sends a rival token home on an unsafe square but not a safe one", () => {
    const unsafe = createLudo();
    // Global square 3 is not in the safe set: red relative 3, green relative 42.
    unsafe.tokens[0][0] = 2;
    unsafe.tokens[1][0] = 42;
    expect(globalSquare(0, 3)).toBe(3);
    expect(globalSquare(1, 42)).toBe(3);
    const hit = ludoMove(unsafe, 0, 0, 1);
    expect(hit.captured).toBe(true);
    expect(hit.state.tokens[1][0]).toBe(-1);

    const safe = createLudo();
    // Global square 8 is a star square, so the token standing there is protected.
    safe.tokens[0][0] = 7;
    safe.tokens[1][0] = 47;
    expect(globalSquare(1, 47)).toBe(8);
    const blocked = ludoMove(safe, 0, 0, 1);
    expect(blocked.captured).toBe(false);
    expect(blocked.state.tokens[1][0]).toBe(47);
  });

  it("maps base, track, home column, and centre to distinct cells", () => {
    const base = cellOf(0, -1, 0);
    const track = cellOf(0, 0, 0);
    const home = cellOf(0, 51, 0);
    const centre = cellOf(0, FINISH, 0);
    const seen = new Set([base, track, home, centre].map(([r, c]) => `${r},${c}`));
    expect(seen.size).toBe(4);
    expect(centre).toEqual([7, 7]);
  });

  it("rotates turns and declares a winner", () => {
    expect(nextPlayer(0)).toBe(1);
    expect(nextPlayer(3)).toBe(0);
    const game = createLudo();
    expect(ludoWinner(game)).toBeNull();
    game.tokens[2] = [FINISH, FINISH, FINISH, FINISH];
    expect(ludoWinner(game)).toBe(2);
  });

  it("prefers a capture over any other bot move", () => {
    const game = createLudo();
    game.tokens[1][0] = 42;   // green sits on global square 3
    game.tokens[0][0] = 2;    // red one step away
    game.tokens[0][1] = 20;   // a further-along token the bot would otherwise pick
    expect(chooseToken(game, 0, 1)).toBe(0);
  });
});

describe("snake engine", () => {
  it("starts with a three-cell body and food off the body", () => {
    const snake = createSnake();
    expect(snake.body).toHaveLength(3);
    expect(snake.body).not.toContain(snake.food);
    expect(snake.alive).toBe(true);
  });

  it("moves the head and keeps the length when not eating", () => {
    const snake = createSnake();
    // Force food away from the next cell so the step is a plain move.
    const moved = step({ ...snake, food: -1 });
    expect(moved.body).toHaveLength(3);
    expect(moved.body[0]).toBe(snake.body[0] + 1);
  });

  it("grows and scores when it eats", () => {
    const snake = createSnake();
    const eaten = step({ ...snake, food: snake.body[0] + 1 });
    expect(eaten.body).toHaveLength(4);
    expect(eaten.score).toBe(10);
    expect(eaten.food).not.toBe(eaten.body[0]);
  });

  it("refuses to reverse straight into its own neck", () => {
    const snake = createSnake();
    expect(turn(snake, "left")).toBe(snake);
    expect(turn(snake, "up").direction).toBe("up");
  });

  it("dies against a wall", () => {
    const snake = createSnake();
    const atEdge = { ...snake, body: [GRID - 1, GRID - 2, GRID - 3], direction: "right" as const, food: -1 };
    expect(step(atEdge).alive).toBe(false);
  });

  it("dies when it runs into its own body", () => {
    // Moving up lands on the fourth segment, which is not the tail, so it is fatal.
    const body = [
      7 * GRID + 7, 7 * GRID + 8, 6 * GRID + 8, 6 * GRID + 7, 6 * GRID + 6,
    ];
    const snake = { body, direction: "up" as const, food: -1, score: 0, alive: true };
    expect(step(snake).alive).toBe(false);
  });

  it("survives moving onto the cell its tail is vacating", () => {
    // The tail steps away this tick, so the head may legally take its place.
    const body = [7 * GRID + 7, 7 * GRID + 8, 6 * GRID + 8, 6 * GRID + 7];
    const snake = { body, direction: "up" as const, food: -1, score: 0, alive: true };
    expect(step(snake).alive).toBe(true);
  });
});

describe("word master engine", () => {
  it("holds only five-letter answers in both languages", () => {
    (["ar", "en"] as const).forEach((lang) => {
      expect(WORDS[lang].length).toBeGreaterThan(50);
      WORDS[lang].forEach((word) => expect([...word]).toHaveLength(WORD_LENGTH));
    });
  });

  it("marks an exact match as all correct", () => {
    expect(scoreGuess("plant", "plant")).toEqual(
      new Array(WORD_LENGTH).fill("correct"),
    );
  });

  it("marks letters that are in the word but out of place", () => {
    // c, r, a, and n all appear in "acorn" but none sit in the right slot; e is absent.
    expect(scoreGuess("crane", "acorn")).toEqual([
      "present", "present", "present", "present", "absent",
    ]);
  });

  it("does not over-report a repeated letter", () => {
    // The answer holds one "l", so only the better-placed "l" may light up.
    const marks = scoreGuess("llama", "koala");
    expect(marks.filter((mark) => mark !== "absent").length).toBeLessThanOrEqual(4);
    expect(marks[4]).toBe("correct");
  });

  it("keeps the strongest mark per letter for the keyboard", () => {
    const state = keyboardMarks(["crane", "acorn"], "acorn");
    expect(state.a).toBe("correct");
    expect(state.e).toBe("absent");
  });

  it("recognises listed words and rejects nonsense", () => {
    expect(isKnownWord(WORDS.en[0], "en")).toBe(true);
    expect(isKnownWord("zzzzz", "en")).toBe(false);
    expect(isKnownWord(WORDS.ar[0], "ar")).toBe(true);
  });

  it("exposes a keyboard covering every letter of every answer", () => {
    (["ar", "en"] as const).forEach((lang) => {
      const keys = new Set(letters(lang));
      WORDS[lang].forEach((word) => {
        [...word].forEach((letter) => expect(keys.has(letter)).toBe(true));
      });
    });
    expect(MAX_GUESSES).toBe(6);
  });
});
