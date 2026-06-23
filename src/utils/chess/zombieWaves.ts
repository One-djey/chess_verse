import type { GameMode, Piece, PieceColor, PieceType, Position } from "../../types/chess";
import { isSquareUnderAttack } from "./moves";

// Minimal classic game mode for standard attack detection (no special rules)
const CLASSIC_MODE: GameMode = {
  id: "classic",
  title: "Classic",
  description: "",
  image: "",
  rules: {},
};

// ── Wave compositions (index 0 = wave 1) ────────────────────────────────────

export const WAVE_COMPOSITIONS: PieceType[][] = [
  ["pawn", "pawn", "pawn"],                                       // wave 1
  ["pawn", "pawn", "pawn"],                                       // wave 2
  ["pawn", "pawn", "pawn", "knight"],                             // wave 3
  ["pawn", "pawn", "bishop"],                                     // wave 4
  ["pawn", "pawn", "pawn", "knight"],                             // wave 5
  ["pawn", "pawn", "rook"],                                       // wave 6
  ["pawn", "pawn", "pawn", "knight", "knight"],                   // wave 7
  ["pawn", "pawn", "rook", "bishop"],                             // wave 8
  ["pawn", "pawn", "pawn", "queen"],                              // wave 9
];

/** Composition for wave 10 and beyond (escalating). */
export function getWave10PlusComposition(wave: number): PieceType[] {
  const extra = wave - 10;
  const base: PieceType[] = ["pawn", "pawn", "pawn", "queen", "rook"];
  for (let i = 0; i < extra; i++) {
    base.push(i % 2 === 0 ? "rook" : "queen");
  }
  return base;
}

/** Returns the PieceType list to spawn for a given wave number (1-indexed). */
export function getWaveComposition(wave: number): PieceType[] {
  if (wave <= 0) return [];
  if (wave <= 9) return WAVE_COMPOSITIONS[wave - 1];
  return getWave10PlusComposition(wave);
}

// ── Spawn zones ──────────────────────────────────────────────────────────────

/** Returns y-coordinates (0-indexed from top) where zombies can spawn. */
export function getSpawnRows(wave: number): number[] {
  if (wave >= 7) return [0, 1, 2]; // ranks 8, 7, 6
  if (wave >= 4) return [0, 1];    // ranks 8, 7
  return [0];                       // rank 8 only
}

// ── Adaptive spawn threshold ─────────────────────────────────────────────────

export interface SpawnThreshold {
  minActive: number;
  delayMoves: number;
}

/** Returns the adaptive spawn threshold for a given wave. */
export function getSpawnThreshold(wave: number): SpawnThreshold {
  if (wave >= 10) return { minActive: 5, delayMoves: 1 };
  if (wave >= 7) return { minActive: 4, delayMoves: 2 };
  if (wave >= 4) return { minActive: 3, delayMoves: 3 };
  return { minActive: 2, delayMoves: 4 };
}

/** Returns true if the next wave should spawn now. */
export function shouldSpawnWave(
  wave: number,
  activeZombies: number,
  playerMovesSinceLastSpawn: number,
): boolean {
  const { minActive, delayMoves } = getSpawnThreshold(wave);
  if (activeZombies < minActive) return true;
  return playerMovesSinceLastSpawn >= delayMoves;
}

// ── Spawn square selection ───────────────────────────────────────────────────

/** Counts black pieces on the board. */
export function countActiveZombies(pieces: Piece[]): number {
  return pieces.filter((p) => p.color === ("black" as PieceColor)).length;
}

/**
 * Returns squares that are empty and not attacked by any white piece.
 * Squares are in the spawn rows for the given wave and returned in random order.
 */
export function getSpawnableSquares(wave: number, pieces: Piece[]): Position[] {
  const rows = getSpawnRows(wave);
  const candidates: Position[] = [];

  for (const y of rows) {
    for (let x = 0; x < 8; x++) {
      const pos: Position = { x, y };
      const occupied = pieces.some((p) => p.position.x === x && p.position.y === y);
      if (occupied) continue;
      const attacked = isSquareUnderAttack(pos, "white", pieces, CLASSIC_MODE);
      if (!attacked) candidates.push(pos);
    }
  }

  // Shuffle for random placement
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  return candidates;
}

// ── Build wave pieces ────────────────────────────────────────────────────────

/**
 * Creates Piece objects for the next wave.
 * @param wave Wave number (1-indexed)
 * @param spawnableSquares Available spawn squares (already shuffled)
 * @param totalSpawnedSoFar Total zombie pieces ever created (used for unique IDs)
 * @returns Array of new black pieces to add to the board
 */
export function buildWavePieces(
  wave: number,
  spawnableSquares: Position[],
  totalSpawnedSoFar: number,
): Piece[] {
  const composition = getWaveComposition(wave);
  const result: Piece[] = [];

  for (let i = 0; i < composition.length; i++) {
    if (i >= spawnableSquares.length) break; // Not enough room
    result.push({
      id: `zh${totalSpawnedSoFar + i}`,
      type: composition[i],
      color: "black",
      position: spawnableSquares[i],
      hasMoved: false,
    });
  }

  return result;
}
