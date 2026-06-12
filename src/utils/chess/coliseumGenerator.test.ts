import { describe, it, expect } from "vitest";
import { generateColiseumArena } from "./coliseumGenerator";
import type { Arena, ArenaPieceType } from "../../types/coliseum";

// Invariant tests over a batch of seeded runs. The generator is procedural
// (multi-strategy with a time budget), so we assert structural invariants
// rather than exact outputs — except for seed determinism.

const SEEDS = Array.from({ length: 25 }, (_, i) => i + 1);

/** Expected per-player piece multiset (PIECE_ORDER in the generator). */
const EXPECTED_COUNTS: Record<ArenaPieceType, number> = {
  king: 1,
  queen: 1,
  rook: 2,
  bishop: 2,
  knight: 2,
  pawn: 8,
};

function countByType(arena: Arena, player: number) {
  const counts: Partial<Record<ArenaPieceType, number>> = {};
  for (const p of arena.pieces) {
    if (p.player !== player) continue;
    counts[p.piece] = (counts[p.piece] ?? 0) + 1;
  }
  return counts;
}

describe("generateColiseumArena — structural invariants (25 seeded runs)", () => {
  const arenas = SEEDS.map((seed) => generateColiseumArena(2, seed));

  it("never throws and always returns an arena", () => {
    expect(arenas).toHaveLength(SEEDS.length);
    for (const arena of arenas) expect(arena).toBeTruthy();
  });

  it("produces a square grid (trimArena pads to a square)", () => {
    for (const arena of arenas) {
      const size = arena.grid.length;
      expect(size).toBeGreaterThan(0);
      for (const row of arena.grid) expect(row).toHaveLength(size);
    }
  });

  it("places exactly 32 pieces: 16 per player, players 0 and 1 only", () => {
    for (const arena of arenas) {
      expect(arena.pieces).toHaveLength(32);
      expect(arena.pieces.filter((p) => p.player === 0)).toHaveLength(16);
      expect(arena.pieces.filter((p) => p.player === 1)).toHaveLength(16);
    }
  });

  it("gives each player the standard piece multiset (1K 1Q 2R 2B 2N 8P)", () => {
    for (const arena of arenas) {
      expect(countByType(arena, 0)).toEqual(EXPECTED_COUNTS);
      expect(countByType(arena, 1)).toEqual(EXPECTED_COUNTS);
    }
  });

  it("places every piece in-bounds on a playable cell", () => {
    for (const arena of arenas) {
      for (const p of arena.pieces) {
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThan(arena.grid.length);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThan(arena.grid[0].length);
        expect(arena.grid[p.y][p.x]).toBe(1);
      }
    }
  });

  it("never places two pieces on the same cell", () => {
    for (const arena of arenas) {
      const cells = new Set(arena.pieces.map((p) => `${p.y},${p.x}`));
      expect(cells.size).toBe(32);
    }
  });

  it("reports freeCells consistent with the grid and within the 2-player range", () => {
    for (const arena of arenas) {
      const playable = arena.grid.flat().filter((c) => c === 1).length;
      expect(arena.totalCells).toBe(playable);
      expect(arena.freeCells).toBe(playable - 32);
      expect(arena.freeCells).toBeGreaterThanOrEqual(60);
      expect(arena.freeCells).toBeLessThanOrEqual(200);
    }
  });

  it("exposes one in-bounds playable spawn zone per player", () => {
    for (const arena of arenas) {
      expect(arena.spawnZones).toHaveLength(2);
      for (const [y, x] of arena.spawnZones) {
        expect(arena.grid[y]?.[x]).toBe(1);
      }
    }
  });
});

describe("generateColiseumArena — determinism & defaults", () => {
  it("returns an identical arena (grid and pieces) for the same seed", () => {
    const a = generateColiseumArena(2, 12345);
    const b = generateColiseumArena(2, 12345);
    // elapsed/attempts may vary — compare the deterministic fields only.
    expect(b.grid).toEqual(a.grid);
    expect(b.pieces).toEqual(a.pieces);
    expect(b.spawnZones).toEqual(a.spawnZones);
    expect(b.seed).toBe(a.seed);
  });

  it("generates a valid arena without an explicit seed", () => {
    const arena = generateColiseumArena(2);
    expect(arena.pieces).toHaveLength(32);
    expect(typeof arena.seed).toBe("number");
  });
});
