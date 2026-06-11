import { describe, expect, it } from "vitest";
import type { MoveRecord } from "../../types/chess";
import { makePiece, pos } from "../../test/helpers";
import { detectScholarsMate } from "./tactics";

// ---------------------------------------------------------------------------
// detectScholarsMate
// ---------------------------------------------------------------------------
//
// Coordinate system: y=0 = rank 8 (black back rank), y=7 = rank 1 (white back rank).
// Scholar's Mate: 1.e4 2.Qh5 3.Bc4 4.Qxf7#
//
// Ply indices (0-based, alternating white/black):
//   moves[0] = white ply 1: pawn e2(4,6)→e4(4,4)
//   moves[1] = black ply 1: any black response
//   moves[2] = white ply 2: queen →h5(7,3)
//   moves[3] = black ply 2: any black response
//   moves[4] = white ply 3: bishop →c4(2,4)
//   moves[5] = black ply 3: any black response
//   moves[6] = white ply 4: queen ×f7(5,1) capturing black pawn

/** Builds a minimal MoveRecord. */
function move(
  color: "white" | "black",
  type: "pawn" | "queen" | "bishop" | "knight" | "rook" | "king",
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  captured: ReturnType<typeof makePiece> | null = null,
): MoveRecord {
  const piece = makePiece(color, type, fromX, fromY);
  return {
    piece,
    from: pos(fromX, fromY),
    to: pos(toX, toY),
    capturedPiece: captured,
    wasPromotion: false,
  };
}

/** Returns the canonical Scholar's Mate move sequence (8 plies — 4 white + 4 black). */
function scholarsMateMoves(): MoveRecord[] {
  const blackPawn = makePiece("black", "pawn", 5, 1); // f7 pawn — captured on move 6
  return [
    move("white", "pawn",   4, 6, 4, 4),           // 0 — e2→e4
    move("black", "pawn",   4, 1, 4, 3),            // 1 — e7→e5 (any black response)
    move("white", "queen",  3, 7, 7, 3),            // 2 — Q→h5
    move("black", "knight", 1, 0, 2, 2),            // 3 — Nc6 (any black response)
    move("white", "bishop", 5, 7, 2, 4),            // 4 — B→c4
    move("black", "knight", 6, 0, 5, 2),            // 5 — Nf6 (any black response)
    move("white", "queen",  7, 3, 5, 1, blackPawn), // 6 — Q×f7#
    move("black", "king",   4, 0, 5, 0),            // 7 — Kf8 (moot — game is over)
  ];
}

describe("detectScholarsMate — nominal (Scholar's Mate detected)", () => {
  it("returns true for the canonical Scholar's Mate sequence", () => {
    expect(detectScholarsMate(scholarsMateMoves())).toBe(true);
  });

  it("works when there are more than 7 moves in the list", () => {
    const moves = scholarsMateMoves();
    // Add extra plies; the function should still detect the pattern in the first 7
    moves.push(move("white", "rook", 7, 7, 7, 5));
    moves.push(move("black", "pawn", 3, 1, 3, 3));
    expect(detectScholarsMate(moves)).toBe(true);
  });
});

describe("detectScholarsMate — false negatives (Scholar's Mate NOT detected)", () => {
  it("returns false when the move list has fewer than 7 entries", () => {
    const moves = scholarsMateMoves().slice(0, 6);
    expect(detectScholarsMate(moves)).toBe(false);
  });

  it("returns false when white pawn does not open with e4", () => {
    const moves = scholarsMateMoves();
    moves[0] = move("white", "pawn", 3, 6, 3, 4); // d4 instead of e4
    expect(detectScholarsMate(moves)).toBe(false);
  });

  it("returns false when the queen goes to the wrong square on ply 2", () => {
    const moves = scholarsMateMoves();
    moves[2] = move("white", "queen", 3, 7, 6, 4); // Qg4 instead of Qh5
    expect(detectScholarsMate(moves)).toBe(false);
  });

  it("returns false when the bishop goes to the wrong square on ply 3", () => {
    const moves = scholarsMateMoves();
    moves[4] = move("white", "bishop", 5, 7, 4, 6); // Bf1-e2 instead of c4
    expect(detectScholarsMate(moves)).toBe(false);
  });

  it("returns false when the queen ends on the right square but captures nothing", () => {
    const moves = scholarsMateMoves();
    // Final queen move to f7 but no capture (capturedPiece = null)
    moves[6] = move("white", "queen", 7, 3, 5, 1, null);
    expect(detectScholarsMate(moves)).toBe(false);
  });

  it("returns false when the final queen square is wrong (not f7)", () => {
    const moves = scholarsMateMoves();
    const blackPawn = makePiece("black", "pawn", 5, 2);
    moves[6] = move("white", "queen", 7, 3, 5, 2, blackPawn); // f6, not f7
    expect(detectScholarsMate(moves)).toBe(false);
  });

  it("returns false when the white pawn starts from the wrong file", () => {
    const moves = scholarsMateMoves();
    moves[0] = move("white", "pawn", 3, 6, 3, 4); // d-pawn instead of e-pawn
    expect(detectScholarsMate(moves)).toBe(false);
  });

  it("returns false for an empty move list", () => {
    expect(detectScholarsMate([])).toBe(false);
  });

  it("returns false when ply 0 is a black move (color mismatch)", () => {
    const moves = scholarsMateMoves();
    moves[0] = move("black", "pawn", 4, 6, 4, 4); // same coords, wrong color
    expect(detectScholarsMate(moves)).toBe(false);
  });
});
