import { describe, it, expect } from "vitest";
import {
  normalizePos,
  switchTurn,
  getPieceAt,
  isValidMove,
  isInCheck,
  wouldBeInCheck,
  isSquareUnderAttack,
  getCastlingMoves,
  findCastlingMove,
  getValidMoves,
  hasLegalMoves,
  hasRawMoves,
  applyMoveToState,
} from "./moves";
import {
  CLASSIC,
  BORDERLESS,
  ASSIMILATION,
  makePiece,
  makeState,
  pos,
  includesPos,
} from "../../test/helpers";

// ── 1. Basics ────────────────────────────────────────────────────────────────

describe("normalizePos", () => {
  it("returns in-board coordinates unchanged", () => {
    expect(normalizePos(0, 0)).toEqual({ x: 0, y: 0 });
    expect(normalizePos(7, 7)).toEqual({ x: 7, y: 7 });
    expect(normalizePos(3, 5)).toEqual({ x: 3, y: 5 });
  });

  it("wraps negative coordinates", () => {
    expect(normalizePos(-1, -1)).toEqual({ x: 7, y: 7 });
    expect(normalizePos(-8, -3)).toEqual({ x: 0, y: 5 });
  });

  it("wraps coordinates greater than 7", () => {
    expect(normalizePos(8, 9)).toEqual({ x: 0, y: 1 });
    expect(normalizePos(15, 16)).toEqual({ x: 7, y: 0 });
  });
});

describe("switchTurn", () => {
  it("switches white to black and black to white", () => {
    expect(switchTurn("white")).toBe("black");
    expect(switchTurn("black")).toBe("white");
  });
});

describe("getPieceAt", () => {
  it("finds a piece at its position", () => {
    const rook = makePiece("white", "rook", 3, 4);
    expect(getPieceAt(pos(3, 4), [rook])).toBe(rook);
  });

  it("returns null for an empty square", () => {
    const rook = makePiece("white", "rook", 3, 4);
    expect(getPieceAt(pos(2, 2), [rook])).toBeNull();
  });

  it("normalizes virtual coordinates before looking up", () => {
    const rook = makePiece("white", "rook", 7, 0);
    expect(getPieceAt(pos(-1, 8), [rook])).toBe(rook);
    expect(getPieceAt(pos(15, -8), [rook])).toBe(rook);
  });
});

// ── 2. Per-piece movement (classic) ──────────────────────────────────────────

const whiteKing = () => makePiece("white", "king", 4, 7);
const blackKing = () => makePiece("black", "king", 4, 0);

describe("pawn movement", () => {
  it("allows a single step forward", () => {
    const pawn = makePiece("white", "pawn", 4, 6);
    expect(isValidMove(pawn, pos(4, 5), [pawn], CLASSIC)).toBe(true);
  });

  it("allows a double step from the start rank only", () => {
    const pawn = makePiece("white", "pawn", 4, 6);
    expect(isValidMove(pawn, pos(4, 4), [pawn], CLASSIC)).toBe(true);

    const advanced = makePiece("white", "pawn", 4, 5);
    expect(isValidMove(advanced, pos(4, 3), [advanced], CLASSIC)).toBe(false);
  });

  it("allows black pawn single and double step downward", () => {
    const pawn = makePiece("black", "pawn", 4, 1);
    expect(isValidMove(pawn, pos(4, 2), [pawn], CLASSIC)).toBe(true);
    expect(isValidMove(pawn, pos(4, 3), [pawn], CLASSIC)).toBe(true);
    expect(isValidMove(pawn, pos(4, 0), [pawn], CLASSIC)).toBe(false);
  });

  it("rejects single step onto an occupied square (no straight capture)", () => {
    const pawn = makePiece("white", "pawn", 4, 6);
    const enemy = makePiece("black", "knight", 4, 5);
    expect(isValidMove(pawn, pos(4, 5), [pawn, enemy], CLASSIC)).toBe(false);
  });

  it("rejects double step when the intermediate square is blocked", () => {
    const pawn = makePiece("white", "pawn", 4, 6);
    const blocker = makePiece("black", "knight", 4, 5);
    expect(isValidMove(pawn, pos(4, 4), [pawn, blocker], CLASSIC)).toBe(false);
  });

  it("rejects double step when the target square is blocked", () => {
    const pawn = makePiece("white", "pawn", 4, 6);
    const blocker = makePiece("black", "knight", 4, 4);
    expect(isValidMove(pawn, pos(4, 4), [pawn, blocker], CLASSIC)).toBe(false);
  });

  it("allows diagonal move only when capturing an enemy", () => {
    const pawn = makePiece("white", "pawn", 4, 6);
    const enemy = makePiece("black", "pawn", 3, 5);
    expect(isValidMove(pawn, pos(3, 5), [pawn, enemy], CLASSIC)).toBe(true);
    // Diagonal onto an empty square is not allowed
    expect(isValidMove(pawn, pos(5, 5), [pawn, enemy], CLASSIC)).toBe(false);
  });

  it("getValidMoves of a starting pawn lists forward steps and diagonal capture", () => {
    const pawn = makePiece("white", "pawn", 4, 6);
    // A black pawn (not a knight) so the white king at (4,7) is not in check.
    const enemy = makePiece("black", "pawn", 3, 5);
    const pieces = [pawn, enemy, whiteKing(), blackKing()];
    const moves = getValidMoves(pawn, pieces, CLASSIC);
    expect(includesPos(moves, 4, 5)).toBe(true);
    expect(includesPos(moves, 4, 4)).toBe(true);
    expect(includesPos(moves, 3, 5)).toBe(true);
    expect(includesPos(moves, 5, 5)).toBe(false);
    expect(moves).toHaveLength(3);
  });
});

describe("knight movement", () => {
  it("moves in an L-shape", () => {
    const knight = makePiece("white", "knight", 4, 4);
    expect(isValidMove(knight, pos(6, 5), [knight], CLASSIC)).toBe(true);
    expect(isValidMove(knight, pos(5, 6), [knight], CLASSIC)).toBe(true);
    expect(isValidMove(knight, pos(3, 2), [knight], CLASSIC)).toBe(true);
    expect(isValidMove(knight, pos(5, 5), [knight], CLASSIC)).toBe(false);
    expect(isValidMove(knight, pos(4, 6), [knight], CLASSIC)).toBe(false);
  });

  it("jumps over surrounding pieces", () => {
    const knight = makePiece("white", "knight", 4, 4);
    const blockers = [
      makePiece("white", "pawn", 3, 3),
      makePiece("white", "pawn", 4, 3),
      makePiece("white", "pawn", 5, 3),
      makePiece("black", "pawn", 3, 5),
      makePiece("black", "pawn", 4, 5),
      makePiece("black", "pawn", 5, 5),
    ];
    expect(isValidMove(knight, pos(6, 5), [knight, ...blockers], CLASSIC)).toBe(
      true,
    );
    expect(isValidMove(knight, pos(2, 3), [knight, ...blockers], CLASSIC)).toBe(
      true,
    );
  });
});

describe("bishop movement", () => {
  it("moves along clear diagonals only", () => {
    const bishop = makePiece("white", "bishop", 3, 4);
    expect(isValidMove(bishop, pos(6, 7), [bishop], CLASSIC)).toBe(true);
    expect(isValidMove(bishop, pos(0, 1), [bishop], CLASSIC)).toBe(true);
    expect(isValidMove(bishop, pos(3, 6), [bishop], CLASSIC)).toBe(false);
    expect(isValidMove(bishop, pos(5, 4), [bishop], CLASSIC)).toBe(false);
  });

  it("is blocked by a piece on the diagonal path", () => {
    const bishop = makePiece("white", "bishop", 3, 4);
    const blocker = makePiece("black", "pawn", 4, 5);
    expect(isValidMove(bishop, pos(6, 7), [bishop, blocker], CLASSIC)).toBe(
      false,
    );
    // Capturing the blocker itself is fine
    expect(isValidMove(bishop, pos(4, 5), [bishop, blocker], CLASSIC)).toBe(
      true,
    );
  });
});

describe("rook movement", () => {
  it("moves along clear ranks and files only", () => {
    const rook = makePiece("white", "rook", 0, 4);
    expect(isValidMove(rook, pos(7, 4), [rook], CLASSIC)).toBe(true);
    expect(isValidMove(rook, pos(0, 0), [rook], CLASSIC)).toBe(true);
    expect(isValidMove(rook, pos(1, 5), [rook], CLASSIC)).toBe(false);
  });

  it("is blocked by a piece on the path", () => {
    const rook = makePiece("white", "rook", 0, 4);
    const blocker = makePiece("black", "pawn", 3, 4);
    expect(isValidMove(rook, pos(7, 4), [rook, blocker], CLASSIC)).toBe(false);
    expect(isValidMove(rook, pos(2, 4), [rook, blocker], CLASSIC)).toBe(true);
    expect(isValidMove(rook, pos(3, 4), [rook, blocker], CLASSIC)).toBe(true);
  });
});

describe("queen movement", () => {
  it("moves along ranks, files and diagonals", () => {
    const queen = makePiece("white", "queen", 3, 4);
    expect(isValidMove(queen, pos(3, 0), [queen], CLASSIC)).toBe(true);
    expect(isValidMove(queen, pos(7, 4), [queen], CLASSIC)).toBe(true);
    expect(isValidMove(queen, pos(6, 7), [queen], CLASSIC)).toBe(true);
    expect(isValidMove(queen, pos(5, 5), [queen], CLASSIC)).toBe(false);
  });

  it("is blocked by a piece on the path", () => {
    const queen = makePiece("white", "queen", 3, 4);
    const blocker = makePiece("white", "pawn", 3, 2);
    expect(isValidMove(queen, pos(3, 0), [queen, blocker], CLASSIC)).toBe(
      false,
    );
  });
});

describe("king movement", () => {
  it("moves exactly one square in any direction", () => {
    const king = makePiece("white", "king", 4, 4);
    expect(isValidMove(king, pos(4, 3), [king], CLASSIC)).toBe(true);
    expect(isValidMove(king, pos(5, 5), [king], CLASSIC)).toBe(true);
    expect(isValidMove(king, pos(3, 4), [king], CLASSIC)).toBe(true);
    expect(isValidMove(king, pos(4, 2), [king], CLASSIC)).toBe(false);
    expect(isValidMove(king, pos(6, 6), [king], CLASSIC)).toBe(false);
  });
});

describe("shared move guards (classic)", () => {
  it("rejects a move onto an ally-occupied square", () => {
    const rook = makePiece("white", "rook", 0, 7);
    const ally = makePiece("white", "pawn", 0, 6);
    expect(isValidMove(rook, pos(0, 6), [rook, ally], CLASSIC)).toBe(false);
  });

  it("rejects moving to the piece's own square", () => {
    const rook = makePiece("white", "rook", 3, 3);
    expect(isValidMove(rook, pos(3, 3), [rook], CLASSIC)).toBe(false);
  });

  it("rejects out-of-board targets in classic mode", () => {
    const rook = makePiece("white", "rook", 4, 4);
    expect(isValidMove(rook, pos(8, 4), [rook], CLASSIC)).toBe(false);
    expect(isValidMove(rook, pos(-1, 4), [rook], CLASSIC)).toBe(false);
    expect(isValidMove(rook, pos(4, -1), [rook], CLASSIC)).toBe(false);
    expect(isValidMove(rook, pos(4, 8), [rook], CLASSIC)).toBe(false);
  });
});

// ── 3. Check logic ───────────────────────────────────────────────────────────

describe("isInCheck", () => {
  it("detects a rook giving check along a clear file", () => {
    const pieces = [whiteKing(), blackKing(), makePiece("black", "rook", 4, 2)];
    expect(isInCheck("white", pieces, CLASSIC)).toBe(true);
  });

  it("returns false when no piece attacks the king", () => {
    const pieces = [whiteKing(), blackKing(), makePiece("black", "rook", 0, 2)];
    expect(isInCheck("white", pieces, CLASSIC)).toBe(false);
  });

  it("returns false when the check path is blocked", () => {
    const pieces = [
      whiteKing(),
      blackKing(),
      makePiece("black", "rook", 4, 2),
      makePiece("white", "pawn", 4, 5),
    ];
    expect(isInCheck("white", pieces, CLASSIC)).toBe(false);
  });

  it("returns false when the king is missing from the board", () => {
    const pieces = [makePiece("black", "rook", 4, 2)];
    expect(isInCheck("white", pieces, CLASSIC)).toBe(false);
  });
});

describe("wouldBeInCheck and pins", () => {
  it("wouldBeInCheck is true when moving a pinned piece off the pin line", () => {
    const king = whiteKing();
    const pinned = makePiece("white", "rook", 4, 5);
    const attacker = makePiece("black", "rook", 4, 2);
    const pieces = [king, pinned, attacker, makePiece("black", "king", 0, 0)];
    expect(wouldBeInCheck(pinned, pos(5, 5), pieces, CLASSIC)).toBe(true);
    expect(wouldBeInCheck(pinned, pos(4, 4), pieces, CLASSIC)).toBe(false);
  });

  it("getValidMoves restricts a pinned rook to the pin file", () => {
    const king = whiteKing();
    const pinned = makePiece("white", "rook", 4, 5);
    const attacker = makePiece("black", "rook", 4, 2);
    const pieces = [king, pinned, attacker, makePiece("black", "king", 0, 0)];
    const moves = getValidMoves(pinned, pieces, CLASSIC);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((m) => m.x === 4)).toBe(true);
    expect(includesPos(moves, 4, 2)).toBe(true); // capturing the pinner is fine
  });

  it("getValidMoves of a fully pinned bishop is empty", () => {
    const king = whiteKing();
    const pinned = makePiece("white", "bishop", 4, 5);
    const attacker = makePiece("black", "rook", 4, 0);
    const pieces = [king, pinned, attacker, makePiece("black", "king", 0, 0)];
    expect(getValidMoves(pinned, pieces, CLASSIC)).toHaveLength(0);
  });

  it("hasRawMoves is true for a pinned piece even when it has no legal moves", () => {
    const king = whiteKing();
    const pinned = makePiece("white", "bishop", 4, 5);
    const attacker = makePiece("black", "rook", 4, 0);
    const pieces = [king, pinned, attacker, makePiece("black", "king", 0, 0)];
    expect(hasRawMoves(pinned, pieces, CLASSIC)).toBe(true);
    expect(getValidMoves(pinned, pieces, CLASSIC)).toHaveLength(0);
  });

  it("the king cannot move into an attacked square", () => {
    const king = whiteKing();
    const attacker = makePiece("black", "rook", 0, 6);
    const pieces = [king, attacker, blackKing()];
    const moves = getValidMoves(king, pieces, CLASSIC);
    expect(includesPos(moves, 4, 6)).toBe(false);
    expect(includesPos(moves, 3, 6)).toBe(false);
    expect(includesPos(moves, 5, 6)).toBe(false);
    expect(includesPos(moves, 3, 7)).toBe(true);
    expect(includesPos(moves, 5, 7)).toBe(true);
  });
});

describe("isSquareUnderAttack", () => {
  it("detects pawn diagonal attack onto an empty square", () => {
    const pawn = makePiece("black", "pawn", 4, 3);
    expect(isSquareUnderAttack(pos(3, 4), "black", [pawn], CLASSIC)).toBe(true);
    expect(isSquareUnderAttack(pos(5, 4), "black", [pawn], CLASSIC)).toBe(true);
  });

  it("does not flag the square directly in front of a pawn", () => {
    const pawn = makePiece("black", "pawn", 4, 3);
    expect(isSquareUnderAttack(pos(4, 4), "black", [pawn], CLASSIC)).toBe(
      false,
    );
  });

  it("respects pawn direction per color", () => {
    const pawn = makePiece("white", "pawn", 4, 4);
    expect(isSquareUnderAttack(pos(3, 3), "white", [pawn], CLASSIC)).toBe(true);
    expect(isSquareUnderAttack(pos(3, 5), "white", [pawn], CLASSIC)).toBe(
      false,
    );
  });

  it("detects sliding piece attacks and respects blockers", () => {
    const rook = makePiece("black", "rook", 0, 0);
    expect(isSquareUnderAttack(pos(0, 5), "black", [rook], CLASSIC)).toBe(true);
    const blocker = makePiece("white", "pawn", 0, 3);
    expect(
      isSquareUnderAttack(pos(0, 5), "black", [rook, blocker], CLASSIC),
    ).toBe(false);
  });

  it("BUG-004 fixed: detects wrap-around rook attack in borderless mode", () => {
    // Black rook on a1 (0,0) can reach h1 (7,0) via wrap-around in borderless.
    const rook = makePiece("black", "rook", 0, 0);
    expect(isSquareUnderAttack(pos(7, 0), "black", [rook], BORDERLESS)).toBe(true);
  });

  it("BUG-004 fixed: classic mode rook attacks remain correct without wrap", () => {
    const rookEdge = makePiece("black", "rook", 1, 0);
    expect(isSquareUnderAttack(pos(7, 0), "black", [rookEdge], CLASSIC)).toBe(true); // rank 0
    expect(isSquareUnderAttack(pos(0, 0), "black", [rookEdge], CLASSIC)).toBe(true); // rank 0
  });
});

// ── 4. Castling ──────────────────────────────────────────────────────────────

function castlingSetup() {
  const king = whiteKing();
  const kingsideRook = makePiece("white", "rook", 7, 7);
  const queensideRook = makePiece("white", "rook", 0, 7);
  return { king, kingsideRook, queensideRook };
}

describe("castling", () => {
  it("offers kingside and queenside castling with unmoved king and rooks", () => {
    const { king, kingsideRook, queensideRook } = castlingSetup();
    const pieces = [king, kingsideRook, queensideRook, blackKing()];
    const castles = getCastlingMoves(king, pieces, CLASSIC);
    expect(castles).toHaveLength(2);
    const kingside = castles.find((c) => c.kingTarget.x === 6);
    const queenside = castles.find((c) => c.kingTarget.x === 2);
    expect(kingside?.rookTarget).toEqual({ x: 5, y: 7 });
    expect(queenside?.rookTarget).toEqual({ x: 3, y: 7 });
  });

  it("includes castling targets in getValidMoves of the king", () => {
    const { king, kingsideRook, queensideRook } = castlingSetup();
    const pieces = [king, kingsideRook, queensideRook, blackKing()];
    const moves = getValidMoves(king, pieces, CLASSIC);
    expect(includesPos(moves, 6, 7)).toBe(true);
    expect(includesPos(moves, 2, 7)).toBe(true);
  });

  it("findCastlingMove returns the move for a castling target and null otherwise", () => {
    const { king, kingsideRook, queensideRook } = castlingSetup();
    const pieces = [king, kingsideRook, queensideRook, blackKing()];
    const found = findCastlingMove(king, pos(6, 7), pieces, CLASSIC);
    expect(found?.rook.id).toBe(kingsideRook.id);
    expect(found?.rookTarget).toEqual({ x: 5, y: 7 });
    expect(findCastlingMove(king, pos(5, 7), pieces, CLASSIC)).toBeNull();
  });

  it("applyMoveToState moves the rook to x=5 on kingside castling", () => {
    const { king, kingsideRook, queensideRook } = castlingSetup();
    const state = makeState([king, kingsideRook, queensideRook, blackKing()]);
    const next = applyMoveToState(state, king, pos(6, 7));
    const movedKing = next.pieces.find((p) => p.id === king.id)!;
    const movedRook = next.pieces.find((p) => p.id === kingsideRook.id)!;
    expect(movedKing.position).toEqual({ x: 6, y: 7 });
    expect(movedRook.position).toEqual({ x: 5, y: 7 });
    expect(movedKing.hasMoved).toBe(true);
    expect(movedRook.hasMoved).toBe(true);
  });

  it("applyMoveToState moves the rook to x=3 on queenside castling", () => {
    const { king, kingsideRook, queensideRook } = castlingSetup();
    const state = makeState([king, kingsideRook, queensideRook, blackKing()]);
    const next = applyMoveToState(state, king, pos(2, 7));
    const movedKing = next.pieces.find((p) => p.id === king.id)!;
    const movedRook = next.pieces.find((p) => p.id === queensideRook.id)!;
    expect(movedKing.position).toEqual({ x: 2, y: 7 });
    expect(movedRook.position).toEqual({ x: 3, y: 7 });
  });

  it("rejects castling when the king has moved", () => {
    const king = makePiece("white", "king", 4, 7, { hasMoved: true });
    const rook = makePiece("white", "rook", 7, 7);
    const pieces = [king, rook, blackKing()];
    expect(getCastlingMoves(king, pieces, CLASSIC)).toHaveLength(0);
  });

  it("rejects castling when the rook has moved", () => {
    const king = whiteKing();
    const rook = makePiece("white", "rook", 7, 7, { hasMoved: true });
    const pieces = [king, rook, blackKing()];
    expect(getCastlingMoves(king, pieces, CLASSIC)).toHaveLength(0);
  });

  it("rejects castling when the path is blocked", () => {
    const { king, kingsideRook, queensideRook } = castlingSetup();
    const bishop = makePiece("white", "bishop", 5, 7);
    const knight = makePiece("white", "knight", 1, 7);
    const pieces = [king, kingsideRook, queensideRook, bishop, knight, blackKing()];
    expect(getCastlingMoves(king, pieces, CLASSIC)).toHaveLength(0);
  });

  it("rejects castling while the king is in check", () => {
    const { king, kingsideRook, queensideRook } = castlingSetup();
    const attacker = makePiece("black", "rook", 4, 3);
    const pieces = [
      king,
      kingsideRook,
      queensideRook,
      attacker,
      makePiece("black", "king", 0, 0),
    ];
    expect(getCastlingMoves(king, pieces, CLASSIC)).toHaveLength(0);
  });

  it("rejects kingside castling when the crossed square is attacked", () => {
    const { king, kingsideRook, queensideRook } = castlingSetup();
    const attacker = makePiece("black", "rook", 5, 0); // attacks (5,7)
    const pieces = [
      king,
      kingsideRook,
      queensideRook,
      attacker,
      makePiece("black", "king", 0, 0),
    ];
    const castles = getCastlingMoves(king, pieces, CLASSIC);
    expect(castles).toHaveLength(1);
    expect(castles[0].kingTarget.x).toBe(2); // only queenside survives
  });

  it("rejects kingside castling when the king target square is attacked", () => {
    const { king, kingsideRook, queensideRook } = castlingSetup();
    const attacker = makePiece("black", "rook", 6, 0); // attacks (6,7)
    const pieces = [
      king,
      kingsideRook,
      queensideRook,
      attacker,
      makePiece("black", "king", 0, 0),
    ];
    const castles = getCastlingMoves(king, pieces, CLASSIC);
    expect(castles).toHaveLength(1);
    expect(castles[0].kingTarget.x).toBe(2);
  });
});

// ── 5. Promotion ─────────────────────────────────────────────────────────────

describe("promotion via applyMoveToState", () => {
  function promotionState() {
    const pawn = makePiece("white", "pawn", 3, 1);
    const state = makeState([
      pawn,
      whiteKing(),
      makePiece("black", "king", 7, 5),
    ]);
    return { pawn, state };
  }

  it("promotes a white pawn reaching y=0 to a queen by default", () => {
    const { pawn, state } = promotionState();
    const next = applyMoveToState(state, pawn, pos(3, 0));
    const promoted = next.pieces.find((p) => p.id === pawn.id)!;
    expect(promoted.type).toBe("queen");
    expect(promoted.position).toEqual({ x: 3, y: 0 });
  });

  it("respects an explicit promotionType of knight", () => {
    const { pawn, state } = promotionState();
    const next = applyMoveToState(state, pawn, pos(3, 0), "knight");
    const promoted = next.pieces.find((p) => p.id === pawn.id)!;
    expect(promoted.type).toBe("knight");
  });

  it("records wasPromotion=true in the move history", () => {
    const { pawn, state } = promotionState();
    const next = applyMoveToState(state, pawn, pos(3, 0));
    expect(next.moves).toHaveLength(1);
    expect(next.moves[0].wasPromotion).toBe(true);
  });

  it("does not promote a pawn moving to a non-final rank", () => {
    const pawn = makePiece("white", "pawn", 3, 4);
    const state = makeState([pawn, whiteKing(), blackKing()]);
    const next = applyMoveToState(state, pawn, pos(3, 3));
    const moved = next.pieces.find((p) => p.id === pawn.id)!;
    expect(moved.type).toBe("pawn");
    expect(next.moves[0].wasPromotion).toBe(false);
  });
});

// ── 6. applyMoveToState general ──────────────────────────────────────────────

describe("applyMoveToState", () => {
  it("removes the captured piece and records it in the history", () => {
    const rook = makePiece("white", "rook", 0, 4);
    const victim = makePiece("black", "pawn", 5, 4);
    const state = makeState([rook, victim, whiteKing(), blackKing()]);
    const next = applyMoveToState(state, rook, pos(5, 4));
    expect(next.pieces.find((p) => p.id === victim.id)).toBeUndefined();
    expect(next.moves).toHaveLength(1);
    expect(next.moves[0].from).toEqual({ x: 0, y: 4 });
    expect(next.moves[0].to).toEqual({ x: 5, y: 4 });
    expect(next.moves[0].capturedPiece?.id).toBe(victim.id);
  });

  it("increments moveCount for the mover and switches the turn", () => {
    const rook = makePiece("white", "rook", 0, 4);
    const state = makeState([rook, whiteKing(), blackKing()]);
    const next = applyMoveToState(state, rook, pos(0, 3));
    expect(next.moveCount).toEqual({ white: 1, black: 0 });
    expect(next.currentTurn).toBe("black");
    expect(next.moves[0].capturedPiece).toBeNull();
  });

  it("marks the moved piece as hasMoved", () => {
    const rook = makePiece("white", "rook", 0, 4);
    const state = makeState([rook, whiteKing(), blackKing()]);
    const next = applyMoveToState(state, rook, pos(0, 3));
    expect(next.pieces.find((p) => p.id === rook.id)?.hasMoved).toBe(true);
  });

  it("detects back-rank checkmate: gameOver with winner set", () => {
    const rook = makePiece("white", "rook", 0, 4);
    const state = makeState([
      rook,
      whiteKing(),
      blackKing(),
      makePiece("black", "pawn", 3, 1),
      makePiece("black", "pawn", 4, 1),
      makePiece("black", "pawn", 5, 1),
    ]);
    const next = applyMoveToState(state, rook, pos(0, 0));
    expect(next.isCheck).toBe(true);
    expect(next.gameOver).toBe(true);
    expect(next.winner).toBe("white");
    expect(next.drawReason).toBeUndefined();
  });

  it("detects stalemate: gameOver, winner null, drawReason stalemate", () => {
    const queen = makePiece("white", "queen", 2, 4);
    const state = makeState([
      queen,
      makePiece("white", "king", 7, 7),
      makePiece("black", "king", 0, 0),
    ]);
    const next = applyMoveToState(state, queen, pos(2, 1));
    expect(next.isCheck).toBe(false);
    expect(next.gameOver).toBe(true);
    expect(next.winner).toBeNull();
    expect(next.drawReason).toBe("stalemate");
  });

  it("declares an only-kings draw after the last non-king piece is captured", () => {
    const king = makePiece("white", "king", 4, 4);
    const victim = makePiece("black", "pawn", 5, 5);
    const state = makeState([king, victim, makePiece("black", "king", 0, 0)]);
    const next = applyMoveToState(state, king, pos(5, 5));
    expect(next.gameOver).toBe(true);
    expect(next.winner).toBeNull();
    expect(next.drawReason).toBe("only-kings");
  });

  it("ends the game immediately when the king is captured", () => {
    const rook = makePiece("white", "rook", 0, 0);
    const state = makeState([rook, whiteKing(), blackKing()]);
    const next = applyMoveToState(state, rook, pos(4, 0));
    expect(next.gameOver).toBe(true);
    expect(next.winner).toBe("white");
    expect(next.isCheck).toBe(false);
  });
});

describe("hasLegalMoves", () => {
  it("returns true in an ordinary position", () => {
    const pieces = [whiteKing(), blackKing(), makePiece("white", "rook", 0, 4)];
    expect(hasLegalMoves("white", pieces, CLASSIC)).toBe(true);
    expect(hasLegalMoves("black", pieces, CLASSIC)).toBe(true);
  });

  it("returns false in a back-rank checkmate position", () => {
    const pieces = [
      blackKing(),
      whiteKing(),
      makePiece("white", "rook", 0, 0),
      makePiece("black", "pawn", 3, 1),
      makePiece("black", "pawn", 4, 1),
      makePiece("black", "pawn", 5, 1),
    ];
    expect(isInCheck("black", pieces, CLASSIC)).toBe(true);
    expect(hasLegalMoves("black", pieces, CLASSIC)).toBe(false);
  });
});

describe("hasRawMoves", () => {
  it("returns false for a piece with no geometric moves", () => {
    const rook = makePiece("white", "rook", 0, 7);
    const pieces = [
      rook,
      makePiece("white", "pawn", 0, 6),
      makePiece("white", "knight", 1, 7),
    ];
    expect(hasRawMoves(rook, pieces, CLASSIC)).toBe(false);
  });

  it("returns true as soon as one geometric move exists", () => {
    const rook = makePiece("white", "rook", 0, 7);
    expect(hasRawMoves(rook, [rook], CLASSIC)).toBe(true);
  });
});

// ── 7. Borderless mode ───────────────────────────────────────────────────────

describe("borderless mode", () => {
  it("lets a rook wrap horizontally around the x edge", () => {
    const rook = makePiece("white", "rook", 0, 4);
    const blocker = makePiece("white", "pawn", 3, 4);
    // Direct path to (7,4) is blocked, but wrapping left (x=-1 → 7) is clear.
    expect(isValidMove(rook, pos(7, 4), [rook, blocker], BORDERLESS)).toBe(
      false,
    );
    expect(isValidMove(rook, pos(-1, 4), [rook, blocker], BORDERLESS)).toBe(
      true,
    );
  });

  it("lets a queen wrap horizontally using virtual coordinates", () => {
    const queen = makePiece("white", "queen", 6, 4);
    expect(isValidMove(queen, pos(9, 4), [queen], BORDERLESS)).toBe(true); // lands on (1,4)
  });

  it("forbids white from wrapping across the bottom edge (y > 7)", () => {
    const rook = makePiece("white", "rook", 4, 6);
    expect(isValidMove(rook, pos(4, 9), [rook], BORDERLESS)).toBe(false);
  });

  it("forbids black from wrapping across the top edge (y < 0)", () => {
    const rook = makePiece("black", "rook", 4, 1);
    expect(isValidMove(rook, pos(4, -2), [rook], BORDERLESS)).toBe(false);
  });

  it("allows white to wrap across the top edge", () => {
    const rook = makePiece("white", "rook", 4, 1);
    // y: 1 → -2 wraps over the top edge, landing on (4,6)
    expect(isValidMove(rook, pos(4, -2), [rook], BORDERLESS)).toBe(true);
  });

  it("isInCheck detects a wrap-around attack missed in classic mode", () => {
    const rook = makePiece("white", "rook", 4, 2);
    const blocker = makePiece("black", "pawn", 4, 3); // blocks the direct path
    const bKing = makePiece("black", "king", 4, 5);
    const wKing = makePiece("white", "king", 0, 7);
    const pieces = [rook, blocker, bKing, wKing];
    // White rook reaches (4,5) by wrapping up through y=0 → y=7 → y=5.
    expect(isInCheck("black", pieces, BORDERLESS)).toBe(true);
    expect(isInCheck("black", pieces, CLASSIC)).toBe(false);
  });

  it("isInCheck ignores wrap paths through the attacker's forbidden edge", () => {
    const rook = makePiece("black", "rook", 4, 2);
    const blocker = makePiece("white", "pawn", 4, 3); // blocks the direct path
    const wKing = makePiece("white", "king", 4, 5);
    const bKing = makePiece("black", "king", 0, 0);
    const pieces = [rook, blocker, wKing, bKing];
    // The only wrap route for the black rook crosses y < 0, which black may not do.
    expect(isInCheck("white", pieces, BORDERLESS)).toBe(false);
  });
});

// ── 8. Assimilation mode ─────────────────────────────────────────────────────

describe("assimilation mode", () => {
  it("a rook with acquired bishop movement can move diagonally", () => {
    const rook = makePiece("white", "rook", 3, 3, {
      acquiredTypes: ["bishop"],
    });
    expect(isValidMove(rook, pos(5, 5), [rook], ASSIMILATION)).toBe(true);
    expect(isValidMove(rook, pos(3, 6), [rook], ASSIMILATION)).toBe(true); // still a rook too
  });

  it("a plain rook cannot move diagonally in classic mode", () => {
    const rook = makePiece("white", "rook", 3, 3);
    expect(isValidMove(rook, pos(5, 5), [rook], CLASSIC)).toBe(false);
  });

  it("acquiredTypes are ignored under classic rules — piece only has its base type", () => {
    const rook = makePiece("white", "rook", 3, 3, {
      acquiredTypes: ["bishop"],
    });
    expect(isValidMove(rook, pos(5, 5), [rook], CLASSIC)).toBe(false);
  });

  it("getValidMoves includes diagonal squares for a rook with acquired bishop", () => {
    const rook = makePiece("white", "rook", 3, 3, {
      acquiredTypes: ["bishop"],
    });
    const pieces = [rook, whiteKing(), blackKing()];
    const moves = getValidMoves(rook, pieces, ASSIMILATION);
    expect(includesPos(moves, 5, 5)).toBe(true);
    expect(includesPos(moves, 1, 1)).toBe(true);
    expect(includesPos(moves, 3, 6)).toBe(true);
  });

  it("applyMoveToState merges the captured piece's types onto the capturer", () => {
    const rook = makePiece("white", "rook", 0, 4);
    const victim = makePiece("black", "bishop", 0, 1, {
      acquiredTypes: ["knight"],
    });
    const state = makeState(
      [rook, victim, whiteKing(), makePiece("black", "king", 7, 0)],
      ASSIMILATION,
    );
    const next = applyMoveToState(state, rook, pos(0, 1));
    const capturer = next.pieces.find((p) => p.id === rook.id)!;
    expect(capturer.acquiredTypes).toContain("bishop");
    expect(capturer.acquiredTypes).toContain("knight");
    expect(capturer.acquiredTypes).not.toContain("rook");
  });

  it("does not merge types on capture in classic mode", () => {
    const rook = makePiece("white", "rook", 0, 4);
    const victim = makePiece("black", "bishop", 0, 1);
    const state = makeState(
      [rook, victim, whiteKing(), makePiece("black", "king", 7, 0)],
      CLASSIC,
    );
    const next = applyMoveToState(state, rook, pos(0, 1));
    const capturer = next.pieces.find((p) => p.id === rook.id)!;
    expect(capturer.acquiredTypes).toBeUndefined();
  });
});

// ── 9. Known limitation: no en passant ───────────────────────────────────────

describe("en passant (known limitation)", () => {
  // En passant is NOT implemented: a pawn can never capture diagonally onto an
  // empty square, even immediately after the opponent's adjacent double step.
  // This test locks the current behavior.
  it("a pawn cannot capture en passant right after an adjacent double step", () => {
    const whitePawn = makePiece("white", "pawn", 4, 3);
    const blackPawn = makePiece("black", "pawn", 3, 1);
    const state = makeState(
      [whitePawn, blackPawn, whiteKing(), blackKing()],
      CLASSIC,
      { currentTurn: "black" },
    );
    const next = applyMoveToState(state, blackPawn, pos(3, 3)); // double step lands beside the white pawn
    const wp = next.pieces.find((p) => p.id === whitePawn.id)!;
    // The en passant target square (3,2) is empty → the diagonal move is invalid.
    expect(isValidMove(wp, pos(3, 2), next.pieces, CLASSIC)).toBe(false);
    expect(includesPos(getValidMoves(wp, next.pieces, CLASSIC), 3, 2)).toBe(
      false,
    );
  });
});
