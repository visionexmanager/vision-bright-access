import { describe, expect, it } from "vitest";
import {
  BLOCK_STACKER_CONFIG,
  PIECES,
  columnHeights,
  createBlockStackerState,
  describeBlockStackerBoard,
  dropIntervalMs,
  emptyGrid,
  fits,
  ghostPiece,
  hardDrop,
  moveHorizontally,
  pieceCells,
  rotatePiece,
  startBlockStacker,
  stepDown,
  type BlockStackerState,
} from "./blockStackerEngine";

const ready = () => startBlockStacker(createBlockStackerState(9));

/** A state holding one named shape at a chosen spot on an empty board. */
const withPiece = (id: string, x: number, y: number, rotation = 0): BlockStackerState => {
  const base = ready();
  return { ...base, grid: emptyGrid(base.config), piece: { shapeIndex: PIECES.findIndex((p) => p.id === id), rotation, x, y } };
};

const fill = (state: BlockStackerState, row: number, columns: number[]): BlockStackerState => ({
  ...state,
  grid: state.grid.map((cells, index) => (index === row ? cells.map((cell, x) => (columns.includes(x) ? 1 : cell)) : cells)),
});

const fullRow = (state: BlockStackerState, row: number) =>
  fill(state, row, Array.from({ length: state.config.columns }, (_, x) => x));

describe("block stacker engine — pieces", () => {
  it("offers a set of distinct shapes with no duplicate rotations", () => {
    expect(PIECES.length).toBeGreaterThanOrEqual(6);
    for (const piece of PIECES) {
      const keys = piece.rotations.map((cells) => [...cells].map(([x, y]) => `${x},${y}`).sort().join("|"));
      expect(new Set(keys).size, `${piece.id} repeats a rotation`).toBe(keys.length);
    }
  });

  it("keeps every rotation the same size as the piece", () => {
    for (const piece of PIECES) {
      for (const cells of piece.rotations) expect(cells.length).toBe(piece.rotations[0].length);
    }
  });

  it("gives the square a single rotation, so turning it is not a wasted keypress", () => {
    expect(PIECES.find((piece) => piece.id === "square")!.rotations).toHaveLength(1);
    expect(PIECES.find((piece) => piece.id === "bar")!.rotations.length).toBeGreaterThan(1);
  });

  it("starts with a piece on the board and another one queued", () => {
    const state = createBlockStackerState(3);
    expect(state.piece).not.toBeNull();
    expect(state.nextShapeIndex).toBeGreaterThanOrEqual(0);
    expect(state.status).toBe("ready");
  });

  it("does not fall before the game starts", () => {
    const idle = createBlockStackerState(3);
    expect(stepDown(idle)).toBe(idle);
  });
});

describe("block stacker engine — movement", () => {
  it("moves the piece sideways and refuses to leave the board", () => {
    const state = withPiece("bar", 0, 5);
    expect(moveHorizontally(state, 1).piece!.x).toBe(1);
    expect(moveHorizontally(state, -1)).toBe(state);

    const right = withPiece("bar", BLOCK_STACKER_CONFIG.columns - 4, 5);
    expect(moveHorizontally(right, 1)).toBe(right);
  });

  it("refuses to move into a locked cell", () => {
    const state = fill(withPiece("square", 4, 5), 5, [6]);
    expect(moveHorizontally(state, 1)).toBe(state);
  });

  it("falls one row per step", () => {
    const state = withPiece("tee", 3, 4);
    expect(stepDown(state).piece!.y).toBe(5);
  });

  it("rotates, and nudges off the wall rather than refusing", () => {
    // A bar flat against the left wall cannot turn in place at x = 0 unless it
    // is nudged, which reads to the player as the game ignoring the key.
    const state = withPiece("bar", 0, 5);
    const rotated = rotatePiece(state);
    expect(rotated).not.toBe(state);
    expect(rotated.piece!.rotation).toBe(1);
    expect(fits(rotated, rotated.piece!)).toBe(true);
  });

  it("leaves a rotation alone when even a nudge cannot make room", () => {
    const boxed: BlockStackerState = {
      ...withPiece("bar", 3, 5),
      grid: emptyGrid(BLOCK_STACKER_CONFIG).map((row, y) => (y > 5 && y < 9 ? row.map(() => 1) : row)),
    };
    expect(rotatePiece(boxed)).toBe(boxed);
  });
});

describe("block stacker engine — locking and clearing", () => {
  it("locks the piece into the grid when it cannot fall further", () => {
    const state = withPiece("square", 4, BLOCK_STACKER_CONFIG.rows - 2);
    const locked = stepDown(state);
    expect(locked.events).toContain("lock");
    expect(locked.grid[BLOCK_STACKER_CONFIG.rows - 1][4]).toBeGreaterThan(0);
    expect(locked.piece!.y).toBe(0);
  });

  it("clears a completed row and pulls the stack down", () => {
    const base = withPiece("square", 0, BLOCK_STACKER_CONFIG.rows - 2);
    const nearlyFull = fill(base, BLOCK_STACKER_CONFIG.rows - 1, [2, 3, 4, 5, 6, 7, 8, 9]);
    const withMarker = fill(nearlyFull, BLOCK_STACKER_CONFIG.rows - 3, [5]);

    const after = stepDown(withMarker);
    expect(after.events).toContain("clear");
    expect(after.rowsCleared).toBe(1);
    // The full bottom row goes; what sat above it drops by one.
    expect(after.grid[BLOCK_STACKER_CONFIG.rows - 1].filter(Boolean)).toHaveLength(2);
    expect(after.grid[BLOCK_STACKER_CONFIG.rows - 2][5], "the marker should fall one row").toBeGreaterThan(0);
  });

  it("pays far more for four rows at once than for one", () => {
    // A well one column wide, filled by a bar stood on end — the shape the
    // scoring table is meant to reward.
    const base = ready();
    const bar = PIECES.findIndex((piece) => piece.id === "bar");
    const wellOf = (depth: number) => {
      let state = base;
      for (let offset = 0; offset < depth; offset += 1) {
        state = fill(state, base.config.rows - 1 - offset, Array.from({ length: base.config.columns - 1 }, (_, x) => x));
      }
      return { ...state, piece: { shapeIndex: bar, rotation: 1, x: base.config.columns - 1, y: base.config.rows - 4 } };
    };

    const one = hardDrop(wellOf(1));
    const four = hardDrop(wellOf(4));
    expect(one.lastCleared).toBe(1);
    expect(four.lastCleared).toBe(4);
    expect(four.score).toBeGreaterThan(one.score * 3);
  });

  it("raises the level and speeds the drop as rows accumulate", () => {
    const base = ready();
    const nearlyLevelled: BlockStackerState = { ...base, rowsCleared: base.config.rowsPerLevel - 1 };
    const after = stepDown({ ...fullRow(nearlyLevelled, base.config.rows - 1), piece: { shapeIndex: 1, rotation: 0, x: 0, y: base.config.rows - 3 } });
    expect(after.level).toBe(2);
    expect(after.events).toContain("level");
    expect(dropIntervalMs(after)).toBeLessThan(dropIntervalMs(base));
  });

  it("never drops the interval below the floor", () => {
    expect(dropIntervalMs({ ...ready(), level: 99 })).toBe(BLOCK_STACKER_CONFIG.minDropMs);
  });

  it("hands the queued piece to the board and queues another", () => {
    const state = withPiece("square", 4, BLOCK_STACKER_CONFIG.rows - 2);
    const queued = state.nextShapeIndex;
    const after = stepDown(state);
    expect(after.piece!.shapeIndex).toBe(queued);
  });
});

describe("block stacker engine — dropping and ending", () => {
  it("drops the piece to its landing spot and pays for the distance", () => {
    const state = withPiece("square", 4, 2);
    const dropped = hardDrop(state);
    expect(dropped.grid[BLOCK_STACKER_CONFIG.rows - 1][4]).toBeGreaterThan(0);
    expect(dropped.score).toBeGreaterThan(0);
  });

  it("previews the landing spot without moving the piece", () => {
    const state = withPiece("square", 4, 2);
    const ghost = ghostPiece(state)!;
    expect(ghost.y).toBe(BLOCK_STACKER_CONFIG.rows - 2);
    expect(state.piece!.y).toBe(2);
  });

  it("ends the game when a new piece has nowhere to spawn", () => {
    const base = ready();
    // Filled to the ceiling but one column short, so nothing clears away.
    const packed: BlockStackerState = {
      ...base,
      grid: base.grid.map((row, y) => (y < 4 ? row.map((cell, x) => (x === base.config.columns - 1 ? cell : 1)) : row)),
      piece: { shapeIndex: 1, rotation: 0, x: 4, y: 5 },
    };
    const after = hardDrop(packed);
    expect(after.status).toBe("over");
    expect(after.events).toContain("over");
  });

  it("freezes once the game is over", () => {
    const over: BlockStackerState = { ...ready(), status: "over" };
    expect(stepDown(over)).toBe(over);
    expect(moveHorizontally(over, 1)).toBe(over);
    expect(rotatePiece(over)).toBe(over);
    expect(hardDrop(over)).toBe(over);
  });

  it("replays identically from the same seed and differently from another", () => {
    const play = (seed: number) => {
      let state = startBlockStacker(createBlockStackerState(seed));
      for (let i = 0; i < 40; i += 1) state = hardDrop(state);
      return `${state.score}:${state.rowsCleared}:${state.nextShapeIndex}`;
    };
    expect(play(21)).toBe(play(21));
    expect(play(21)).not.toBe(play(77));
  });
});

describe("block stacker engine — non-visual guidance", () => {
  it("reports the column heights so the stack can be read without seeing it", () => {
    const state = fill(ready(), BLOCK_STACKER_CONFIG.rows - 1, [0, 1]);
    const heights = columnHeights(state);
    expect(heights[0]).toBe(1);
    expect(heights[5]).toBe(0);
  });

  it("names the piece, its columns, where it lands and what comes next", () => {
    const spoken = describeBlockStackerBoard(withPiece("tee", 3, 2));
    expect(spoken).toContain("tee piece over columns 4 to 6");
    expect(spoken).toMatch(/\d+ rows above its landing spot, on row \d+/);
    expect(spoken).toMatch(/Next piece \w+/);
    expect(spoken).toMatch(/Lowest column is \d+/);
  });

  it("says the game has ended rather than describing a dead board", () => {
    const spoken = describeBlockStackerBoard({ ...ready(), status: "over", score: 1200, rowsCleared: 7 });
    expect(spoken).toContain("Game over with 1200 points");
    expect(spoken).toContain("7 rows cleared");
  });

  it("can be played: a placement bot clears rows and holds every invariant", () => {
    /** Buried empty cells, the thing a competent player is avoiding. */
    const holes = (state: BlockStackerState) => {
      let count = 0;
      for (let x = 0; x < state.config.columns; x += 1) {
        let covered = false;
        for (let y = 0; y < state.config.rows; y += 1) {
          if (state.grid[y][x]) covered = true;
          else if (covered) count += 1;
        }
      }
      return count;
    };

    let state = ready();
    for (let turn = 0; turn < 200 && state.status === "running"; turn += 1) {
      let best: { state: BlockStackerState; rating: number } | null = null;

      for (let rotation = 0; rotation < PIECES[state.piece!.shapeIndex].rotations.length; rotation += 1) {
        let turned = state;
        for (let r = 0; r < rotation; r += 1) turned = rotatePiece(turned);
        if (turned.piece!.rotation !== rotation % PIECES[state.piece!.shapeIndex].rotations.length) continue;

        for (let column = 0; column < state.config.columns; column += 1) {
          let candidate = turned;
          for (let nudge = 0; nudge < state.config.columns * 2; nudge += 1) {
            const left = Math.min(...pieceCells(candidate.piece!).map(([x]) => x));
            if (left === column) break;
            const moved = moveHorizontally(candidate, Math.sign(column - left));
            if (moved === candidate) break;
            candidate = moved;
          }
          const dropped = hardDrop(candidate);
          if (dropped.status === "over") continue;
          const rating = dropped.lastCleared * 60 - holes(dropped) * 12 - Math.max(...columnHeights(dropped)) * 2;
          if (!best || rating > best.rating) best = { state: dropped, rating };
        }
      }

      state = best ? best.state : hardDrop(state);

      expect(state.grid).toHaveLength(state.config.rows);
      for (const row of state.grid) expect(row).toHaveLength(state.config.columns);
      expect(state.grid.flat().every((cell) => cell >= 0 && cell <= PIECES.length)).toBe(true);
    }

    expect(state.rowsCleared, "a competent bot should clear rows").toBeGreaterThan(4);
    expect(state.score).toBeGreaterThan(0);
  });
});
