import { describe, expect, it } from "vitest";
import { availableRaceTokens, createHexBoard, createLudo, createMancala, hasHexPath, moveRaceToken, playHex, playMancala } from "./arcadeHeritageBoardEngine";

describe("heritage board engines", () => {
  it("detects a connected Hex path without mutating occupied cells", () => {
    let board = createHexBoard(3);
    board = playHex(board, 0, 0, 1); board = playHex(board, 0, 1, 1); board = playHex(board, 0, 2, 1);
    expect(hasHexPath(board, 1)).toBe(true);
    expect(playHex(board, 0, 0, 2)).toBe(board);
  });

  it("sows Mancala stones and rejects an opponent pit", () => {
    const state = createMancala();
    const next = playMancala(state, 2);
    expect(next.pits[2]).toBe(0);
    expect(next.pits.slice(3, 7)).toEqual([5,5,5,1]);
    expect(playMancala(state, 8)).toBe(state);
  });

  it("requires a six to enter Ludo and captures on an unsafe square", () => {
    const start = createLudo();
    expect(availableRaceTokens(start, "player", 5, 40, true)).toEqual([]);
    const entered = moveRaceToken(start, "player", 0, 6, 40, true);
    expect(entered.player[0]).toBe(0);
    const collision = { player:[4,-1,-1,-1], computer:[7,-1,-1,-1], turn:"player" as const };
    const captured = moveRaceToken(collision, "player", 0, 3, 40, true);
    expect(captured.computer[0]).toBe(-1);
  });

  it("prevents race pieces from overshooting the finish", () => {
    const state = { player:[39,-1,-1], computer:[-1,-1,-1], turn:"player" as const };
    expect(moveRaceToken(state, "player", 0, 2, 40)).toBe(state);
  });

  it("sweeps remaining Mancala stones when either side empties", () => {
    const state = { pits:[0,0,0,0,0,1,20,2,0,0,0,0,0,18], current:0 as const };
    const next = playMancala(state, 5);
    expect(next.pits.slice(0,6).concat(next.pits.slice(7,13))).toEqual(Array(12).fill(0));
    expect(next.pits[6] + next.pits[13]).toBe(41);
  });
});
