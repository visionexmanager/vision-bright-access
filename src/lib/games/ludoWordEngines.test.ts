import { describe, expect, it } from "vitest";
import {
  FINISH, PLAYERS, START, TRACK_CELLS, applyMove as ludoMove, cellOf, chooseToken,
  createGame as createLudo, globalSquare, legalTokens, nextPlayer, winner as ludoWinner,
} from "./ludoEngine";
import {
  MAX_GUESSES, WORD_LENGTH, WORDS, isKnownWord, keyboardMarks, letters, scoreGuess,
} from "./wordMasterEngine";

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
