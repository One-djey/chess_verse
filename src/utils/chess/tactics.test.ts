import { describe, expect, it } from "vitest";
import type { MoveRecord } from "../../types/chess";
import { makePiece, pos, CLASSIC } from "../../test/helpers";
import { detectScholarsMate, detectTactic, type MoveContext } from "./tactics";

// ---------------------------------------------------------------------------
// detectScholarsMate
// ---------------------------------------------------------------------------
//
// Coordinate system: y=0 = rank 8 (black back rank), y=7 = rank 1 (white back rank).
// Scholar's Mate requires exactly 4 white moves, with the last white move being
// the queen capturing on f7 (x=5, y=1).
//
// Canonical sequence: 1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6 4.Qxf7#
// Variant:            1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6 4.Qxf7#

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

/** Canonical Scholar's Mate: 1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6 4.Qxf7# (7 plies). */
function scholarsMateMoves(): MoveRecord[] {
  const blackPawn = makePiece("black", "pawn", 5, 1); // f7 pawn — captured on move 6
  return [
    move("white", "pawn", 4, 6, 4, 4), // 0 — e2→e4
    move("black", "pawn", 4, 1, 4, 3), // 1 — e7→e5
    move("white", "queen", 3, 7, 7, 3), // 2 — Q→h5
    move("black", "knight", 1, 0, 2, 2), // 3 — Nc6
    move("white", "bishop", 5, 7, 2, 4), // 4 — B→c4
    move("black", "knight", 6, 0, 5, 2), // 5 — Nf6
    move("white", "queen", 7, 3, 5, 1, blackPawn), // 6 — Q×f7#
  ];
}

/** Variant: Bc4 played before Qh5 — 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6 4.Qxf7# */
function scholarsMateBc4FirstMoves(): MoveRecord[] {
  const blackPawn = makePiece("black", "pawn", 5, 1);
  return [
    move("white", "pawn", 4, 6, 4, 4), // 0 — e2→e4
    move("black", "pawn", 4, 1, 4, 3), // 1 — e7→e5
    move("white", "bishop", 5, 7, 2, 4), // 2 — B→c4 (before Qh5)
    move("black", "knight", 1, 0, 2, 2), // 3 — Nc6
    move("white", "queen", 3, 7, 7, 3), // 4 — Q→h5
    move("black", "knight", 6, 0, 5, 2), // 5 — Nf6
    move("white", "queen", 7, 3, 5, 1, blackPawn), // 6 — Q×f7#
  ];
}

describe("detectScholarsMate — nominal (Scholar's Mate detected)", () => {
  it("returns true for the canonical Scholar's Mate sequence (Qh5 before Bc4)", () => {
    expect(detectScholarsMate(scholarsMateMoves())).toBe(true);
  });

  it("returns true for the Bc4-before-Qh5 variant", () => {
    expect(detectScholarsMate(scholarsMateBc4FirstMoves())).toBe(true);
  });

  it("returns true when extra black plies follow the checkmate", () => {
    const moves = scholarsMateMoves();
    // Append extra black and white plies (game technically over but list is longer)
    moves.push(move("black", "king", 4, 0, 5, 0));
    moves.push(move("black", "pawn", 3, 1, 3, 3));
    // whiteMoves still === 4, so still true
    expect(detectScholarsMate(moves)).toBe(true);
  });
});

describe("detectScholarsMate — false negatives (Scholar's Mate NOT detected)", () => {
  it("returns false when the move list has fewer than 7 entries", () => {
    expect(detectScholarsMate(scholarsMateMoves().slice(0, 6))).toBe(false);
  });

  it("returns false for an empty move list", () => {
    expect(detectScholarsMate([])).toBe(false);
  });

  it("returns false when the final queen square is not f7 (e.g. f6)", () => {
    const moves = scholarsMateMoves();
    const blackPawn = makePiece("black", "pawn", 5, 2);
    moves[6] = move("white", "queen", 7, 3, 5, 2, blackPawn); // f6, not f7
    expect(detectScholarsMate(moves)).toBe(false);
  });

  it("returns false when the queen reaches f7 but makes no capture", () => {
    const moves = scholarsMateMoves();
    moves[6] = move("white", "queen", 7, 3, 5, 1, null);
    expect(detectScholarsMate(moves)).toBe(false);
  });

  it("returns false when a non-queen piece delivers the final move on f7", () => {
    const moves = scholarsMateMoves();
    const blackPawn = makePiece("black", "pawn", 5, 1);
    moves[6] = move("white", "bishop", 2, 4, 5, 1, blackPawn); // bishop, not queen
    expect(detectScholarsMate(moves)).toBe(false);
  });

  it("returns false when white plays 5 moves (not a Scholar's Mate)", () => {
    const blackPawn = makePiece("black", "pawn", 5, 1);
    const moves: MoveRecord[] = [
      move("white", "pawn", 4, 6, 4, 4),
      move("black", "pawn", 4, 1, 4, 3),
      move("white", "queen", 3, 7, 7, 3),
      move("black", "knight", 1, 0, 2, 2),
      move("white", "bishop", 5, 7, 2, 4),
      move("black", "knight", 6, 0, 5, 2),
      move("white", "rook", 7, 7, 7, 5), // extra white move
      move("black", "pawn", 3, 1, 3, 3),
      move("white", "queen", 7, 3, 5, 1, blackPawn), // queen on f7 — but it's the 5th white move
    ];
    expect(detectScholarsMate(moves)).toBe(false);
  });

  it("returns false when white plays 3 moves (too few)", () => {
    const blackPawn = makePiece("black", "pawn", 5, 1);
    const moves: MoveRecord[] = [
      move("white", "pawn", 4, 6, 4, 4),
      move("black", "pawn", 4, 1, 4, 3),
      move("white", "queen", 3, 7, 7, 3),
      move("black", "knight", 1, 0, 2, 2),
      move("white", "queen", 7, 3, 5, 1, blackPawn), // only 3 white moves
      move("black", "knight", 6, 0, 5, 2),
    ];
    expect(detectScholarsMate(moves)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// detectTactic — enPassant tag
// ---------------------------------------------------------------------------

describe("detectTactic — enPassant", () => {
  function makeCtx(overrides: Partial<MoveContext>): MoveContext {
    const pawn = makePiece("white", "pawn", 4, 3);
    return {
      piece: pawn,
      from: pos(4, 3),
      to: pos(3, 2),
      capturedPiece: null,
      wasPromotion: false,
      wasCastling: false,
      wasEnPassant: false,
      prevPieces: [pawn],
      nextPieces: [{ ...pawn, position: pos(3, 2) }],
      gameMode: CLASSIC,
      ...overrides,
    };
  }

  it("returns 'enPassant' when wasEnPassant is true", () => {
    expect(detectTactic(makeCtx({ wasEnPassant: true }))).toBe("enPassant");
  });

  it("returns null (not enPassant) when wasEnPassant is false or omitted", () => {
    expect(detectTactic(makeCtx({ wasEnPassant: false }))).toBeNull();
    expect(detectTactic(makeCtx({}))).toBeNull();
  });

  it("check overrides enPassant (en passant giving check annotates as 'check')", () => {
    // Place the white pawn such that after ep capture to (3,2), black king at (3,0)
    // is diagonally forward — not in check from a pawn. Instead we simulate check
    // by making nextPieces contain a black king that would be in check.
    // Simplest: the moved pawn ends on a square that directly attacks the black king.
    // White pawn at (3,2) attacks (2,1) and (4,1) diagonally. Put black king at (2,1).
    const pawn = makePiece("white", "pawn", 4, 3);
    const blackKing = makePiece("black", "king", 2, 1);
    const ctx = makeCtx({
      wasEnPassant: true,
      nextPieces: [{ ...pawn, position: pos(3, 2) }, blackKing],
    });
    const tag = detectTactic(ctx);
    expect(tag === "check" || tag === "discoveredCheck").toBe(true);
  });
});
