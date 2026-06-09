import { describe, it, expect, vi } from "vitest";
import {
  BOARD_SIZE,
  UNICODE_PIECES,
  getDifficultyIndex,
  getDifficultyKey,
  getInitialPieces,
  initialPieces,
} from "./board";
import { CLASSIC, ALL_RANDOM } from "../../test/helpers";
import type { Piece, PieceColor } from "../../types/chess";

function findAt(pieces: Piece[], x: number, y: number): Piece | undefined {
  return pieces.find((p) => p.position.x === x && p.position.y === y);
}

describe("getInitialPieces — classic mode", () => {
  const pieces = getInitialPieces(CLASSIC);

  it("returns 32 pieces, 16 per color", () => {
    expect(pieces).toHaveLength(32);
    expect(pieces.filter((p) => p.color === "white")).toHaveLength(16);
    expect(pieces.filter((p) => p.color === "black")).toHaveLength(16);
  });

  it("places kings and queens on standard FIDE squares", () => {
    expect(findAt(pieces, 4, 7)).toMatchObject({ type: "king", color: "white" });
    expect(findAt(pieces, 3, 7)).toMatchObject({ type: "queen", color: "white" });
    expect(findAt(pieces, 4, 0)).toMatchObject({ type: "king", color: "black" });
    expect(findAt(pieces, 3, 0)).toMatchObject({ type: "queen", color: "black" });
  });

  it("places rooks, knights and bishops symmetrically on the back ranks", () => {
    for (const [color, y] of [["white", 7], ["black", 0]] as [PieceColor, number][]) {
      expect(findAt(pieces, 0, y)).toMatchObject({ type: "rook", color });
      expect(findAt(pieces, 7, y)).toMatchObject({ type: "rook", color });
      expect(findAt(pieces, 1, y)).toMatchObject({ type: "knight", color });
      expect(findAt(pieces, 6, y)).toMatchObject({ type: "knight", color });
      expect(findAt(pieces, 2, y)).toMatchObject({ type: "bishop", color });
      expect(findAt(pieces, 5, y)).toMatchObject({ type: "bishop", color });
    }
  });

  it("fills rows 6 (white) and 1 (black) with pawns", () => {
    for (let x = 0; x < BOARD_SIZE; x++) {
      expect(findAt(pieces, x, 6)).toMatchObject({ type: "pawn", color: "white" });
      expect(findAt(pieces, x, 1)).toMatchObject({ type: "pawn", color: "black" });
    }
  });

  it("assigns unique ids and leaves hasMoved falsy on every piece", () => {
    const ids = new Set(pieces.map((p) => p.id));
    expect(ids.size).toBe(32);
    for (const p of pieces) {
      expect(p.hasMoved).toBeFalsy();
    }
  });
});

describe("difficulty helpers", () => {
  it("maps levels to the right index at the boundaries", () => {
    expect(getDifficultyIndex(1)).toBe(0);
    expect(getDifficultyIndex(2)).toBe(0);
    expect(getDifficultyIndex(3)).toBe(1);
    expect(getDifficultyIndex(19)).toBe(9);
    expect(getDifficultyIndex(20)).toBe(9);
  });

  it("builds the matching i18n key", () => {
    expect(getDifficultyKey(1)).toBe("gameSettings.difficultyLevels.0");
    expect(getDifficultyKey(3)).toBe("gameSettings.difficultyLevels.1");
    expect(getDifficultyKey(20)).toBe("gameSettings.difficultyLevels.9");
  });
});

describe("getInitialPieces — all-random mode", () => {
  const ROWS: Record<PieceColor, { backY: number; pawnY: number }> = {
    white: { backY: 7, pawnY: 6 },
    black: { backY: 0, pawnY: 1 },
  };

  it("always produces a structurally valid random setup (25 runs)", () => {
    for (let run = 0; run < 25; run++) {
      const pieces = getInitialPieces(ALL_RANDOM);
      expect(pieces).toHaveLength(32);

      // Unique ids overall
      expect(new Set(pieces.map((p) => p.id)).size).toBe(32);

      for (const color of ["white", "black"] as PieceColor[]) {
        const side = pieces.filter((p) => p.color === color);
        expect(side).toHaveLength(16);

        // Exactly one king per color, always at x=4 on the back rank
        const kings = side.filter((p) => p.type === "king");
        expect(kings).toHaveLength(1);
        expect(kings[0].position).toEqual({ x: 4, y: ROWS[color].backY });

        // The side occupies exactly the 16 squares of its back + pawn rows
        const { backY, pawnY } = ROWS[color];
        const occupied = new Set(side.map((p) => `${p.position.x},${p.position.y}`));
        expect(occupied.size).toBe(16); // all positions unique
        for (let x = 0; x < BOARD_SIZE; x++) {
          expect(occupied.has(`${x},${backY}`)).toBe(true);
          expect(occupied.has(`${x},${pawnY}`)).toBe(true);
        }
      }
    }
  });

  it("still returns a valid 32-piece setup with Math.random mocked to 0", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      const pieces = getInitialPieces(ALL_RANDOM);
      expect(pieces).toHaveLength(32);
      expect(new Set(pieces.map((p) => p.id)).size).toBe(32);

      for (const color of ["white", "black"] as PieceColor[]) {
        const side = pieces.filter((p) => p.color === color);
        expect(side).toHaveLength(16);
        const kings = side.filter((p) => p.type === "king");
        expect(kings).toHaveLength(1);
        expect(kings[0].position).toEqual({ x: 4, y: ROWS[color].backY });
        // With Math.random() === 0 the weighted pool always yields pawns
        for (const p of side.filter((q) => q.type !== "king")) {
          expect(p.type).toBe("pawn");
        }
      }
    } finally {
      spy.mockRestore();
    }
  });
});

describe("exported constants", () => {
  it("BOARD_SIZE is 8", () => {
    expect(BOARD_SIZE).toBe(8);
  });

  it("initialPieces is a classic 32-piece board", () => {
    expect(initialPieces).toHaveLength(32);
    expect(findAt(initialPieces, 4, 7)).toMatchObject({ type: "king", color: "white" });
  });

  it("UNICODE_PIECES covers every color and type with the right glyphs", () => {
    expect(UNICODE_PIECES.white.king).toBe("♔");
    expect(UNICODE_PIECES.white.pawn).toBe("♙");
    expect(UNICODE_PIECES.black.king).toBe("♚");
    expect(UNICODE_PIECES.black.pawn).toBe("♟");
    for (const color of ["white", "black"] as const) {
      expect(Object.keys(UNICODE_PIECES[color]).sort()).toEqual(
        ["bishop", "king", "knight", "pawn", "queen", "rook"],
      );
    }
  });
});
