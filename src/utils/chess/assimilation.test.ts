import { describe, it, expect } from "vitest";
import { getPieceCapabilities, applyAssimilationCapture } from "./assimilation";
import { makePiece } from "../../test/helpers";

describe("getPieceCapabilities", () => {
  it("returns only the base type for a piece without acquiredTypes", () => {
    const pawn = makePiece("white", "pawn", 0, 6);
    expect(getPieceCapabilities(pawn)).toEqual(["pawn"]);
  });

  it("returns only the base type for a piece with an empty acquiredTypes array", () => {
    const rook = makePiece("black", "rook", 0, 0, { acquiredTypes: [] });
    // empty array is treated like absent (no extra capabilities)
    expect(getPieceCapabilities(rook)).toEqual(["rook"]);
  });

  it("returns the base type first followed by acquired types", () => {
    const pawn = makePiece("white", "pawn", 3, 4, {
      acquiredTypes: ["rook", "bishop"],
    });
    expect(getPieceCapabilities(pawn)).toEqual(["pawn", "rook", "bishop"]);
  });

  it("deduplicates when acquiredTypes contains the base type", () => {
    const rook = makePiece("black", "rook", 2, 2, {
      acquiredTypes: ["rook", "queen"],
    });
    expect(getPieceCapabilities(rook)).toEqual(["rook", "queen"]);
  });
});

describe("applyAssimilationCapture", () => {
  it("makes the capturer gain the captured piece's type", () => {
    const pawn = makePiece("white", "pawn", 3, 3);
    const rook = makePiece("black", "rook", 3, 3);
    const result = applyAssimilationCapture(pawn, rook);
    expect(result.acquiredTypes).toEqual(["rook"]);
  });

  it("transitively gains the captured piece's acquiredTypes", () => {
    const pawn = makePiece("white", "pawn", 3, 3);
    const rook = makePiece("black", "rook", 3, 3, {
      acquiredTypes: ["bishop"],
    });
    const result = applyAssimilationCapture(pawn, rook);
    expect(result.acquiredTypes).toEqual(["rook", "bishop"]);
  });

  it("deduplicates types already acquired by the capturer", () => {
    const pawn = makePiece("white", "pawn", 3, 3, { acquiredTypes: ["rook"] });
    const rook = makePiece("black", "rook", 3, 3);
    const result = applyAssimilationCapture(pawn, rook);
    expect(result.acquiredTypes).toEqual(["rook"]);
  });

  it("excludes the capturer's own base type from acquiredTypes", () => {
    const knight = makePiece("white", "knight", 4, 4);
    const queen = makePiece("black", "queen", 4, 4, {
      acquiredTypes: ["knight"],
    });
    const result = applyAssimilationCapture(knight, queen);
    expect(result.acquiredTypes).toEqual(["queen"]);
  });

  it("omits the acquiredTypes field entirely when capturing a piece of the same type", () => {
    const whitePawn = makePiece("white", "pawn", 3, 3);
    const blackPawn = makePiece("black", "pawn", 3, 3);
    const result = applyAssimilationCapture(whitePawn, blackPawn);
    // Source spreads `{}` when merged is empty, so the key is absent (not an empty array)
    expect(result.acquiredTypes).toBeUndefined();
    expect("acquiredTypes" in result).toBe(false);
  });

  it("keeps an existing acquired type when capturing a piece of the capturer's own type", () => {
    const pawn = makePiece("white", "pawn", 3, 3, { acquiredTypes: ["rook"] });
    const blackPawn = makePiece("black", "pawn", 3, 3);
    const result = applyAssimilationCapture(pawn, blackPawn);
    expect(result.acquiredTypes).toEqual(["rook"]);
  });

  it("accumulates correctly over chained captures", () => {
    const pawn = makePiece("white", "pawn", 3, 3);
    const rook = makePiece("black", "rook", 3, 3);
    const afterFirst = applyAssimilationCapture(pawn, rook);
    expect(afterFirst.acquiredTypes).toEqual(["rook"]);

    const bishop = makePiece("black", "bishop", 4, 4, {
      acquiredTypes: ["queen"],
    });
    const afterSecond = applyAssimilationCapture(afterFirst, bishop);
    expect(afterSecond.acquiredTypes).toEqual(["rook", "bishop", "queen"]);
  });

  // BUG-015: "king" must never be acquired — capturing a king ends the game,
  // but a piece must not gain king movement in the meantime (or inherit it
  // from a corrupted acquiredTypes chain).
  it("does not acquire 'king' when capturing a king (BUG-015 fixed)", () => {
    const pawn = makePiece("white", "pawn", 3, 3);
    const king = makePiece("black", "king", 3, 3);
    const result = applyAssimilationCapture(pawn, king);
    expect(result.acquiredTypes).toBeUndefined();
    expect("acquiredTypes" in result).toBe(false);
  });

  it("does not propagate 'king' from the captured piece's acquiredTypes (BUG-015 fixed)", () => {
    const pawn = makePiece("white", "pawn", 3, 3);
    const rook = makePiece("black", "rook", 3, 3, {
      acquiredTypes: ["king", "bishop"],
    });
    const result = applyAssimilationCapture(pawn, rook);
    expect(result.acquiredTypes).toEqual(["rook", "bishop"]);
  });

  it("keeps the capturer's id, color, type and position", () => {
    const pawn = makePiece("white", "pawn", 2, 5, { id: "capturer-1" });
    const queen = makePiece("black", "queen", 2, 5);
    const result = applyAssimilationCapture(pawn, queen);
    expect(result.id).toBe("capturer-1");
    expect(result.color).toBe("white");
    expect(result.type).toBe("pawn");
    expect(result.position).toEqual({ x: 2, y: 5 });
  });
});
