import { describe, expect, it } from "vitest";
import type { Position } from "../../types/chess";
import type { Arena } from "../../types/coliseum";
import { includesPos, makePiece, pos } from "../../test/helpers";
import {
  applyColiseumMove,
  getColiseumLegalMoves,
  getColiseumValidMoves,
  hasNoLegalMoves,
  isColiseumInCheck,
  isColiseumSquareUnderAttack,
} from "./coliseumMoves";

// ---------------------------------------------------------------------------
// Arena fixtures
// ---------------------------------------------------------------------------

/** Builds a minimal valid Arena from a grid (0 = void, 1 = playable). */
function makeArena(grid: number[][]): Arena {
  const totalCells = grid.flat().filter((c) => c === 1).length;
  return {
    grid,
    spawnZones: [],
    pieces: [],
    totalCells,
    freeCells: totalCells,
    attempts: 1,
    elapsed: 0,
    fallback: false,
    seed: 0,
  };
}

/** Fully playable square arena (default 8x8). */
function openArena(size = 8): Arena {
  return makeArena(Array.from({ length: size }, () => Array(size).fill(1)));
}

/**
 * 5x5 arena where only the center (2,2) and the 8 knight-move targets are
 * playable — every adjacent square is void.
 */
function knightIslandArena(): Arena {
  return makeArena([
    [0, 1, 0, 1, 0],
    [1, 0, 0, 0, 1],
    [0, 0, 1, 0, 0],
    [1, 0, 0, 0, 1],
    [0, 1, 0, 1, 0],
  ]);
}

/** 5x5 plus-shaped arena: only row y=2 and column x=2 are playable. */
function plusArena(): Arena {
  return makeArena([
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [1, 1, 1, 1, 1],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
  ]);
}

/** Asserts that two move lists contain exactly the same squares (any order). */
function expectMoves(actual: Position[], expected: Position[]): void {
  const key = (p: Position) => `${p.x},${p.y}`;
  expect([...actual].map(key).sort()).toEqual([...expected].map(key).sort());
}

// ---------------------------------------------------------------------------
// getColiseumValidMoves — pawn (omnidirectional)
// ---------------------------------------------------------------------------

describe("getColiseumValidMoves — pawn", () => {
  it("moves one step in all 4 orthogonal directions on an open arena", () => {
    const pawn = makePiece("white", "pawn", 4, 4);
    const moves = getColiseumValidMoves(pawn, [pawn], openArena());
    expectMoves(moves, [pos(5, 4), pos(3, 4), pos(4, 5), pos(4, 3)]);
  });

  it("captures diagonally but cannot capture or move onto an occupied orthogonal square", () => {
    const pawn = makePiece("white", "pawn", 4, 4);
    const diagEnemy = makePiece("black", "pawn", 5, 5);
    const orthoEnemy = makePiece("black", "pawn", 5, 4);
    const moves = getColiseumValidMoves(
      pawn,
      [pawn, diagEnemy, orthoEnemy],
      openArena(),
    );
    // (5,4) is blocked (no orthogonal capture); (5,5) is a diagonal capture.
    expectMoves(moves, [pos(3, 4), pos(4, 5), pos(4, 3), pos(5, 5)]);
  });

  it("cannot capture a friendly piece on a diagonal", () => {
    const pawn = makePiece("white", "pawn", 4, 4);
    const friend = makePiece("white", "knight", 5, 5);
    const moves = getColiseumValidMoves(pawn, [pawn, friend], openArena());
    expectMoves(moves, [pos(5, 4), pos(3, 4), pos(4, 5), pos(4, 3)]);
  });

  it("has only 2 moves from the arena corner", () => {
    const pawn = makePiece("white", "pawn", 0, 0);
    const moves = getColiseumValidMoves(pawn, [pawn], openArena());
    expectMoves(moves, [pos(1, 0), pos(0, 1)]);
  });

  it("cannot step onto a void cell", () => {
    const arena = openArena();
    arena.grid[3][4] = 0; // void at (x=4, y=3)
    const pawn = makePiece("white", "pawn", 4, 4);
    const moves = getColiseumValidMoves(pawn, [pawn], arena);
    expectMoves(moves, [pos(5, 4), pos(3, 4), pos(4, 5)]);
  });
});

// ---------------------------------------------------------------------------
// getColiseumValidMoves — knight
// ---------------------------------------------------------------------------

describe("getColiseumValidMoves — knight", () => {
  it("has all 8 jumps from the center of an open arena", () => {
    const knight = makePiece("white", "knight", 4, 4);
    const moves = getColiseumValidMoves(knight, [knight], openArena());
    expectMoves(moves, [
      pos(5, 6),
      pos(3, 6),
      pos(5, 2),
      pos(3, 2),
      pos(6, 5),
      pos(2, 5),
      pos(6, 3),
      pos(2, 3),
    ]);
  });

  it("jumps over void cells (all neighbors void, landing squares playable)", () => {
    const knight = makePiece("white", "knight", 2, 2);
    const moves = getColiseumValidMoves(knight, [knight], knightIslandArena());
    expectMoves(moves, [
      pos(3, 4),
      pos(1, 4),
      pos(3, 0),
      pos(1, 0),
      pos(4, 3),
      pos(0, 3),
      pos(4, 1),
      pos(0, 1),
    ]);
  });

  it("cannot land on a void cell", () => {
    const arena = openArena();
    arena.grid[6][5] = 0; // void at (x=5, y=6)
    const knight = makePiece("white", "knight", 4, 4);
    const moves = getColiseumValidMoves(knight, [knight], arena);
    expect(moves).toHaveLength(7);
    expect(includesPos(moves, 5, 6)).toBe(false);
  });

  it("can capture an enemy but not land on a friendly piece", () => {
    const knight = makePiece("white", "knight", 4, 4);
    const friend = makePiece("white", "pawn", 5, 6);
    const enemy = makePiece("black", "pawn", 3, 6);
    const moves = getColiseumValidMoves(knight, [knight, friend, enemy], openArena());
    expect(moves).toHaveLength(7);
    expect(includesPos(moves, 5, 6)).toBe(false);
    expect(includesPos(moves, 3, 6)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getColiseumValidMoves — sliding pieces
// ---------------------------------------------------------------------------

describe("getColiseumValidMoves — rook", () => {
  it("has 14 moves from the center of an open 8x8 arena", () => {
    const rook = makePiece("white", "rook", 4, 4);
    const moves = getColiseumValidMoves(rook, [rook], openArena());
    expect(moves).toHaveLength(14);
  });

  it("is blocked by a void cell mid-ray", () => {
    const arena = openArena();
    arena.grid[2][4] = 0; // void at (x=4, y=2)
    const rook = makePiece("white", "rook", 4, 4);
    const moves = getColiseumValidMoves(rook, [rook], arena);
    expect(includesPos(moves, 4, 3)).toBe(true);
    expect(includesPos(moves, 4, 2)).toBe(false); // the void cell itself
    expect(includesPos(moves, 4, 1)).toBe(false); // behind the void
    expect(includesPos(moves, 4, 0)).toBe(false);
  });

  it("stops on an enemy piece (capture included, squares behind excluded)", () => {
    const rook = makePiece("white", "rook", 0, 0);
    const enemy = makePiece("black", "pawn", 0, 3);
    const moves = getColiseumValidMoves(rook, [rook, enemy], openArena());
    // column: (0,1),(0,2),(0,3 capture); row: (1..7, 0)
    expect(moves).toHaveLength(10);
    expect(includesPos(moves, 0, 3)).toBe(true);
    expect(includesPos(moves, 0, 4)).toBe(false);
  });

  it("stops before a friendly piece (square excluded)", () => {
    const rook = makePiece("white", "rook", 0, 0);
    const friend = makePiece("white", "pawn", 0, 3);
    const moves = getColiseumValidMoves(rook, [rook, friend], openArena());
    // column: (0,1),(0,2); row: (1..7, 0)
    expect(moves).toHaveLength(9);
    expect(includesPos(moves, 0, 3)).toBe(false);
  });

  it("covers the whole cross of a plus-shaped arena from its center", () => {
    const rook = makePiece("white", "rook", 2, 2);
    const moves = getColiseumValidMoves(rook, [rook], plusArena());
    expect(moves).toHaveLength(8);
  });

  it("has 14 moves from the corner of an open 8x8 arena", () => {
    const rook = makePiece("white", "rook", 0, 0);
    const moves = getColiseumValidMoves(rook, [rook], openArena());
    expect(moves).toHaveLength(14);
  });
});

describe("getColiseumValidMoves — bishop", () => {
  it("has 13 moves from (4,4) on an open 8x8 arena", () => {
    const bishop = makePiece("white", "bishop", 4, 4);
    const moves = getColiseumValidMoves(bishop, [bishop], openArena());
    expect(moves).toHaveLength(13);
  });

  it("has no moves at the center of a plus-shaped arena (all diagonals are void)", () => {
    const bishop = makePiece("white", "bishop", 2, 2);
    const moves = getColiseumValidMoves(bishop, [bishop], plusArena());
    expect(moves).toHaveLength(0);
  });
});

describe("getColiseumValidMoves — queen", () => {
  it("has 27 moves from (4,4) on an open 8x8 arena", () => {
    const queen = makePiece("white", "queen", 4, 4);
    const moves = getColiseumValidMoves(queen, [queen], openArena());
    expect(moves).toHaveLength(27);
  });
});

// ---------------------------------------------------------------------------
// getColiseumValidMoves — king
// ---------------------------------------------------------------------------

describe("getColiseumValidMoves — king", () => {
  it("has 8 one-step moves from the center of an open arena", () => {
    const king = makePiece("white", "king", 4, 4);
    const moves = getColiseumValidMoves(king, [king], openArena());
    expect(moves).toHaveLength(8);
  });

  it("has 3 moves from the arena corner", () => {
    const king = makePiece("white", "king", 0, 0);
    const moves = getColiseumValidMoves(king, [king], openArena());
    expectMoves(moves, [pos(1, 0), pos(0, 1), pos(1, 1)]);
  });

  it("never offers castling, even with an unmoved rook on the same rank", () => {
    const king = makePiece("white", "king", 4, 7, { hasMoved: false });
    const rook = makePiece("white", "rook", 7, 7, { hasMoved: false });
    const moves = getColiseumValidMoves(king, [king, rook], openArena());
    expectMoves(moves, [
      pos(3, 7),
      pos(5, 7),
      pos(3, 6),
      pos(4, 6),
      pos(5, 6),
    ]);
    expect(includesPos(moves, 6, 7)).toBe(false); // no O-O target square
  });
});

// ---------------------------------------------------------------------------
// isColiseumSquareUnderAttack
// ---------------------------------------------------------------------------

describe("isColiseumSquareUnderAttack", () => {
  it("detects a rook attacking a square along a clear ray", () => {
    const rook = makePiece("white", "rook", 0, 0);
    expect(
      isColiseumSquareUnderAttack(pos(0, 5), "white", [rook], openArena()),
    ).toBe(true);
  });

  it("does not detect an attack through a blocking piece", () => {
    const rook = makePiece("white", "rook", 0, 0);
    const blocker = makePiece("black", "pawn", 0, 3);
    expect(
      isColiseumSquareUnderAttack(
        pos(0, 5),
        "white",
        [rook, blocker],
        openArena(),
      ),
    ).toBe(false);
  });

  it("reports an empty diagonal square as attacked by a pawn (BUG-009 fixed)", () => {
    const pawn = makePiece("white", "pawn", 4, 4);
    expect(
      isColiseumSquareUnderAttack(pos(5, 5), "white", [pawn], openArena()),
    ).toBe(true);
  });

  it("reports a diagonal square occupied by an enemy as attacked by a pawn", () => {
    const pawn = makePiece("white", "pawn", 4, 4);
    const enemy = makePiece("black", "knight", 5, 5);
    expect(
      isColiseumSquareUnderAttack(
        pos(5, 5),
        "white",
        [pawn, enemy],
        openArena(),
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isColiseumInCheck
// ---------------------------------------------------------------------------

describe("isColiseumInCheck", () => {
  it("returns true when an enemy rook sees the king on a clear ray", () => {
    const king = makePiece("white", "king", 0, 4);
    const rook = makePiece("black", "rook", 7, 4);
    expect(isColiseumInCheck("white", [king, rook], openArena())).toBe(true);
  });

  it("returns false when no enemy piece attacks the king", () => {
    const king = makePiece("white", "king", 0, 4);
    const rook = makePiece("black", "rook", 7, 5);
    expect(isColiseumInCheck("white", [king, rook], openArena())).toBe(false);
  });

  it("returns false when a void cell blocks the checking ray", () => {
    const arena = openArena();
    arena.grid[4][3] = 0; // void at (x=3, y=4), between rook and king
    const king = makePiece("white", "king", 0, 4);
    const rook = makePiece("black", "rook", 7, 4);
    expect(isColiseumInCheck("white", [king, rook], arena)).toBe(false);
  });

  it("returns true for a pawn checking diagonally (omnidirectional, including 'backwards')", () => {
    const king = makePiece("black", "king", 4, 4);
    const pawn = makePiece("white", "pawn", 5, 5);
    expect(isColiseumInCheck("black", [king, pawn], openArena())).toBe(true);
  });

  it("returns false for a pawn orthogonally adjacent to the king (no orthogonal capture)", () => {
    const king = makePiece("black", "king", 4, 4);
    const pawn = makePiece("white", "pawn", 4, 5);
    expect(isColiseumInCheck("black", [king, pawn], openArena())).toBe(false);
  });

  it("returns true for a knight checking across void cells", () => {
    const king = makePiece("black", "king", 2, 2);
    const knight = makePiece("white", "knight", 1, 0);
    expect(
      isColiseumInCheck("black", [king, knight], knightIslandArena()),
    ).toBe(true);
  });

  it("returns false when the color has no king on the board", () => {
    const rook = makePiece("black", "rook", 7, 4);
    expect(isColiseumInCheck("white", [rook], openArena())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyColiseumMove
// ---------------------------------------------------------------------------

describe("applyColiseumMove", () => {
  it("updates the moved piece's position and sets hasMoved", () => {
    const rook = makePiece("white", "rook", 0, 0);
    const result = applyColiseumMove(rook, pos(0, 5), [rook]);
    expect(result).toHaveLength(1);
    expect(result[0].position).toEqual(pos(0, 5));
    expect(result[0].hasMoved).toBe(true);
  });

  it("removes the captured piece from the board", () => {
    const rook = makePiece("white", "rook", 0, 0);
    const victim = makePiece("black", "pawn", 0, 5);
    const result = applyColiseumMove(rook, pos(0, 5), [rook, victim]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(rook.id);
    expect(result.find((p) => p.id === victim.id)).toBeUndefined();
  });

  it("does not promote a pawn reaching the far edge (stays a pawn)", () => {
    const pawn = makePiece("white", "pawn", 4, 1);
    const result = applyColiseumMove(pawn, pos(4, 0), [pawn]);
    expect(result[0].type).toBe("pawn");
    expect(result[0].position).toEqual(pos(4, 0));
  });

  it("does not mutate the original pieces array or piece object", () => {
    const rook = makePiece("white", "rook", 0, 0);
    const pieces = [rook];
    applyColiseumMove(rook, pos(0, 5), pieces);
    expect(pieces).toHaveLength(1);
    expect(rook.position).toEqual(pos(0, 0));
    expect(rook.hasMoved).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getColiseumLegalMoves
// ---------------------------------------------------------------------------

describe("getColiseumLegalMoves", () => {
  it("restricts a pinned rook to the pin ray (capture of the pinner allowed)", () => {
    const king = makePiece("white", "king", 0, 4);
    const pinned = makePiece("white", "rook", 3, 4);
    const pinner = makePiece("black", "rook", 7, 4);
    const pieces = [king, pinned, pinner];
    const legal = getColiseumLegalMoves(pinned, pieces, openArena());
    expectMoves(legal, [
      pos(1, 4),
      pos(2, 4),
      pos(4, 4),
      pos(5, 4),
      pos(6, 4),
      pos(7, 4), // capturing the pinner
    ]);
    // raw moves DID include vertical squares, the legality filter removed them
    const raw = getColiseumValidMoves(pinned, pieces, openArena());
    expect(includesPos(raw, 3, 3)).toBe(true);
    expect(includesPos(legal, 3, 3)).toBe(false);
  });

  it("forbids the king from stepping into an attacked square", () => {
    const king = makePiece("white", "king", 0, 0);
    const rook = makePiece("black", "rook", 7, 1); // controls row y=1
    const legal = getColiseumLegalMoves(king, [king, rook], openArena());
    expectMoves(legal, [pos(1, 0)]);
  });
});

// ---------------------------------------------------------------------------
// hasNoLegalMoves
// ---------------------------------------------------------------------------

describe("hasNoLegalMoves", () => {
  it("detects a two-rook corner mate (arena-mate)", () => {
    const king = makePiece("black", "king", 0, 0);
    const rookA = makePiece("white", "rook", 0, 7); // checks column x=0
    const rookB = makePiece("white", "rook", 1, 7); // fences column x=1
    const pieces = [king, rookA, rookB];
    const arena = openArena();
    expect(isColiseumInCheck("black", pieces, arena)).toBe(true);
    expect(hasNoLegalMoves("black", pieces, arena)).toBe(true);
  });

  it("detects a single-rook mate in a 1-row corridor arena", () => {
    const arena = makeArena([[1, 1, 1, 1]]);
    const king = makePiece("black", "king", 0, 0);
    const rook = makePiece("white", "rook", 3, 0);
    const pieces = [king, rook];
    expect(isColiseumInCheck("black", pieces, arena)).toBe(true);
    expect(hasNoLegalMoves("black", pieces, arena)).toBe(true);
  });

  it("detects a corner stalemate (no check, no legal move)", () => {
    const king = makePiece("black", "king", 0, 0);
    const rookA = makePiece("white", "rook", 1, 7); // controls column x=1
    const rookB = makePiece("white", "rook", 7, 1); // controls row y=1
    const pieces = [king, rookA, rookB];
    const arena = openArena();
    expect(isColiseumInCheck("black", pieces, arena)).toBe(false);
    expect(hasNoLegalMoves("black", pieces, arena)).toBe(true);
  });

  it("returns false for a lone king in an open arena", () => {
    const king = makePiece("black", "king", 4, 4);
    expect(hasNoLegalMoves("black", [king], openArena())).toBe(false);
  });

  it("returns false when the king is trapped but another piece can move", () => {
    const king = makePiece("black", "king", 0, 0);
    const rookA = makePiece("white", "rook", 1, 7);
    const rookB = makePiece("white", "rook", 7, 1);
    const freePawn = makePiece("black", "pawn", 5, 5);
    const pieces = [king, rookA, rookB, freePawn];
    expect(hasNoLegalMoves("black", pieces, openArena())).toBe(false);
  });
});
