import { describe, expect, it } from "vitest";
import {
  BAR, OFF, State, applyMove, createGame, diceFromRoll, homeComplete, legalMoves,
  pipCount, planTurn, winner,
} from "./backgammonEngine";

function withDice(state: State, dice: number[]): State {
  return { ...state, dice };
}

describe("backgammon engine", () => {
  it("sets up fifteen checkers per side on the standard points", () => {
    const game = createGame();
    const white = game.points.filter((value) => value > 0).reduce((a, b) => a + b, 0);
    const black = game.points.filter((value) => value < 0).reduce((a, b) => a - b, 0);
    expect(white).toBe(15);
    expect(black).toBe(15);
    expect(game.points[23]).toBe(2);
    expect(game.points[0]).toBe(-2);
    expect(pipCount(game, "w")).toBe(167);
    expect(pipCount(game, "b")).toBe(167);
  });

  it("expands doubles into four moves", () => {
    expect(diceFromRoll([3, 3])).toEqual([3, 3, 3, 3]);
    expect(diceFromRoll([5, 2])).toEqual([5, 2]);
  });

  it("blocks points held by two or more rival checkers", () => {
    const game = withDice(createGame("w"), [5]);
    // White on 23 moving 5 lands on 18, which black holds with five checkers.
    expect(legalMoves(game, "w").some((move) => move.from === 23 && move.to === 18)).toBe(false);
    expect(legalMoves(game, "w").some((move) => move.from === 12 && move.to === 7)).toBe(true);
  });

  it("forces a checker on the bar to re-enter before anything else moves", () => {
    const base = createGame("w");
    const game = withDice({ ...base, bar: { w: 1, b: 0 } }, [2, 6]);
    const moves = legalMoves(game, "w");
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((move) => move.from === BAR)).toBe(true);
    // Entering with a 2 lands on point 22 (index 22).
    expect(moves.some((move) => move.die === 2 && move.to === 22)).toBe(true);
  });

  it("sends a lone rival checker to the bar when hit", () => {
    const points = new Array(24).fill(0);
    points[10] = 1;   // one white checker
    points[7] = -1;   // a lone black blot
    const game: State = {
      points, bar: { w: 0, b: 0 }, off: { w: 0, b: 0 }, turn: "w", dice: [3], rolled: null,
    };
    const move = legalMoves(game, "w").find((option) => option.from === 10 && option.to === 7);
    expect(move?.hit).toBe(true);

    const after = applyMove(game, move!);
    expect(after.points[7]).toBe(1);
    expect(after.bar.b).toBe(1);
    expect(after.dice).toEqual([]);
  });

  it("only allows bearing off once every checker is home", () => {
    const spread = new Array(24).fill(0);
    spread[3] = 14;
    spread[10] = 1; // one checker still outside the home board
    const notReady: State = {
      points: spread, bar: { w: 0, b: 0 }, off: { w: 0, b: 0 }, turn: "w", dice: [4], rolled: null,
    };
    expect(homeComplete(notReady, "w")).toBe(false);
    expect(legalMoves(notReady, "w").some((move) => move.to === OFF)).toBe(false);

    const home = new Array(24).fill(0);
    home[3] = 15;
    const ready: State = {
      points: home, bar: { w: 0, b: 0 }, off: { w: 0, b: 0 }, turn: "w", dice: [4], rolled: null,
    };
    expect(homeComplete(ready, "w")).toBe(true);
    // Exactly a 4 bears off from index 3, and nothing sits further back.
    expect(legalMoves(ready, "w").some((move) => move.from === 3 && move.to === OFF)).toBe(true);
  });

  it("bears off with a larger die only when no checker sits further back", () => {
    const points = new Array(24).fill(0);
    points[2] = 1;
    points[5] = 1;
    const blocked: State = {
      points, bar: { w: 0, b: 0 }, off: { w: 0, b: 0 }, turn: "w", dice: [4], rolled: null,
    };
    // Index 5 is further from the edge, so a 4 cannot lift the checker on index 2.
    expect(blocked.points[5]).toBe(1);
    expect(legalMoves(blocked, "w").some((move) => move.from === 2 && move.to === OFF)).toBe(false);

    const clear = { ...blocked, points: points.map((value, index) => (index === 5 ? 0 : value)) };
    expect(legalMoves(clear, "w").some((move) => move.from === 2 && move.to === OFF)).toBe(true);
  });

  it("declares a winner after fifteen checkers come off", () => {
    const game = createGame();
    expect(winner(game)).toBeNull();
    expect(winner({ ...game, off: { w: 15, b: 0 } })).toBe("w");
    expect(winner({ ...game, off: { w: 0, b: 15 } })).toBe("b");
  });

  it("plans a legal, dice-consuming sequence for the rival", () => {
    const game = withDice(createGame("b"), [4, 2]);
    const plan = planTurn(game, "b");
    expect(plan.length).toBeGreaterThan(0);

    let current = game;
    for (const move of plan) {
      expect(legalMoves(current, "b")).toContainEqual(move);
      current = applyMove(current, move);
    }
    const black = current.points.filter((value) => value < 0).reduce((a, b) => a - b, 0);
    expect(black + current.bar.b + current.off.b).toBe(15);
  });
});
