import { describe, it, expect } from "vitest";
import { detectTactic, type MoveContext } from "./tactics";
import type { GameMode, Piece, PieceType, Position } from "../../types/chess";
import { ASSIMILATION, CLASSIC, makePiece, pos } from "../../test/helpers";

/**
 * Builds a MoveContext from a pre-move board and a target square.
 * nextPieces is derived: the captured piece (enemy on `to`) is removed and the
 * mover is relocated (keeping its id). Pass `promoteTo` to change the mover's
 * type in nextPieces, or `nextPieces` to override entirely (e.g. castling).
 */
function makeContext(
  prevPieces: Piece[],
  mover: Piece,
  to: Position,
  opts: {
    wasPromotion?: boolean;
    wasCastling?: boolean;
    gameMode?: GameMode;
    nextPieces?: Piece[];
    promoteTo?: PieceType;
  } = {},
): MoveContext {
  const captured =
    prevPieces.find(
      (p) =>
        p.position.x === to.x &&
        p.position.y === to.y &&
        p.color !== mover.color,
    ) ?? null;
  const nextPieces =
    opts.nextPieces ??
    prevPieces
      .filter((p) => p.id !== captured?.id)
      .map((p) =>
        p.id === mover.id
          ? {
              ...p,
              position: to,
              hasMoved: true,
              ...(opts.promoteTo ? { type: opts.promoteTo } : {}),
            }
          : p,
      );
  return {
    piece: mover,
    from: mover.position,
    to,
    capturedPiece: captured,
    wasPromotion: opts.wasPromotion ?? false,
    wasCastling: opts.wasCastling ?? false,
    prevPieces,
    nextPieces,
    gameMode: opts.gameMode ?? CLASSIC,
  };
}

describe("detectTactic — promotion and castling priority", () => {
  it("returns promotion even when the promoting move also captures and gives check", () => {
    // White pawn b7 captures a black rook on a8 and promotes; the new queen on
    // a8 checks the black king on e8 along the back rank.
    const pawn = makePiece("white", "pawn", 1, 1);
    const prev = [
      pawn,
      makePiece("black", "rook", 0, 0),
      makePiece("black", "king", 4, 0),
      makePiece("white", "king", 7, 7),
    ];
    const ctx = makeContext(prev, pawn, pos(0, 0), {
      wasPromotion: true,
      promoteTo: "queen",
    });
    expect(ctx.capturedPiece?.type).toBe("rook");
    expect(detectTactic(ctx)).toBe("promotion");
  });

  it("returns castling even when the castling rook gives check", () => {
    // White castles kingside; the rook lands on f1 and checks the black king on f8.
    const king = makePiece("white", "king", 4, 7, { id: "wk" });
    const rook = makePiece("white", "rook", 7, 7, { id: "wr" });
    const blackKing = makePiece("black", "king", 5, 0, { id: "bk" });
    const prev = [king, rook, blackKing];
    const next = [
      { ...king, position: pos(6, 7), hasMoved: true },
      { ...rook, position: pos(5, 7), hasMoved: true },
      blackKing,
    ];
    const ctx = makeContext(prev, king, pos(6, 7), {
      wasCastling: true,
      nextPieces: next,
    });
    expect(detectTactic(ctx)).toBe("castling");
  });
});

describe("detectTactic — check and discovered check", () => {
  it("returns check when the moved piece attacks the enemy king", () => {
    // Ra4-e4: the rook attacks the black king on e8 along the open e-file.
    const rook = makePiece("white", "rook", 0, 4);
    const prev = [
      rook,
      makePiece("black", "king", 4, 0),
      makePiece("white", "king", 7, 7),
    ];
    const ctx = makeContext(prev, rook, pos(4, 4));
    expect(detectTactic(ctx)).toBe("check");
  });

  it("returns discoveredCheck when the moved piece unmasks a slider check", () => {
    // Bishop e4 steps to f5, unmasking the rook on e1 against the king on e8.
    // The bishop itself does not attack e8 from f5.
    const bishop = makePiece("white", "bishop", 4, 4);
    const prev = [
      bishop,
      makePiece("white", "rook", 4, 7),
      makePiece("white", "king", 0, 7),
      makePiece("black", "king", 4, 0),
    ];
    const ctx = makeContext(prev, bishop, pos(5, 3));
    expect(detectTactic(ctx)).toBe("discoveredCheck");
  });

  it("returns check (not fork) when the move both checks and attacks another piece", () => {
    // Qa4-e4 checks the king on e8 and simultaneously attacks the rook on h4:
    // check has higher priority than fork.
    const queen = makePiece("white", "queen", 0, 4);
    const prev = [
      queen,
      makePiece("black", "king", 4, 0),
      makePiece("black", "rook", 7, 4),
      makePiece("white", "king", 7, 7),
    ];
    const ctx = makeContext(prev, queen, pos(4, 4));
    expect(detectTactic(ctx)).toBe("check");
  });

  it("returns check (not capture) when a capture also gives check", () => {
    // Rxe4 captures a bishop and the rook then checks the king on e8.
    const rook = makePiece("white", "rook", 0, 4);
    const prev = [
      rook,
      makePiece("black", "bishop", 4, 4),
      makePiece("black", "king", 4, 0),
      makePiece("white", "king", 7, 7),
    ];
    const ctx = makeContext(prev, rook, pos(4, 4));
    expect(ctx.capturedPiece?.type).toBe("bishop");
    expect(detectTactic(ctx)).toBe("check");
  });
});

describe("detectTactic — fork", () => {
  it("returns fork when a knight attacks two enemy pieces", () => {
    // Nd2-e4 attacks the rook on c5 (2,3) and the queen on g5 (6,3).
    const knight = makePiece("white", "knight", 3, 6);
    const prev = [
      knight,
      makePiece("black", "rook", 2, 3),
      makePiece("black", "queen", 6, 3),
      makePiece("black", "king", 0, 0),
      makePiece("white", "king", 7, 7),
    ];
    const ctx = makeContext(prev, knight, pos(4, 4));
    expect(detectTactic(ctx)).toBe("fork");
  });

  it("returns null when the knight attacks only one enemy piece", () => {
    const knight = makePiece("white", "knight", 3, 6);
    const prev = [
      knight,
      makePiece("black", "rook", 2, 3),
      makePiece("black", "king", 0, 0),
      makePiece("white", "king", 7, 7),
    ];
    const ctx = makeContext(prev, knight, pos(4, 4));
    expect(detectTactic(ctx)).toBeNull();
  });

  it("detects a fork delivered through an acquired type in assimilation mode", () => {
    // A knight that assimilated a bishop lands on e4 and attacks b7 and h7
    // diagonally — squares a plain knight could never reach from e4.
    const knight = makePiece("white", "knight", 3, 6, {
      acquiredTypes: ["bishop"],
    });
    const prev = [
      knight,
      makePiece("black", "rook", 1, 1),
      makePiece("black", "queen", 7, 1),
      makePiece("black", "king", 4, 0),
      makePiece("white", "king", 4, 7),
    ];
    const ctx = makeContext(prev, knight, pos(4, 4), {
      gameMode: ASSIMILATION,
    });
    expect(detectTactic(ctx)).toBe("fork");
  });

  it("does not detect that fork without the acquired type", () => {
    const knight = makePiece("white", "knight", 3, 6);
    const prev = [
      knight,
      makePiece("black", "rook", 1, 1),
      makePiece("black", "queen", 7, 1),
      makePiece("black", "king", 4, 0),
      makePiece("white", "king", 4, 7),
    ];
    const ctx = makeContext(prev, knight, pos(4, 4), {
      gameMode: ASSIMILATION,
    });
    expect(detectTactic(ctx)).toBeNull();
  });
});

describe("detectTactic — pin", () => {
  it("returns pin when a rook pins an enemy bishop to its king", () => {
    // Ra4-e4: the black bishop on e6 shields the black king on e8 from the rook.
    const rook = makePiece("white", "rook", 0, 4);
    const prev = [
      rook,
      makePiece("black", "bishop", 4, 2),
      makePiece("black", "king", 4, 0),
      makePiece("white", "king", 7, 7),
    ];
    const ctx = makeContext(prev, rook, pos(4, 4));
    expect(detectTactic(ctx)).toBe("pin");
  });

  it("never reports a pin for a knight", () => {
    // Same alignment as the rook pin, but a knight cannot pin (not a slider).
    const knight = makePiece("white", "knight", 3, 6);
    const prev = [
      knight,
      makePiece("black", "bishop", 4, 2),
      makePiece("black", "king", 4, 0),
      makePiece("white", "king", 7, 7),
    ];
    const ctx = makeContext(prev, knight, pos(4, 4));
    expect(detectTactic(ctx)).toBeNull();
  });
});

describe("detectTactic — capture and quiet moves", () => {
  it("returns capture for a plain capture with no other tactic", () => {
    const rook = makePiece("white", "rook", 0, 4);
    const prev = [
      rook,
      makePiece("black", "pawn", 4, 4),
      makePiece("black", "king", 7, 0),
      makePiece("white", "king", 0, 7),
    ];
    const ctx = makeContext(prev, rook, pos(4, 4));
    expect(ctx.capturedPiece?.type).toBe("pawn");
    expect(detectTactic(ctx)).toBe("capture");
  });

  it("returns null for a quiet move", () => {
    const rook = makePiece("white", "rook", 0, 4);
    const prev = [
      rook,
      makePiece("black", "king", 7, 0),
      makePiece("white", "king", 0, 7),
    ];
    const ctx = makeContext(prev, rook, pos(1, 4));
    expect(detectTactic(ctx)).toBeNull();
  });
});
