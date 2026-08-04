import { describe, expect, it } from "vitest";
import {
  Action,
  LEVELS,
  State,
  applyAction,
  atLockedExit,
  createGame,
  gemCount,
  isGrounded,
  remainingGems,
  resolvePath,
  score,
  tileAt,
} from "./skyboundEngine";

const ACTIONS: Action[] = [
  { kind: "step", dx: -1 },
  { kind: "step", dx: 1 },
  { kind: "jump", dx: -1 },
  { kind: "jump", dx: 0 },
  { kind: "jump", dx: 1 },
];

/** First cell holding `tile`, so tests describe intent rather than coordinates. */
function findTile(state: State, tile: string): { row: number; col: number } {
  for (let row = 0; row < state.grid.length; row += 1) {
    for (let col = 0; col < state.grid[row].length; col += 1) {
      if (state.grid[row][col] === tile) return { row, col };
    }
  }
  throw new Error(`Level ${state.level + 1} has no ${tile} tile`);
}

const signature = (state: State) =>
  `${state.player.row},${state.player.col}|${[...state.collected].sort().join(";")}`;

/**
 * Breadth-first search over reachable board states. Used to prove each shipped
 * level can actually be finished — a hand-drawn platform map is very easy to
 * make unwinnable, and that is not something a player should discover.
 */
function solve(level: number): Action[] | null {
  const start = createGame(level);
  const queue: { state: State; moves: Action[] }[] = [{ state: start, moves: [] }];
  const seen = new Set([signature(start)]);

  while (queue.length > 0) {
    const { state, moves } = queue.shift()!;
    for (const action of ACTIONS) {
      const next = applyAction(state, action);
      if (next.status === "lost" || next === state) continue;
      if (next.status === "won") return [...moves, action];
      const mark = signature(next);
      if (seen.has(mark)) continue;
      seen.add(mark);
      queue.push({ state: next, moves: [...moves, action] });
    }
  }
  return null;
}

describe("skybound quest engine", () => {
  it("parses every level into a rectangle with one start, gems, and an exit", () => {
    LEVELS.forEach((rows, level) => {
      const state = createGame(level);
      const width = state.grid[0].length;
      expect(rows.filter((row) => row.includes("@"))).toHaveLength(1);
      expect(state.grid.every((row) => row.length === width)).toBe(true);
      expect(state.gemTotal).toBeGreaterThan(0);
      expect(state.grid.flat()).toContain("exit");
      expect(state.status).toBe("playing");
      expect(gemCount(state.grid)).toBe(state.gemTotal);
    });
  });

  it("starts the player on solid ground", () => {
    LEVELS.forEach((_, level) => expect(isGrounded(createGame(level))).toBe(true));
  });

  it("finds a winning line for every shipped level", () => {
    LEVELS.forEach((_, level) => {
      const solution = solve(level);
      expect(solution, `level ${level + 1} is unwinnable`).not.toBeNull();
      // Replay it to confirm the solver's path really wins under the same rules.
      let state = createGame(level);
      for (const action of solution!) state = applyAction(state, action);
      expect(state.status).toBe("won");
      expect(remainingGems(state)).toBe(0);
    });
  });

  it("blocks a step into a wall without spending a move", () => {
    const state = createGame(0);
    const blocked = applyAction(state, { kind: "step", dx: -1 });
    expect(blocked).toBe(state);
    expect(blocked.moves).toBe(0);
  });

  it("always settles the player on solid ground after an action", () => {
    let state = createGame(0);
    for (const action of [
      { kind: "jump", dx: 1 },
      { kind: "step", dx: 1 },
      { kind: "jump", dx: 1 },
    ] as Action[]) {
      state = applyAction(state, action);
      if (state.status !== "playing") break;
      expect(isGrounded(state), `airborne after ${action.kind}`).toBe(true);
    }
  });

  it("refuses a second jump in mid-air", () => {
    const state = createGame(0);
    const path = resolvePath(state, { kind: "jump", dx: 1 });
    expect(path.length).toBeGreaterThan(0);
    // Mid-arc the player is airborne; the engine only jumps from the ground.
    const airborne: State = { ...state, player: { row: state.player.row - 1, col: state.player.col } };
    expect(isGrounded(airborne)).toBe(false);
    expect(resolvePath(airborne, { kind: "jump", dx: 1 })).toEqual([]);
  });

  it("kills the player on a hazard touched anywhere along the arc", () => {
    const base = createGame(0);
    const spike = findTile(base, "hazard");
    const state: State = { ...base, player: { row: spike.row, col: spike.col - 1 } };
    expect(applyAction(state, { kind: "step", dx: 1 }).status).toBe("lost");
  });

  it("collects a gem and keeps it after moving on", () => {
    const base = createGame(0);
    const gem = findTile(base, "gem");
    const state: State = { ...base, player: { row: gem.row, col: gem.col - 1 } };

    const after = applyAction(state, { kind: "step", dx: 1 });
    expect(after.collected.has(`${gem.row},${gem.col}`)).toBe(true);
    expect(remainingGems(after)).toBe(base.gemTotal - 1);

    const later = applyAction(after, { kind: "step", dx: -1 });
    expect(later.collected.has(`${gem.row},${gem.col}`)).toBe(true);
    expect(remainingGems(later)).toBe(base.gemTotal - 1);
  });

  it("leaves the exit locked until every gem is collected", () => {
    const base = createGame(0);
    const exit = findTile(base, "exit");

    const empty: State = { ...base, player: exit };
    expect(atLockedExit(empty)).toBe(true);
    expect(empty.status).toBe("playing");

    const allGems = new Set<string>();
    base.grid.forEach((row, rowIndex) =>
      row.forEach((tile, colIndex) => {
        if (tile === "gem") allGems.add(`${rowIndex},${colIndex}`);
      }),
    );
    const carrying: State = {
      ...base,
      player: { row: exit.row, col: exit.col - 1 },
      collected: allGems,
    };
    expect(remainingGems(carrying)).toBe(0);
    expect(atLockedExit({ ...carrying, player: exit })).toBe(false);
    expect(applyAction(carrying, { kind: "step", dx: 1 }).status).toBe("won");
  });

  it("loses when the player falls out of the bottom of the map", () => {
    const base = createGame(2);
    // Level 3's floor has a gap at column 3; stepping onto it drops the player through.
    const state: State = { ...base, player: { row: 8, col: 2 } };
    expect(tileAt(state, 9, 3)).toBe("empty");
    const after = applyAction(state, { kind: "step", dx: 1 });
    expect(after.status).toBe("lost");
  });

  it("ignores actions once the game is over", () => {
    const finished: State = { ...createGame(0), status: "won" };
    expect(applyAction(finished, { kind: "step", dx: 1 })).toBe(finished);
  });

  it("scores a win above any unfinished run and rewards efficiency", () => {
    const base = createGame(0);
    const gem = findTile(base, "gem");
    const won: State = { ...base, status: "won", moves: 12, collected: new Set([`${gem.row},${gem.col}`]) };
    const slower: State = { ...won, moves: 40 };
    const abandoned: State = { ...base, collected: new Set([`${gem.row},${gem.col}`]) };
    expect(score(won)).toBeGreaterThan(score(slower));
    expect(score(slower)).toBeGreaterThan(score(abandoned));
  });
});
