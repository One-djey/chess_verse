import { describe, it, expect } from "vitest";
import { SKINS, getPieceImageSrc } from "./pieceImage";

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
  it("contains the classic and fantasy entries with the expected shape", () => {
    expect(SKINS).toHaveLength(2);
    expect(SKINS.map((s) => s.id)).toEqual(["classic", "fantasy"]);
    expect(SKINS).toEqual([
      { id: "classic", label: "Classic", ext: "png" },
      { id: "fantasy", label: "Fantasy", ext: "webp" },
    ]);
  });
});
