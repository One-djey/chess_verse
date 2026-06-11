import { describe, it, expect } from "vitest";
import { computeCastlingRights } from "./castling";
import type { Piece } from "../../types/chess";

function makePiece(overrides: Partial<Piece> & Pick<Piece, "id" | "type" | "color" | "position">): Piece {
  return { hasMoved: false, ...overrides };
}

const WHITE_KING = makePiece({ id: "wk0", type: "king", color: "white", position: { x: 4, y: 7 } });
const BLACK_KING = makePiece({ id: "bk0", type: "king", color: "black", position: { x: 4, y: 0 } });
const WHITE_ROOK_H = makePiece({ id: "wr0", type: "rook", color: "white", position: { x: 7, y: 7 } }); // h1 — kingside
const WHITE_ROOK_A = makePiece({ id: "wr1", type: "rook", color: "white", position: { x: 0, y: 7 } }); // a1 — queenside
const BLACK_ROOK_H = makePiece({ id: "br0", type: "rook", color: "black", position: { x: 7, y: 0 } }); // h8 — kingside
const BLACK_ROOK_A = makePiece({ id: "br1", type: "rook", color: "black", position: { x: 0, y: 0 } }); // a8 — queenside

describe("computeCastlingRights", () => {
  it("returns KQkq when no king or rook has moved (classic start)", () => {
    const pieces = [WHITE_KING, BLACK_KING, WHITE_ROOK_H, WHITE_ROOK_A, BLACK_ROOK_H, BLACK_ROOK_A];
    expect(computeCastlingRights(pieces)).toBe("KQkq");
  });

  it("returns '-' when there are no rooks at all", () => {
    const pieces = [WHITE_KING, BLACK_KING];
    expect(computeCastlingRights(pieces)).toBe("-");
  });

  it("returns '-' when there are no pieces at all", () => {
    expect(computeCastlingRights([])).toBe("-");
  });

  it("removes white rights when the white king has moved", () => {
    const movedWhiteKing: Piece = { ...WHITE_KING, hasMoved: true };
    const pieces = [movedWhiteKing, BLACK_KING, WHITE_ROOK_H, WHITE_ROOK_A, BLACK_ROOK_H, BLACK_ROOK_A];
    const rights = computeCastlingRights(pieces);
    expect(rights).not.toContain("K");
    expect(rights).not.toContain("Q");
    expect(rights).toContain("k");
    expect(rights).toContain("q");
  });

  it("removes 'K' (white kingside) when white h1 rook has moved, keeps Q, k, q", () => {
    const movedHRook: Piece = { ...WHITE_ROOK_H, hasMoved: true };
    const pieces = [WHITE_KING, BLACK_KING, movedHRook, WHITE_ROOK_A, BLACK_ROOK_H, BLACK_ROOK_A];
    const rights = computeCastlingRights(pieces);
    expect(rights).not.toContain("K");
    expect(rights).toContain("Q");
    expect(rights).toContain("k");
    expect(rights).toContain("q");
  });

  it("removes 'Q' (white queenside) when white a1 rook has moved", () => {
    const movedARook: Piece = { ...WHITE_ROOK_A, hasMoved: true };
    const pieces = [WHITE_KING, BLACK_KING, WHITE_ROOK_H, movedARook, BLACK_ROOK_H, BLACK_ROOK_A];
    const rights = computeCastlingRights(pieces);
    expect(rights).toContain("K");
    expect(rights).not.toContain("Q");
    expect(rights).toContain("k");
    expect(rights).toContain("q");
  });

  it("removes black rights when the black king has moved", () => {
    const movedBlackKing: Piece = { ...BLACK_KING, hasMoved: true };
    const pieces = [WHITE_KING, movedBlackKing, WHITE_ROOK_H, WHITE_ROOK_A, BLACK_ROOK_H, BLACK_ROOK_A];
    const rights = computeCastlingRights(pieces);
    expect(rights).toContain("K");
    expect(rights).toContain("Q");
    expect(rights).not.toContain("k");
    expect(rights).not.toContain("q");
  });

  it("returns '-' when all kings and rooks have moved", () => {
    const pieces = [
      { ...WHITE_KING, hasMoved: true },
      { ...BLACK_KING, hasMoved: true },
      { ...WHITE_ROOK_H, hasMoved: true },
      { ...WHITE_ROOK_A, hasMoved: true },
      { ...BLACK_ROOK_H, hasMoved: true },
      { ...BLACK_ROOK_A, hasMoved: true },
    ];
    expect(computeCastlingRights(pieces)).toBe("-");
  });

  it("ignores rooks not at corner squares (e.g. a rook that has moved to a different square)", () => {
    // A rook at x=3,y=7 (not the original h1 or a1) should not grant castling rights
    const rookElsewhere: Piece = makePiece({ id: "wr_moved", type: "rook", color: "white", position: { x: 3, y: 7 } });
    const pieces = [WHITE_KING, BLACK_KING, rookElsewhere];
    expect(computeCastlingRights(pieces)).toBe("-");
  });

  it("returns only 'k' when only black kingside rook is unmoved", () => {
    const pieces = [
      { ...WHITE_KING, hasMoved: true },
      BLACK_KING,
      { ...BLACK_ROOK_H, hasMoved: false },
      { ...BLACK_ROOK_A, hasMoved: true },
    ];
    expect(computeCastlingRights(pieces)).toBe("k");
  });
});
