import { describe, it, expect } from "vitest";
import { detectTactic, detectScholarsMate, type MoveContext } from "./tactics";
import type { GameMode, MoveRecord, Piece, PieceType, Position } from "../../types/chess";
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

/** Build a minimal MoveRecord for Scholar's Mate tests. */
function moveRecord(
  color: "white" | "black",
  type: PieceType,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  capturedPiece: Piece | null = null,
): MoveRecord {
  return {
    piece: makePiece(color, type, fromX, fromY),
    from: pos(fromX, fromY),
    to: pos(toX, toY),
    capturedPiece,
    wasPromotion: false,
  };
}

// ---------------------------------------------------------------------------
// detectScholarsMate
// ---------------------------------------------------------------------------

describe("detectScholarsMate — nominal case", () => {
  it("returns true for the exact Scholar's Mate move sequence", () => {
    // Plies 0-6: e4, e5, Qh5, Nc6, Bc4, Nf6, Qxf7#
    const capturedPawn = makePiece("black", "pawn", 5, 1);
    const moves: MoveRecord[] = [
      moveRecord("white", "pawn", 4, 6, 4, 4),           // ply 0: e2→e4
      moveRecord("black", "pawn", 4, 1, 4, 3),           // ply 1: e7→e5
      moveRecord("white", "queen", 3, 7, 7, 3),          // ply 2: Qd1→h5
      moveRecord("black", "knight", 1, 0, 2, 2),         // ply 3: Nb8→c6
      moveRecord("white", "bishop", 5, 7, 2, 4),         // ply 4: Bf1→c4
      moveRecord("black", "knight", 6, 0, 5, 2),         // ply 5: Ng8→f6
      {
        piece: makePiece("white", "queen", 7, 3),        // ply 6: Qh5×f7#
        from: pos(7, 3),
        to: pos(5, 1),
        capturedPiece: capturedPawn,
        wasPromotion: false,
      },
    ];
    expect(detectScholarsMate(moves)).toBe(true);
  });
});

describe("detectScholarsMate — edge cases", () => {
  it("returns false for an empty move list", () => {
    expect(detectScholarsMate([])).toBe(false);
  });

  it("returns false when there are fewer than 7 plies", () => {
    const moves: MoveRecord[] = [
      moveRecord("white", "pawn", 4, 6, 4, 4),
      moveRecord("black", "pawn", 4, 1, 4, 3),
      moveRecord("white", "queen", 3, 7, 7, 3),
      moveRecord("black", "knight", 1, 0, 2, 2),
      moveRecord("white", "bishop", 5, 7, 2, 4),
      moveRecord("black", "knight", 6, 0, 5, 2),
      // missing ply 6
    ];
    expect(detectScholarsMate(moves)).toBe(false);
  });

  it("returns false when the first white move is not the e-pawn to e4", () => {
    const capturedPawn = makePiece("black", "pawn", 5, 1);
    const moves: MoveRecord[] = [
      moveRecord("white", "pawn", 3, 6, 3, 4),           // ply 0: d4 instead of e4
      moveRecord("black", "pawn", 4, 1, 4, 3),
      moveRecord("white", "queen", 3, 7, 7, 3),
      moveRecord("black", "knight", 1, 0, 2, 2),
      moveRecord("white", "bishop", 5, 7, 2, 4),
      moveRecord("black", "knight", 6, 0, 5, 2),
      {
        piece: makePiece("white", "queen", 7, 3),
        from: pos(7, 3),
        to: pos(5, 1),
        capturedPiece: capturedPawn,
        wasPromotion: false,
      },
    ];
    expect(detectScholarsMate(moves)).toBe(false);
  });

  it("returns false when the queen does not go to h5", () => {
    const capturedPawn = makePiece("black", "pawn", 5, 1);
    const moves: MoveRecord[] = [
      moveRecord("white", "pawn", 4, 6, 4, 4),
      moveRecord("black", "pawn", 4, 1, 4, 3),
      moveRecord("white", "queen", 3, 7, 6, 3),          // ply 2: Qg5 instead of Qh5
      moveRecord("black", "knight", 1, 0, 2, 2),
      moveRecord("white", "bishop", 5, 7, 2, 4),
      moveRecord("black", "knight", 6, 0, 5, 2),
      {
        piece: makePiece("white", "queen", 6, 3),
        from: pos(6, 3),
        to: pos(5, 1),
        capturedPiece: capturedPawn,
        wasPromotion: false,
      },
    ];
    expect(detectScholarsMate(moves)).toBe(false);
  });

  it("returns false when the bishop does not go to c4", () => {
    const capturedPawn = makePiece("black", "pawn", 5, 1);
    const moves: MoveRecord[] = [
      moveRecord("white", "pawn", 4, 6, 4, 4),
      moveRecord("black", "pawn", 4, 1, 4, 3),
      moveRecord("white", "queen", 3, 7, 7, 3),
      moveRecord("black", "knight", 1, 0, 2, 2),
      moveRecord("white", "bishop", 5, 7, 3, 5),          // ply 4: Bd3 instead of Bc4
      moveRecord("black", "knight", 6, 0, 5, 2),
      {
        piece: makePiece("white", "queen", 7, 3),
        from: pos(7, 3),
        to: pos(5, 1),
        capturedPiece: capturedPawn,
        wasPromotion: false,
      },
    ];
    expect(detectScholarsMate(moves)).toBe(false);
  });

  it("returns false when the final queen move lands on a different square", () => {
    const moves: MoveRecord[] = [
      moveRecord("white", "pawn", 4, 6, 4, 4),
      moveRecord("black", "pawn", 4, 1, 4, 3),
      moveRecord("white", "queen", 3, 7, 7, 3),
      moveRecord("black", "knight", 1, 0, 2, 2),
      moveRecord("white", "bishop", 5, 7, 2, 4),
      moveRecord("black", "knight", 6, 0, 5, 2),
      moveRecord("white", "queen", 7, 3, 4, 3),           // ply 6: Qe5 instead of Qxf7
    ];
    expect(detectScholarsMate(moves)).toBe(false);
  });

  it("returns false when the final queen move captures nothing (no capturedPiece)", () => {
    const moves: MoveRecord[] = [
      moveRecord("white", "pawn", 4, 6, 4, 4),
      moveRecord("black", "pawn", 4, 1, 4, 3),
      moveRecord("white", "queen", 3, 7, 7, 3),
      moveRecord("black", "knight", 1, 0, 2, 2),
      moveRecord("white", "bishop", 5, 7, 2, 4),
      moveRecord("black", "knight", 6, 0, 5, 2),
      moveRecord("white", "queen", 7, 3, 5, 1),           // ply 6: Qf7 but no capture
    ];
    expect(detectScholarsMate(moves)).toBe(false);
  });

  it("returns false when the 8th+ ply sequence otherwise matches but only 7 plies given", () => {
    // 7 plies with ply 0 not matching — already covered; just verify boundary
    const moves: MoveRecord[] = new Array(7).fill(
      moveRecord("black", "pawn", 0, 0, 0, 1),
    );
    expect(detectScholarsMate(moves)).toBe(false);
  });
});

