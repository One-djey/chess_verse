import { describe, it, expect } from "vitest";
import { getSmartFallbackMove } from "./aiFallback";
import { isInCheck, normalizePos, getValidMoves } from "./moves";
import { makePiece, pos, CLASSIC, BORDERLESS, includesPos } from "../../test/helpers";
import type { Piece, Position } from "../../types/chess";

/** Simulates a { from, to } move and returns the resulting piece list. */
function simulateMove(
  pieces: Piece[],
  from: Position,
  to: Position,
): Piece[] {
  const norm = normalizePos(to.x, to.y);
  return pieces
    .filter((p) => !(p.position.x === norm.x && p.position.y === norm.y))
    .map((p) =>
      p.position.x === from.x && p.position.y === from.y
        ? { ...p, position: norm }
        : p,
    );
}

describe("getSmartFallbackMove — no legal moves", () => {
  it("returns null when black is stalemated", () => {
    // Black king a8-corner box: queen at (2,1) covers (0,1), (1,1), (1,0)
    // but does not attack (0,0) itself.
    const pieces = [
      makePiece("black", "king", 0, 0),
      makePiece("white", "queen", 2, 1),
      makePiece("white", "king", 4, 4),
    ];
    expect(isInCheck("black", pieces, CLASSIC)).toBe(false);
    expect(getSmartFallbackMove(pieces, CLASSIC)).toBeNull();
  });

  it("returns null when black is checkmated", () => {
    // Queen at (1,1) gives check and covers all escape squares;
    // white king at (2,2) protects the queen from being captured.
    const pieces = [
      makePiece("black", "king", 0, 0),
      makePiece("white", "queen", 1, 1),
      makePiece("white", "king", 2, 2),
    ];
    expect(isInCheck("black", pieces, CLASSIC)).toBe(true);
    expect(getSmartFallbackMove(pieces, CLASSIC)).toBeNull();
  });
});

describe("getSmartFallbackMove — normal turn priority chain", () => {
  it("prefers a safe capture over safe quiet moves", () => {
    // Black rook can take an undefended white pawn; everything else is quiet.
    const pieces = [
      makePiece("black", "king", 4, 0),
      makePiece("white", "king", 4, 7),
      makePiece("black", "rook", 0, 0),
      makePiece("white", "pawn", 0, 5),
    ];
    const move = getSmartFallbackMove(pieces, CLASSIC);
    expect(move).toEqual({ from: pos(0, 0), to: pos(0, 5) });
  });

  it("picks the highest-value capture among safe captures", () => {
    // The rook can take either the white queen (9) or the white pawn (1).
    const pieces = [
      makePiece("black", "king", 7, 7),
      makePiece("white", "king", 4, 7),
      makePiece("black", "rook", 0, 0),
      makePiece("white", "queen", 0, 5),
      makePiece("white", "pawn", 3, 0),
    ];
    const move = getSmartFallbackMove(pieces, CLASSIC);
    expect(move).toEqual({ from: pos(0, 0), to: pos(0, 5) });
  });

  it("prefers the lowest-value mover among equal captures", () => {
    // Both the black pawn (1) and the black queen (9) can safely capture
    // the same white pawn — the cheap pawn must be chosen.
    const pieces = [
      makePiece("black", "king", 0, 0),
      makePiece("white", "king", 7, 7),
      makePiece("black", "queen", 3, 1),
      makePiece("black", "pawn", 2, 3),
      makePiece("white", "pawn", 3, 4),
    ];
    const move = getSmartFallbackMove(pieces, CLASSIC);
    expect(move).toEqual({ from: pos(2, 3), to: pos(3, 4) });
  });

  it("prefers a safe quiet move over a risky capture", () => {
    // The only capture (knight takes pawn at (3,4)) is defended by the white
    // pawn at (4,5); the black pawn has a single safe quiet push instead.
    const pieces = [
      makePiece("black", "king", 0, 0),
      makePiece("white", "king", 7, 7),
      makePiece("black", "pawn", 0, 4),
      makePiece("black", "knight", 5, 5),
      makePiece("white", "pawn", 3, 4),
      makePiece("white", "pawn", 4, 5),
    ];
    const move = getSmartFallbackMove(pieces, CLASSIC);
    expect(move).toEqual({ from: pos(0, 4), to: pos(0, 5) });
  });

  it("prefers a risky capture over a risky quiet move", () => {
    // Black king is boxed in (no legal king moves, not in check).
    // The knight's only moves are a defended capture at (5,6) and a quiet
    // move at (6,5) attacked by the white queen — capture must win.
    const pieces = [
      makePiece("black", "king", 0, 0),
      makePiece("white", "queen", 2, 1),
      makePiece("white", "king", 2, 3),
      makePiece("black", "knight", 7, 7),
      makePiece("white", "pawn", 5, 6),
      makePiece("white", "pawn", 6, 7),
    ];
    expect(isInCheck("black", pieces, CLASSIC)).toBe(false);
    const move = getSmartFallbackMove(pieces, CLASSIC);
    expect(move).toEqual({ from: pos(7, 7), to: pos(5, 6) });
  });
});

describe("getSmartFallbackMove — check priority chain", () => {
  it("prefers a non-king blocking move over moving the king out of check", () => {
    // White rook checks along the e-file; the black rook can block at (4,2)
    // (a risky block) while the king also has escape squares.
    const pieces = [
      makePiece("black", "king", 4, 0),
      makePiece("white", "rook", 4, 5),
      makePiece("white", "king", 4, 7),
      makePiece("black", "rook", 0, 2),
    ];
    expect(isInCheck("black", pieces, CLASSIC)).toBe(true);
    const move = getSmartFallbackMove(pieces, CLASSIC);
    expect(move).toEqual({ from: pos(0, 2), to: pos(4, 2) });
    // The block must actually resolve the check.
    const after = simulateMove(pieces, move!.from, move!.to);
    expect(isInCheck("black", after, CLASSIC)).toBe(false);
  });

  it("prefers a non-king capture of the checking piece over a king move", () => {
    // The black knight can capture the checking rook safely at (4,5).
    const pieces = [
      makePiece("black", "king", 4, 0),
      makePiece("white", "rook", 4, 5),
      makePiece("white", "king", 4, 7),
      makePiece("black", "knight", 2, 4),
    ];
    expect(isInCheck("black", pieces, CLASSIC)).toBe(true);
    const move = getSmartFallbackMove(pieces, CLASSIC);
    expect(move).toEqual({ from: pos(2, 4), to: pos(4, 5) });
    const after = simulateMove(pieces, move!.from, move!.to);
    expect(isInCheck("black", after, CLASSIC)).toBe(false);
  });

  it("returns a king move when only the king can resolve the check", () => {
    const pieces = [
      makePiece("black", "king", 4, 0),
      makePiece("white", "rook", 4, 5),
      makePiece("white", "king", 0, 7),
    ];
    expect(isInCheck("black", pieces, CLASSIC)).toBe(true);
    const move = getSmartFallbackMove(pieces, CLASSIC);
    expect(move).not.toBeNull();
    expect(move!.from).toEqual(pos(4, 0));
    // The king must step off the checked file and the check must be resolved.
    expect(move!.to.x).not.toBe(4);
    const after = simulateMove(pieces, move!.from, move!.to);
    expect(isInCheck("black", after, CLASSIC)).toBe(false);
  });
});

describe("getSmartFallbackMove — borderless mode", () => {
  it("finds a capture only reachable by wrapping around the board edge", () => {
    // The rook's path to the right is blocked by its own pawn at (5,4);
    // the only way to capture the white pawn at (7,4) is leftwards through
    // the edge: (2,4) → (-1,4), which normalizes to (7,4).
    const blackRook = makePiece("black", "rook", 2, 4);
    const pieces = [
      makePiece("black", "king", 4, 0),
      makePiece("white", "king", 4, 7),
      blackRook,
      makePiece("black", "pawn", 5, 4),
      makePiece("white", "pawn", 7, 4),
    ];
    const move = getSmartFallbackMove(pieces, BORDERLESS);
    expect(move).not.toBeNull();
    expect(move!.from).toEqual(pos(2, 4));
    // getSmartFallbackMove now normalizes the destination before returning.
    expect(move!.to).toEqual(pos(7, 4));
    // The move is legal under wrap rules.
    const rookMoves = getValidMoves(blackRook, pieces, BORDERLESS);
    expect(includesPos(rookMoves, -1, 4)).toBe(true);
  });
});

describe("getSmartFallbackMove — exhaustive candidate scan", () => {
  it("finds the best capture even when it belongs to the last piece scanned", () => {
    // Only the knight (last black piece in the array) can capture the
    // undefended white queen; earlier pieces only have quiet moves.
    const pieces = [
      makePiece("white", "king", 0, 0),
      makePiece("white", "queen", 3, 2),
      makePiece("black", "king", 0, 7),
      makePiece("black", "pawn", 5, 6),
      makePiece("black", "pawn", 6, 6),
      makePiece("black", "knight", 1, 1),
    ];
    const move = getSmartFallbackMove(pieces, CLASSIC);
    expect(move).toEqual({ from: pos(1, 1), to: pos(3, 2) });
  });
});
