import { describe, it, expect } from "vitest";
import { detectLegendaryPattern } from "./legendaryPatterns";
import type { Piece } from "../../types/chess";
import {
  ALL_RANDOM,
  ASSIMILATION,
  BORDERLESS,
  CLASSIC,
  makePiece,
  pos,
} from "../../test/helpers";

// Coordinates reminder: white back rank y=7, black back rank y=0, files a=0..h=7.

/** Back-rank mate in 1: Ra1-a8# against a king boxed in by its own pawns. */
function backRankMatePieces(): Piece[] {
  return [
    makePiece("white", "rook", 0, 7), // Ra1
    makePiece("white", "king", 4, 7, { hasMoved: true }), // Ke1
    makePiece("black", "king", 6, 0, { hasMoved: true }), // Kg8
    makePiece("black", "pawn", 5, 1), // f7
    makePiece("black", "pawn", 6, 1), // g7
    makePiece("black", "pawn", 7, 1), // h7
  ];
}

describe("detectLegendaryPattern — mode gating", () => {
  it("returns null in special modes even on a mate-in-1 position", () => {
    const pieces = backRankMatePieces();
    expect(detectLegendaryPattern(pieces, "white", BORDERLESS)).toBeNull();
    expect(detectLegendaryPattern(pieces, "white", ALL_RANDOM)).toBeNull();
    expect(detectLegendaryPattern(pieces, "white", ASSIMILATION)).toBeNull();
  });
});

describe("detectLegendaryPattern — no pattern", () => {
  it("returns null on a quiet position", () => {
    const pieces = [
      makePiece("white", "king", 4, 7, { hasMoved: true }),
      makePiece("white", "pawn", 0, 6), // a2
      makePiece("black", "king", 4, 0, { hasMoved: true }),
      makePiece("black", "pawn", 0, 1), // a7
    ];
    expect(detectLegendaryPattern(pieces, "white", CLASSIC)).toBeNull();
  });

  it("returns null when the only mate-in-1 is an unnamed generic mate", () => {
    // NOTE: classifyMate returns "" for mates matching no named geometry, and
    // Phase 1 skips those — so a position whose only mates are generic
    // queen-edge mates (Qb5#, also Qa1#/Qa2# ladder mates) yields null.
    const pieces = [
      makePiece("white", "queen", 1, 7), // Qb1
      makePiece("white", "king", 2, 3, { hasMoved: true }), // Kc5
      makePiece("black", "king", 0, 3, { hasMoved: true }), // Ka5
    ];
    expect(detectLegendaryPattern(pieces, "white", CLASSIC)).toBeNull();
  });
});

describe("detectLegendaryPattern — mate-in-1 classification", () => {
  it("detects a back-rank mate (Ra8#)", () => {
    const result = detectLegendaryPattern(backRankMatePieces(), "white", CLASSIC);
    expect(result).toEqual({
      patternId: "backrankmate",
      type: "mate",
      movesAway: 1,
      pieceType: "rook",
      move: { from: pos(0, 7), to: pos(0, 0) },
    });
  });

  it("detects a smothered mate (Nf7#)", () => {
    // Black king on h8 fully boxed in by its own rook g8 and pawns g7/h7.
    const pieces = [
      makePiece("white", "knight", 6, 3), // Ng5
      makePiece("white", "king", 4, 7, { hasMoved: true }),
      makePiece("black", "king", 7, 0, { hasMoved: true }), // Kh8
      makePiece("black", "rook", 6, 0), // Rg8
      makePiece("black", "pawn", 6, 1), // g7
      makePiece("black", "pawn", 7, 1), // h7
    ];
    const result = detectLegendaryPattern(pieces, "white", CLASSIC);
    expect(result).toEqual({
      patternId: "smotheredmate",
      type: "mate",
      movesAway: 1,
      pieceType: "knight",
      move: { from: pos(6, 3), to: pos(5, 1) },
    });
  });

  it("detects a scholar's mate (Qxf7#)", () => {
    // Qh5xf7#, supported by the bishop on c4; king boxed in by Qd8/Bf8/d7 pawn.
    const pieces = [
      makePiece("white", "queen", 7, 3), // Qh5
      makePiece("white", "bishop", 2, 4, { hasMoved: true }), // Bc4
      makePiece("white", "king", 4, 7, { hasMoved: true }),
      makePiece("black", "king", 4, 0), // Ke8
      makePiece("black", "queen", 3, 0), // Qd8
      makePiece("black", "bishop", 5, 0), // Bf8
      makePiece("black", "pawn", 3, 1), // d7
      makePiece("black", "pawn", 4, 3), // e5
      makePiece("black", "pawn", 5, 1), // f7
    ];
    const result = detectLegendaryPattern(pieces, "white", CLASSIC);
    expect(result).toEqual({
      patternId: "scholarsmate",
      type: "mate",
      movesAway: 1,
      pieceType: "queen",
      move: { from: pos(7, 3), to: pos(5, 1) },
    });
  });

  it("detects an Arabian mate (Nf7# double check with Ra8)", () => {
    // Ra8 gives check on the back rank; Nd8-f7 both checks h8 and covers
    // escape squares (double check). classifyMate now considers confining
    // pieces too, so this double-check case remains detected correctly.
    const pieces = [
      makePiece("white", "rook", 0, 0, { hasMoved: true }), // Ra8
      makePiece("white", "knight", 3, 0), // Nd8
      makePiece("white", "pawn", 1, 1), // b7
      makePiece("white", "pawn", 2, 2), // c6
      makePiece("white", "pawn", 4, 2), // e6
      makePiece("white", "pawn", 6, 2), // g6
      makePiece("white", "king", 4, 6, { hasMoved: true }), // Ke2
      makePiece("black", "king", 7, 0, { hasMoved: true }), // Kh8
      makePiece("black", "pawn", 6, 1), // g7
    ];
    const result = detectLegendaryPattern(pieces, "white", CLASSIC);
    expect(result).toEqual({
      patternId: "arabianmate",
      type: "mate",
      movesAway: 1,
      pieceType: "knight",
      move: { from: pos(3, 0), to: pos(5, 1) },
    });
  });

  it("detects an Opera mate (Bg6# double check with Re1)", () => {
    // Re1 gives check; Be4-g6 both uncovers the rook and covers f7 (double
    // check). classifyMate now considers confining pieces, so this case is
    // still correctly classified as operamate.
    const pieces = [
      makePiece("white", "rook", 4, 7, { hasMoved: true }), // Re1
      makePiece("white", "bishop", 4, 4), // Be4
      makePiece("white", "king", 6, 7, { hasMoved: true }), // Kg1
      makePiece("black", "king", 4, 0, { hasMoved: true }), // Ke8
      makePiece("black", "rook", 3, 0), // Rd8
      makePiece("black", "bishop", 5, 0), // Bf8
      makePiece("black", "pawn", 3, 1), // d7
    ];
    const result = detectLegendaryPattern(pieces, "white", CLASSIC);
    expect(result).toEqual({
      patternId: "operamate",
      type: "mate",
      movesAway: 1,
      pieceType: "bishop",
      move: { from: pos(4, 4), to: pos(6, 2) },
    });
  });

  it("detects a Boden's mate (Ba6# with criss-cross bishops)", () => {
    // Bc4-a6# checks via b7; Bf4 covers b8 and c7; d8 rook and d7 pawn block
    // the king's own escape squares. Boden only needs ONE bishop attacking
    // plus two friendly bishops on opposite square colors.
    const pieces = [
      makePiece("white", "bishop", 2, 4), // Bc4 (light squares)
      makePiece("white", "bishop", 5, 4), // Bf4 (dark squares)
      makePiece("white", "king", 4, 7, { hasMoved: true }),
      makePiece("black", "king", 2, 0, { hasMoved: true }), // Kc8
      makePiece("black", "rook", 3, 0), // Rd8
      makePiece("black", "pawn", 3, 1), // d7
    ];
    const result = detectLegendaryPattern(pieces, "white", CLASSIC);
    expect(result).toEqual({
      patternId: "bodensmate",
      type: "mate",
      movesAway: 1,
      pieceType: "bishop",
      move: { from: pos(2, 4), to: pos(0, 2) },
    });
  });

  it("Lolli's mate requires pawn on f6/f3 — g2 pawn no longer triggers it (BUG-012 fixed)", () => {
    const base = () => [
      makePiece("white", "queen", 0, 7), // Qa1
      makePiece("white", "king", 4, 7, { hasMoved: true }),
      makePiece("black", "king", 6, 0, { hasMoved: true }), // Kg8
      makePiece("black", "pawn", 5, 1), // f7
      makePiece("black", "pawn", 6, 1), // g7
      makePiece("black", "pawn", 7, 1), // h7
    ];
    const withoutGPawn = detectLegendaryPattern(base(), "white", CLASSIC);
    expect(withoutGPawn?.patternId).toBe("backrankmate");

    // g2 pawn is NOT adjacent to the attack — no longer triggers Lolli
    const withGPawn = detectLegendaryPattern(
      [...base(), makePiece("white", "pawn", 6, 6)], // g2
      "white",
      CLASSIC,
    );
    expect(withGPawn?.patternId).toBe("backrankmate");

    // f6 pawn (x=5, y=2) correctly triggers Lolli's mate
    const withFPawn = detectLegendaryPattern(
      [...base(), makePiece("white", "pawn", 5, 2)], // f6
      "white",
      CLASSIC,
    );
    expect(withFPawn).toEqual({
      patternId: "lollismate",
      type: "mate",
      movesAway: 1,
      pieceType: "queen",
      move: { from: pos(0, 7), to: pos(0, 0) },
    });
  });
});

describe("detectLegendaryPattern — attack sacrifice patterns", () => {
  it("detects the Greek gift sacrifice (Bxh7)", () => {
    // Castled black king on g8, h7 pawn, Bd3 eyeing h7, Nf3 able to reach g5,
    // queen developed to e2. Ra8 prevents Qe8 from being a phase-1 mate.
    const pieces = [
      makePiece("white", "bishop", 3, 5), // Bd3
      makePiece("white", "knight", 5, 5), // Nf3
      makePiece("white", "queen", 4, 6), // Qe2 (off its starting square)
      makePiece("white", "king", 6, 7, { hasMoved: true }), // Kg1
      makePiece("black", "king", 6, 0, { hasMoved: true }), // Kg8 (castled side)
      makePiece("black", "rook", 0, 0), // Ra8
      makePiece("black", "pawn", 5, 1), // f7
      makePiece("black", "pawn", 6, 1), // g7
      makePiece("black", "pawn", 7, 1), // h7
    ];
    const result = detectLegendaryPattern(pieces, "white", CLASSIC);
    expect(result).toEqual({
      patternId: "greekgift",
      type: "attack",
      movesAway: 1,
      pieceType: "bishop",
      move: { from: pos(3, 5), to: pos(7, 1) },
    });
  });

  it("detects the Fried Liver attack (Nxf7)", () => {
    // Ng5 + Bc4 vs Nd5, black king still on e8, f7 pawn capturable.
    const pieces = [
      makePiece("white", "knight", 6, 3), // Ng5
      makePiece("white", "bishop", 2, 4), // Bc4
      makePiece("white", "king", 4, 7, { hasMoved: true }),
      makePiece("black", "king", 4, 0, { hasMoved: true }), // Ke8
      makePiece("black", "knight", 3, 3), // Nd5
      makePiece("black", "pawn", 5, 1), // f7
    ];
    const result = detectLegendaryPattern(pieces, "white", CLASSIC);
    expect(result).toEqual({
      patternId: "friedliver",
      type: "attack",
      movesAway: 1,
      pieceType: "knight",
      move: { from: pos(6, 3), to: pos(5, 1) },
    });
  });
});

describe("detectLegendaryPattern — 2-move setups", () => {
  it("detects a scholar's mate setup two moves away", () => {
    // After 1.e4 e5 2.Bc4 (bishop hasMoved, covers f7; f7 defended only by
    // the king): the queen on d1 cannot yet reach f7 but has moves that line
    // it up against f7 → movesAway 2.
    const pieces = [
      makePiece("white", "queen", 3, 7), // Qd1
      makePiece("white", "bishop", 2, 4, { hasMoved: true }), // Bc4
      makePiece("white", "pawn", 4, 4, { hasMoved: true }), // e4
      makePiece("white", "king", 4, 7), // Ke1
      makePiece("black", "king", 4, 0), // Ke8, unmoved (required)
      makePiece("black", "pawn", 4, 3), // e5
      makePiece("black", "pawn", 5, 1), // f7
    ];
    const result = detectLegendaryPattern(pieces, "white", CLASSIC);
    // Qd7 (3,1) is filtered out because the queen would be en prise next to
    // the black king. The first safe queen move that still sees f7 is Qd5 (3,3).
    expect(result).toEqual({
      patternId: "scholarsmate",
      type: "mate",
      movesAway: 2,
      pieceType: "queen",
      move: { from: pos(3, 7), to: pos(3, 3) },
    });
  });
});
