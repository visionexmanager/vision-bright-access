import { describe, expect, it } from "vitest";
import { BOARD, buildOn, buyPending, calculateRent, createGame, endTurn, rollDice, toggleMortgage } from "./visionopolyEngine";

describe("Visionopoly engine", () => {
  it("uses a complete 40-space board", () => {
    expect(BOARD).toHaveLength(40);
    expect(BOARD.map((space) => space.index)).toEqual([...Array(40).keys()]);
  });

  it("moves, offers a property, and buys it", () => {
    let state = createGame();
    state = rollDice(state, [1, 2]);
    expect(state.players[0].position).toBe(3);
    expect(state.pending).toEqual({ type: "buy", spaceIndex: 3 });
    state = buyPending(state);
    expect(state.properties[3].ownerId).toBe(0);
    expect(state.players[0].cash).toBe(1440);
  });

  it("pays doubled base rent for a complete undeveloped group", () => {
    const state = createGame();
    state.properties = {
      1: { ownerId: 0, buildings: 0, mortgaged: false },
      3: { ownerId: 0, buildings: 0, mortgaged: false },
    };
    expect(calculateRent(state, BOARD[1], 5)).toBe(4);
  });

  it("enforces even building and supports mortgage lifecycle", () => {
    let state = createGame();
    state.properties = {
      1: { ownerId: 0, buildings: 0, mortgaged: false },
      3: { ownerId: 0, buildings: 0, mortgaged: false },
    };
    state = buildOn(state, 1);
    expect(state.properties[1].buildings).toBe(1);
    expect(buildOn(state, 1).properties[1].buildings).toBe(1);
    state = buildOn(state, 3);
    expect(state.properties[3].buildings).toBe(1);
    expect(toggleMortgage(state, 1).properties[1].mortgaged).toBe(false);
  });

  it("gives an extra roll for doubles", () => {
    let state = createGame();
    state = rollDice(state, [2, 2]);
    state = state.pending ? { ...state, pending: null } : state;
    expect(endTurn(state).currentPlayer).toBe(0);
  });
});

