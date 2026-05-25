import type { PieceType } from "../../types/chess";

/**
 * Standard material values for chess pieces.
 * Used by the AI fallback to prioritise captures and select pieces to move.
 *
 * Scale: pawn = 1 unit (lowest) → king = 100 (never traded, sentinel value).
 */
export const PIECE_VALUES: Record<PieceType, number> = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 100,
};
