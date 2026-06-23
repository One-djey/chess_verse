import { describe, it, expect } from "vitest";
import { makePiece } from "../../test/helpers";
import {
  WAVE_COMPOSITIONS,
  getWaveComposition,
  getWave10PlusComposition,
  getSpawnRows,
  getSpawnThreshold,
  shouldSpawnWave,
  countActiveZombies,
  getSpawnableSquares,
  buildWavePieces,
} from "./zombieWaves";

// ── Wave compositions ────────────────────────────────────────────────────────

describe("WAVE_COMPOSITIONS", () => {
  it("has exactly 9 entries (waves 1–9)", () => {
    expect(WAVE_COMPOSITIONS).toHaveLength(9);
  });

  it("wave 1 is 3 pawns", () => {
    expect(WAVE_COMPOSITIONS[0]).toEqual(["pawn", "pawn", "pawn"]);
  });

  it("wave 3 has 3 pawns + 1 knight", () => {
    expect(WAVE_COMPOSITIONS[2]).toEqual(["pawn", "pawn", "pawn", "knight"]);
  });

  it("wave 6 has 2 pawns + 1 rook", () => {
    expect(WAVE_COMPOSITIONS[5]).toEqual(["pawn", "pawn", "rook"]);
  });

  it("wave 9 has 3 pawns + 1 queen", () => {
    expect(WAVE_COMPOSITIONS[8]).toEqual(["pawn", "pawn", "pawn", "queen"]);
  });
});

describe("getWaveComposition", () => {
  it("returns empty array for wave 0 or below", () => {
    expect(getWaveComposition(0)).toEqual([]);
    expect(getWaveComposition(-1)).toEqual([]);
  });

  it("returns WAVE_COMPOSITIONS[wave-1] for waves 1–9", () => {
    for (let w = 1; w <= 9; w++) {
      expect(getWaveComposition(w)).toEqual(WAVE_COMPOSITIONS[w - 1]);
    }
  });

  it("returns wave 10+ composition for wave 10", () => {
    const comp = getWaveComposition(10);
    expect(comp.length).toBeGreaterThanOrEqual(5);
    expect(comp).toContain("queen");
    expect(comp).toContain("rook");
  });
});

describe("getWave10PlusComposition", () => {
  it("returns base composition for wave 10", () => {
    const comp = getWave10PlusComposition(10);
    expect(comp).toContain("queen");
    expect(comp).toContain("rook");
  });

  it("escalates for each wave beyond 10", () => {
    const comp10 = getWave10PlusComposition(10);
    const comp12 = getWave10PlusComposition(12);
    expect(comp12.length).toBeGreaterThan(comp10.length);
  });
});

// ── Spawn rows ───────────────────────────────────────────────────────────────

describe("getSpawnRows", () => {
  it("returns only y=0 for waves 1–3", () => {
    expect(getSpawnRows(1)).toEqual([0]);
    expect(getSpawnRows(2)).toEqual([0]);
    expect(getSpawnRows(3)).toEqual([0]);
  });

  it("returns y=0 and y=1 for waves 4–6", () => {
    expect(getSpawnRows(4)).toEqual([0, 1]);
    expect(getSpawnRows(5)).toEqual([0, 1]);
    expect(getSpawnRows(6)).toEqual([0, 1]);
  });

  it("returns y=0, y=1 and y=2 for waves 7 and above", () => {
    expect(getSpawnRows(7)).toEqual([0, 1, 2]);
    expect(getSpawnRows(10)).toEqual([0, 1, 2]);
    expect(getSpawnRows(15)).toEqual([0, 1, 2]);
  });
});

// ── Spawn thresholds ─────────────────────────────────────────────────────────

describe("getSpawnThreshold", () => {
  it("waves 1–3: minActive=2, delayMoves=4", () => {
    expect(getSpawnThreshold(1)).toEqual({ minActive: 2, delayMoves: 4 });
    expect(getSpawnThreshold(3)).toEqual({ minActive: 2, delayMoves: 4 });
  });

  it("waves 4–6: minActive=3, delayMoves=3", () => {
    expect(getSpawnThreshold(4)).toEqual({ minActive: 3, delayMoves: 3 });
    expect(getSpawnThreshold(6)).toEqual({ minActive: 3, delayMoves: 3 });
  });

  it("waves 7–9: minActive=4, delayMoves=2", () => {
    expect(getSpawnThreshold(7)).toEqual({ minActive: 4, delayMoves: 2 });
    expect(getSpawnThreshold(9)).toEqual({ minActive: 4, delayMoves: 2 });
  });

  it("wave 10+: minActive=5, delayMoves=1", () => {
    expect(getSpawnThreshold(10)).toEqual({ minActive: 5, delayMoves: 1 });
    expect(getSpawnThreshold(20)).toEqual({ minActive: 5, delayMoves: 1 });
  });
});

// ── shouldSpawnWave ──────────────────────────────────────────────────────────

describe("shouldSpawnWave", () => {
  it("returns true when activeZombies < minActive, regardless of delay", () => {
    // wave 1: minActive=2
    expect(shouldSpawnWave(1, 0, 0)).toBe(true);
    expect(shouldSpawnWave(1, 1, 0)).toBe(true);
  });

  it("returns false when activeZombies >= minActive and delay not reached", () => {
    // wave 1: minActive=2, delayMoves=4
    expect(shouldSpawnWave(1, 2, 0)).toBe(false);
    expect(shouldSpawnWave(1, 5, 3)).toBe(false);
  });

  it("returns true when activeZombies >= minActive and delay is reached", () => {
    // wave 1: minActive=2, delayMoves=4
    expect(shouldSpawnWave(1, 2, 4)).toBe(true);
    expect(shouldSpawnWave(1, 10, 5)).toBe(true);
  });

  it("wave 10+ triggers after 1 player move when active >= 5", () => {
    expect(shouldSpawnWave(10, 5, 1)).toBe(true);
    expect(shouldSpawnWave(10, 5, 0)).toBe(false);
  });
});

// ── countActiveZombies ───────────────────────────────────────────────────────

describe("countActiveZombies", () => {
  it("returns 0 when there are no black pieces", () => {
    const pieces = [
      makePiece("white", "king", 4, 7),
      makePiece("white", "pawn", 4, 6),
    ];
    expect(countActiveZombies(pieces)).toBe(0);
  });

  it("counts only black pieces", () => {
    const pieces = [
      makePiece("white", "king", 4, 7),
      makePiece("black", "pawn", 4, 0),
      makePiece("black", "pawn", 5, 0),
      makePiece("white", "queen", 3, 6),
    ];
    expect(countActiveZombies(pieces)).toBe(2);
  });
});

// ── getSpawnableSquares ──────────────────────────────────────────────────────

describe("getSpawnableSquares", () => {
  it("returns empty array when all spawn rows are occupied", () => {
    const pieces = [];
    // Fill all 8 squares of row 0
    for (let x = 0; x < 8; x++) {
      pieces.push(makePiece("black", "pawn", x, 0));
    }
    pieces.push(makePiece("white", "king", 4, 7));
    const squares = getSpawnableSquares(1, pieces);
    expect(squares).toHaveLength(0);
  });

  it("excludes occupied squares", () => {
    const pieces = [
      makePiece("white", "king", 4, 7),
      makePiece("black", "pawn", 0, 0),
    ];
    const squares = getSpawnableSquares(1, pieces);
    const at00 = squares.find((s) => s.x === 0 && s.y === 0);
    expect(at00).toBeUndefined();
  });

  it("excludes squares attacked by white pieces", () => {
    // White rook at a8 (x=0, y=0) would attack... wait, rook at (0,7) attacks column 0
    // White rook at (0,7) attacks all of column 0 (y=0..7)
    const pieces = [
      makePiece("white", "king", 7, 7),
      makePiece("white", "rook", 0, 7),
    ];
    // For wave 1, spawn row is y=0. Column 0, y=0 is attacked by the rook.
    const squares = getSpawnableSquares(1, pieces);
    const at0 = squares.find((s) => s.x === 0 && s.y === 0);
    expect(at0).toBeUndefined();
    // Other columns in row 0 should be available
    expect(squares.some((s) => s.y === 0 && s.x > 0)).toBe(true);
  });

  it("returns squares only in spawn rows for the given wave", () => {
    const pieces = [makePiece("white", "king", 4, 7)];
    const squaresW1 = getSpawnableSquares(1, pieces);
    expect(squaresW1.every((s) => s.y === 0)).toBe(true);

    const squaresW4 = getSpawnableSquares(4, pieces);
    expect(squaresW4.every((s) => s.y === 0 || s.y === 1)).toBe(true);

    const squaresW7 = getSpawnableSquares(7, pieces);
    expect(squaresW7.every((s) => s.y >= 0 && s.y <= 2)).toBe(true);
  });
});

// ── buildWavePieces ──────────────────────────────────────────────────────────

describe("buildWavePieces", () => {
  const squares = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
    { x: 4, y: 0 },
  ];

  it("creates pieces matching the wave composition", () => {
    const pieces = buildWavePieces(1, squares, 0);
    expect(pieces).toHaveLength(3);
    expect(pieces.every((p) => p.type === "pawn")).toBe(true);
    expect(pieces.every((p) => p.color === "black")).toBe(true);
  });

  it("assigns unique ids using the totalSpawnedSoFar counter", () => {
    const pieces = buildWavePieces(1, squares, 10);
    const ids = pieces.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length); // all unique
    expect(ids[0]).toBe("zh10");
    expect(ids[2]).toBe("zh12");
  });

  it("uses spawnableSquares positions for piece positions", () => {
    const pieces = buildWavePieces(1, squares, 0);
    expect(pieces[0].position).toEqual({ x: 0, y: 0 });
    expect(pieces[1].position).toEqual({ x: 1, y: 0 });
  });

  it("spawns fewer pieces if not enough spawn squares", () => {
    const twoSquares = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
    const pieces = buildWavePieces(1, twoSquares, 0); // wave 1 wants 3 pawns
    expect(pieces).toHaveLength(2);
  });

  it("builds wave 9 pieces (3 pawns + 1 queen)", () => {
    const pieces = buildWavePieces(9, squares, 0);
    expect(pieces).toHaveLength(4);
    const types = pieces.map((p) => p.type);
    expect(types.filter((t) => t === "pawn")).toHaveLength(3);
    expect(types.filter((t) => t === "queen")).toHaveLength(1);
  });

  it("does not give spawned pieces acquiredTypes", () => {
    const pieces = buildWavePieces(3, squares, 0);
    expect(pieces.every((p) => p.acquiredTypes === undefined)).toBe(true);
  });
});
