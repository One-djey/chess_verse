import { describe, it, expect } from "vitest";
import { SKINS, getPieceImageSrc, resolveEffectivePieceSkin } from "./pieceImage";

describe("getPieceImageSrc", () => {
  it("resolves classic skin images as .png", () => {
    expect(getPieceImageSrc("white", "king", "classic")).toBe(
      "/ressources/pieces/classic/white_king.png",
    );
    expect(getPieceImageSrc("black", "pawn", "classic")).toBe(
      "/ressources/pieces/classic/black_pawn.png",
    );
  });

  it("resolves fantasy skin images as .webp", () => {
    expect(getPieceImageSrc("black", "queen", "fantasy")).toBe(
      "/ressources/pieces/fantasy/black_queen.webp",
    );
    expect(getPieceImageSrc("white", "knight", "fantasy")).toBe(
      "/ressources/pieces/fantasy/white_knight.webp",
    );
  });
});

describe("SKINS", () => {
  it("contains all entries with the expected shape", () => {
    expect(SKINS).toHaveLength(6);
    expect(SKINS.map((s) => s.id)).toEqual([
      "classic",
      "fantasy",
      "zombie",
      "robot",
      "legends",
      "alien",
    ]);
    expect(SKINS).toEqual([
      { id: "classic", label: "Classic", ext: "png" },
      { id: "fantasy", label: "Fantasy", ext: "webp" },
      { id: "zombie", label: "Zombie", ext: "png" },
      { id: "robot", label: "Robot", ext: "png" },
      { id: "legends", label: "Legends", ext: "png" },
      { id: "alien", label: "Alien", ext: "png" },
    ]);
  });

  it("resolves legends skin images as .png", () => {
    expect(getPieceImageSrc("white", "king", "legends")).toBe(
      "/ressources/pieces/legends/white_king.png",
    );
    expect(getPieceImageSrc("black", "pawn", "legends")).toBe(
      "/ressources/pieces/legends/black_pawn.png",
    );
  });

  it("resolves zombie skin images as .png", () => {
    expect(getPieceImageSrc("white", "king", "zombie")).toBe(
      "/ressources/pieces/zombie/white_king.png",
    );
    expect(getPieceImageSrc("black", "pawn", "zombie")).toBe(
      "/ressources/pieces/zombie/black_pawn.png",
    );
  });

  it("resolves robot skin images as .png", () => {
    expect(getPieceImageSrc("white", "king", "robot")).toBe(
      "/ressources/pieces/robot/white_king.png",
    );
    expect(getPieceImageSrc("black", "pawn", "robot")).toBe(
      "/ressources/pieces/robot/black_pawn.png",
    );
  });
});

describe("resolveEffectivePieceSkin (BUG-016)", () => {
  it("falls back to classic when unset and no forced skin", () => {
    expect(resolveEffectivePieceSkin(null, undefined)).toBe("classic");
  });

  it("applies the mode's forced skin for a brand-new visitor (unset preference)", () => {
    expect(resolveEffectivePieceSkin(null, "zombie")).toBe("zombie");
  });

  it("lets an explicit 'classic' choice override the forced skin (accessibility)", () => {
    expect(resolveEffectivePieceSkin("classic", "zombie")).toBe("classic");
  });

  it("applies the forced skin over any other explicit user choice", () => {
    expect(resolveEffectivePieceSkin("fantasy", "zombie")).toBe("zombie");
  });

  it("keeps the explicit user choice when the mode has no forced skin", () => {
    expect(resolveEffectivePieceSkin("fantasy", undefined)).toBe("fantasy");
  });
});
