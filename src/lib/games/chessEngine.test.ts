import { describe, expect, it } from "vitest";
import {
  Position, bestMove, gameResult, initialPosition, isInCheck, legalMoves, makeMove, squareName,
} from "./chessEngine";

/** Plays a sequence of "e2e4" style moves from the starting position. */
function playLine(moves: string[]): Position {
  return moves.reduce((position, notation) => {
    const from = notation.slice(0, 2);
    const to = notation.slice(2, 4);
    const move = legalMoves(position).find(
      (option) => squareName(option.from) === from && squareName(option.to) === to,
    );
    if (!move) throw new Error(`illegal move ${notation}`);
    return makeMove(position, move);
  }, initialPosition());
}

describe("chess engine", () => {
  it("offers exactly 20 opening moves for white", () => {
    expect(legalMoves(initialPosition())).toHaveLength(20);
  });

  it("matches the published perft counts for the opening position", () => {
    const perft = (position: Position, depth: number): number => {
      const moves = legalMoves(position);
      if (depth === 1) return moves.length;
      return moves.reduce((total, move) => total + perft(makeMove(position, move), depth - 1), 0);
    };
    const start = initialPosition();
    expect(perft(start, 2)).toBe(400);
    expect(perft(start, 3)).toBe(8902);
  });

  it("detects Fool's mate as checkmate", () => {
    const position = playLine(["f2f3", "e7e5", "g2g4", "d8h4"]);
    expect(isInCheck(position)).toBe(true);
    expect(gameResult(position)).toBe("checkmate");
    expect(legalMoves(position)).toHaveLength(0);
  });

  it("only generates replies that get the king out of check", () => {
    // Qh5 hits e8 along the h5–e8 diagonal now that the f7 pawn has advanced.
    const position = playLine(["e2e4", "f7f5", "d1h5"]);
    expect(isInCheck(position, "b")).toBe(true);

    const replies = legalMoves(position);
    expect(replies.length).toBeGreaterThan(0);
    for (const move of replies) {
      expect(isInCheck(makeMove(position, move), "b")).toBe(false);
    }
    // g7g6 blocks the diagonal and must be among them.
    expect(replies.some((move) => squareName(move.from) === "g7" && squareName(move.to) === "g6")).toBe(true);
  });

  it("allows kingside castling once the path is clear", () => {
    const position = playLine(["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6"]);
    const castle = legalMoves(position).find((move) => move.castle === "k");
    expect(castle).toBeDefined();
    const after = makeMove(position, castle!);
    expect(squareName(after.board.findIndex((p) => p?.type === "k" && p.color === "w"))).toBe("g1");
    expect(after.board[61]).toMatchObject({ type: "r", color: "w" });
    expect(after.castling.wk).toBe(false);
  });

  it("captures en passant and removes the passed pawn", () => {
    const position = playLine(["e2e4", "a7a6", "e4e5", "d7d5"]);
    expect(position.epTarget).not.toBeNull();
    const capture = legalMoves(position).find((move) => move.enPassant);
    expect(capture).toBeDefined();
    const after = makeMove(position, capture!);
    // The black d5 pawn is gone even though the capturing pawn landed on d6.
    expect(after.board.filter((piece) => piece?.color === "b" && piece.type === "p")).toHaveLength(7);
  });

  it("promotes a pawn into the chosen piece", () => {
    // The white a-pawn eats its way to a7; a8 is blocked, so it promotes by taking b8.
    const position = playLine([
      "a2a4", "b7b5", "a4b5", "a7a6", "b5a6", "h7h6", "a6a7", "h6h5",
    ]);
    const promotions = legalMoves(position).filter((move) => move.promotion);
    expect(promotions.length).toBeGreaterThan(0);
    const queening = promotions.find((move) => move.promotion === "q");
    const after = makeMove(position, queening!);
    expect(after.board[queening!.to]).toMatchObject({ type: "q", color: "w" });
  });

  it("returns a legal move from the engine at every level", () => {
    const position = initialPosition();
    for (const level of ["easy", "medium", "hard"] as const) {
      const move = bestMove(position, level);
      expect(move).not.toBeNull();
      expect(legalMoves(position).some((option) =>
        option.from === move!.from && option.to === move!.to)).toBe(true);
    }
  });

  it("takes a hanging queen rather than playing a quiet move", () => {
    // Black's queen lands on h4 where only the f3 knight can reach it, undefended.
    const position = playLine(["e2e4", "e7e5", "g1f3", "d8h4"]);
    const move = bestMove(position, "hard");
    expect(move?.captured?.type).toBe("q");
    expect(squareName(move!.to)).toBe("h4");
  });
});
