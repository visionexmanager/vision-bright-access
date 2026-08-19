import { describe, expect, it } from "vitest";
import {
  BUBBLE_SHOOTER_CONFIG,
  aim,
  cellCentre,
  colorName,
  columnsInRow,
  createBubbleShooterState,
  describeBubbleBoard,
  fire,
  floatingCells,
  lowestOccupiedRow,
  matchingCluster,
  neighbours,
  pushRow,
  remainingBubbles,
  simulateShot,
  startBubbleShooter,
  type BubbleShooterState,
} from "./bubbleShooterEngine";

const ready = () => startBubbleShooter(createBubbleShooterState(13));

/**
 * A shot fired straight up from the middle meets the pair on the top row and
 * snaps to row 1, column 3, which touches both of them — the smallest board
 * where a straight shot completes a run of three.
 */
const POP_PAIR = { "0,3": 2, "0,4": 2 };

/** A board with only the cells listed filled, so a shot can be aimed exactly. */
const board = (cells: Record<string, number>): BubbleShooterState => {
  const base = ready();
  const grid = base.grid.map((row) => row.map(() => 0));
  for (const [key, colour] of Object.entries(cells)) {
    const [row, column] = key.split(",").map(Number);
    grid[row][column] = colour;
  }
  return { ...base, grid };
};

describe("bubble shooter engine — the board", () => {
  it("packs odd rows one bubble narrower, offset by half a bubble", () => {
    const config = BUBBLE_SHOOTER_CONFIG;
    expect(columnsInRow(config, 0)).toBe(config.columns);
    expect(columnsInRow(config, 1)).toBe(config.columns - 1);
    expect(cellCentre(config, { row: 1, column: 0 }).x - cellCentre(config, { row: 0, column: 0 }).x).toBeCloseTo(0.5);
  });

  it("gives an inner cell six neighbours and an edge cell fewer", () => {
    expect(neighbours(BUBBLE_SHOOTER_CONFIG, { row: 2, column: 3 })).toHaveLength(6);
    expect(neighbours(BUBBLE_SHOOTER_CONFIG, { row: 0, column: 0 }).length).toBeLessThan(6);
  });

  it("deals a board of the configured depth", () => {
    const state = createBubbleShooterState(3);
    expect(lowestOccupiedRow(state)).toBe(BUBBLE_SHOOTER_CONFIG.startingRows - 1);
    expect(remainingBubbles(state)).toBeGreaterThan(0);
    expect(state.status).toBe("ready");
  });

  it("does not fire before the game starts", () => {
    const idle = createBubbleShooterState(3);
    expect(fire(idle)).toBe(idle);
  });

  it("clamps the launcher inside its arc", () => {
    const state = ready();
    expect(aim(state, -500).angle).toBe(-BUBBLE_SHOOTER_CONFIG.maxAngle);
    expect(aim(state, 500).angle).toBe(BUBBLE_SHOOTER_CONFIG.maxAngle);
    expect(aim(state, 12).angle).toBe(12);
  });
});

describe("bubble shooter engine — the shot", () => {
  it("flies straight up into the ceiling on an empty board", () => {
    const shot = simulateShot(board({}), 0);
    expect(shot.cell!.row).toBe(0);
    expect(shot.bounces).toBe(0);
  });

  it("snaps under the bubble it hits", () => {
    // One bubble dead centre on the top row of an otherwise empty board.
    const state = board({ "0,4": 1 });
    const shot = simulateShot(state, 0);
    expect(shot.cell!.row).toBeGreaterThan(0);
    expect(neighbours(state.config, { row: 0, column: 4 })).toContainEqual(shot.cell);
  });

  it("banks off a wall, which is how a covered target is reached", () => {
    const shot = simulateShot(board({}), -70);
    expect(shot.bounces).toBeGreaterThan(0);
    expect(shot.cell).not.toBeNull();
  });

  it("never lands outside the board, at any angle", () => {
    const state = ready();
    for (let angle = -78; angle <= 78; angle += 3) {
      const shot = simulateShot(state, angle);
      if (!shot.cell) continue;
      expect(shot.cell.row).toBeGreaterThanOrEqual(0);
      expect(shot.cell.row).toBeLessThan(state.config.rows);
      expect(shot.cell.column).toBeGreaterThanOrEqual(0);
      expect(shot.cell.column).toBeLessThan(columnsInRow(state.config, shot.cell.row));
      expect(state.grid[shot.cell.row][shot.cell.column]).toBe(0);
    }
  });
});

describe("bubble shooter engine — matching and falling", () => {
  it("finds the connected run of one colour", () => {
    const state = board({ "0,3": 2, "0,4": 2, "0,5": 2, "0,6": 3 });
    expect(matchingCluster(state, { row: 0, column: 4 })).toHaveLength(3);
    expect(matchingCluster(state, { row: 0, column: 6 })).toHaveLength(1);
  });

  it("pops a run of three and scores it", () => {
    const state: BubbleShooterState = { ...board(POP_PAIR), loaded: 2, angle: 0 };
    const after = fire(state);
    expect(after.events).toContain("pop");
    expect(after.score).toBeGreaterThan(0);
    expect(after.poppedTotal).toBeGreaterThanOrEqual(3);
  });

  it("leaves a pair alone: two of a colour is not a match", () => {
    const state: BubbleShooterState = { ...board({ "0,4": 2 }), loaded: 2, angle: 0 };
    const after = fire(state);
    expect(after.events).not.toContain("pop");
    expect(after.score).toBe(0);
    expect(after.shotsSincePop).toBe(1);
  });

  it("drops bubbles that lose their support, and pays extra for them", () => {
    // The chain hangs off the pair and clears the shot's column, so it only
    // comes down because the bubbles holding it up were popped.
    const state = board({ ...POP_PAIR, "1,4": 3, "2,5": 4 });
    const before = remainingBubbles(state);
    const after = fire({ ...state, loaded: 2, angle: 0 });

    expect(after.events).toContain("pop");
    expect(after.events).toContain("drop");
    expect(remainingBubbles(after)).toBeLessThan(before);
    expect(after.score).toBeGreaterThan(30);
  });

  it("counts anything with no path to the top row as floating", () => {
    const state = board({ "0,0": 1, "3,4": 2 });
    expect(floatingCells(state)).toEqual([{ row: 3, column: 4 }]);
  });
});

describe("bubble shooter engine — pressure and endings", () => {
  it("counts a shot that pops nothing", () => {
    const after = fire({ ...board({}), loaded: 1, angle: 0 });
    expect(after.shotsSincePop).toBe(1);
    expect(after.events).not.toContain("pop");
  });

  it("pushes a new row in once the pressure counter runs out", () => {
    const state: BubbleShooterState = {
      ...board({}),
      loaded: 1,
      angle: 0,
      shotsSincePop: BUBBLE_SHOOTER_CONFIG.shotsPerRow - 1,
    };
    const after = fire(state);
    expect(after.events).toContain("row");
    expect(after.shotsSincePop).toBe(0);
  });

  it("resets the pressure counter as soon as something pops", () => {
    const state: BubbleShooterState = { ...board(POP_PAIR), loaded: 2, angle: 0, shotsSincePop: 4 };
    expect(fire(state).shotsSincePop).toBe(0);
  });

  it("ends the game when a pushed row reaches the last line", () => {
    const deep = board(
      Object.fromEntries(
        Array.from({ length: BUBBLE_SHOOTER_CONFIG.rows - 1 }, (_, row) => [`${row},0`, 1]),
      ),
    );
    const after = pushRow(deep);
    expect(after.status).toBe("over");
    expect(after.events).toContain("over");
  });

  it("wins when the last bubble goes", () => {
    const state: BubbleShooterState = { ...board(POP_PAIR), loaded: 2, angle: 0 };
    const after = fire(state);
    expect(remainingBubbles(after)).toBe(0);
    expect(after.status).toBe("won");
  });

  it("freezes once the game is over", () => {
    const over: BubbleShooterState = { ...ready(), status: "over" };
    expect(fire(over)).toBe(over);
    expect(aim(over, 30)).toBe(over);
  });

  it("replays identically from the same seed and differently from another", () => {
    const play = (seed: number) => {
      let state = startBubbleShooter(createBubbleShooterState(seed));
      for (let i = 0; i < 12; i += 1) state = fire(aim(state, ((i * 17) % 60) - 30));
      return `${state.score}:${remainingBubbles(state)}:${state.loaded}`;
    };
    expect(play(31)).toBe(play(31));
    expect(play(31)).not.toBe(play(88));
  });
});

describe("bubble shooter engine — non-visual guidance", () => {
  it("names the loaded and queued colours in words", () => {
    expect(colorName(1)).toBe("red");
    const spoken = describeBubbleBoard({ ...ready(), loaded: 1, queued: 3 });
    expect(spoken).toContain("Holding red, next green");
  });

  it("says where the current aim lands and whether it pops", () => {
    const hitting: BubbleShooterState = { ...board(POP_PAIR), loaded: 2, angle: 0 };
    const spoken = describeBubbleBoard(hitting);
    expect(spoken).toMatch(/It lands on row \d+, column \d+/);
    expect(spoken).toContain("That pops 3 bubbles");
  });

  it("warns when the aim is not enough to pop anything", () => {
    const weak: BubbleShooterState = { ...board({ "0,4": 2 }), loaded: 2, angle: 0 };
    expect(describeBubbleBoard(weak)).toContain("not enough to pop");
  });

  it("reports the aim in degrees and the pressure counter", () => {
    const spoken = describeBubbleBoard(aim(ready(), -24));
    expect(spoken).toContain("Aiming 24 degrees left");
    expect(spoken).toMatch(/\d+ shots before a new row drops in/);
  });

  it("says the game has ended rather than describing a dead board", () => {
    expect(describeBubbleBoard({ ...ready(), status: "over", score: 400 })).toContain("Game over with 400 points");
    expect(describeBubbleBoard({ ...ready(), status: "won", score: 900 })).toContain("Board cleared with 900 points");
  });

  it("can be played from the description alone: a bot that aims where it pops", () => {
    let state = ready();
    let pops = 0;
    for (let shot = 0; shot < 60 && state.status === "running"; shot += 1) {
      let best: { angle: number; size: number } | null = null;
      for (let angle = -75; angle <= 75; angle += 3) {
        const result = simulateShot(state, angle);
        if (!result.cell) continue;
        const preview: BubbleShooterState = {
          ...state,
          grid: state.grid.map((row, index) =>
            index === result.cell!.row ? row.map((value, column) => (column === result.cell!.column ? state.loaded : value)) : row,
          ),
        };
        const size = matchingCluster(preview, result.cell).length;
        if (!best || size > best.size) best = { angle, size };
      }
      const before = state.poppedTotal;
      state = fire(aim(state, best?.angle ?? 0));
      if (state.poppedTotal > before) pops += 1;
    }
    expect(pops, "aiming at the biggest cluster should pop bubbles").toBeGreaterThan(3);
  });
});
