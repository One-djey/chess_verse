import { describe, it, expect, beforeEach } from "vitest";
import type { Piece, PieceType, PieceColor } from "../../types/chess";
import type { Arena } from "../../types/coliseum";
import { getColiseumAIMove } from "./coliseumAI";

function makeArena(rows: number, cols: number, voids: [number, number][] = []): Arena {
  const voidSet = new Set(voids.map(([y, x]) => `${y},${x}`));
  const grid = Array.from({ length: rows }, (_, y) =>
    Array.from({ length: cols }, (_, x) => (voidSet.has(`${y},${x}`) ? 0 : 1)),
  );
  return {
    grid,
    spawnZones: [],
    pieces: [],
    totalCells: 0,
    freeCells: 0,
    attempts: 1,
    elapsed: 0,
    fallback: false,
    seed: 0,
  };
}

let _id = 0;
function p(type: PieceType, color: PieceColor, x: number, y: number): Piece {
  return { id: `${++_id}`, type, color, position: { x, y }, hasMoved: false };
}

describe("getColiseumAIMove", () => {
  beforeEach(() => {
    _id = 0;
  });

  it("prefers safe capture over safe non-capture", () => {
    // Black rook at (0,0), white queen at (3,0) — rook slides along y=0 and captures queen.
    // White king at (3,3) does not defend (3,0), so capture is safe.
    // Black king at (0,1) is not on any queen diagonal/line, so not in check.
    const arena = makeArena(4, 4);
    const pieces: Piece[] = [
      p("king", "black", 0, 1),
      p("rook", "black", 0, 0),
      p("queen", "white", 3, 0),
      p("king", "white", 3, 3),
    ];
    const move = getColiseumAIMove(pieces, arena);
    expect(move).not.toBeNull();
    expect(move!.to).toEqual({ x: 3, y: 0 });
  });

  it("prefers capturing highest-value piece among safe captures", () => {
    // Black knight at (2,2): can jump to white pawn at (0,1) and white queen at (4,3).
    // Both captures safe — queen (value 9) should be preferred over pawn (value 1).
    const arena = makeArena(5, 5);
    const pieces: Piece[] = [
      p("king", "black", 0, 0),
      p("knight", "black", 2, 2),
      p("pawn", "white", 0, 1),   // value 1
      p("queen", "white", 4, 3),  // value 9
      p("king", "white", 0, 4),
    ];
    const move = getColiseumAIMove(pieces, arena);
    expect(move).not.toBeNull();
    expect(move!.to).toEqual({ x: 4, y: 3 });
  });

  it("prefers safe non-capture over risky capture", () => {
    // Black pawn at (2,2): can capture white queen at (3,1) diagonally, but white king
    // at (2,0) guards (3,1) → risky. Safe moves (1,2) and (2,3) are available instead.
    const arena = makeArena(4, 4);
    const pieces: Piece[] = [
      p("king", "black", 0, 3),
      p("pawn", "black", 2, 2),
      p("queen", "white", 3, 1),
      p("king", "white", 2, 0),
    ];
    const move = getColiseumAIMove(pieces, arena);
    expect(move).not.toBeNull();
    // Must NOT take the queen — that square is guarded by the white king
    expect(move!.to).not.toEqual({ x: 3, y: 1 });
  });

  it("resolves check with non-king piece before moving the king", () => {
    // Black king at (1,0) is in check from white rook at (1,2) along the x=1 column.
    // Black bishop at (2,1) can capture the rook diagonally — risky but preferred over
    // moving the king (priority 2 > priority 3 in the check resolution chain).
    const arena = makeArena(3, 3);
    const pieces: Piece[] = [
      p("king", "black", 1, 0),
      p("bishop", "black", 2, 1),
      p("king", "white", 0, 2),
      p("rook", "white", 1, 2),
    ];
    const move = getColiseumAIMove(pieces, arena);
    expect(move).not.toBeNull();
    expect(move!.from).toEqual({ x: 2, y: 1 });
    expect(move!.to).toEqual({ x: 1, y: 2 });
  });

  it("returns null when black has no legal moves", () => {
    // Black king on the only playable cell — surrounded by void, cannot move.
    const arena: Arena = {
      grid: [[1, 0], [0, 0]],
      spawnZones: [],
      pieces: [],
      totalCells: 1,
      freeCells: 0,
      attempts: 1,
      elapsed: 0,
      fallback: false,
      seed: 0,
    };
    const pieces: Piece[] = [p("king", "black", 0, 0)];
    expect(getColiseumAIMove(pieces, arena)).toBeNull();
  });
});
