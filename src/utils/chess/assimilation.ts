import { Piece, PieceType } from '../../types/chess';

/**
 * Returns all movement capabilities for a piece:
 * its base type plus any types acquired by capturing in Assimilation mode.
 */
export function getPieceCapabilities(piece: Piece): PieceType[] {
  if (!piece.acquiredTypes?.length) return [piece.type];
  return [...new Set([piece.type, ...piece.acquiredTypes])];
}

/**
 * Returns the capturing piece enriched with the captured piece's movement types.
 * The capturing piece's own base type is excluded from acquiredTypes (redundant).
 */
export function applyAssimilationCapture(capturingPiece: Piece, capturedPiece: Piece): Piece {
  const toAcquire = [capturedPiece.type, ...(capturedPiece.acquiredTypes ?? [])];
  const merged = [...new Set([...(capturingPiece.acquiredTypes ?? []), ...toAcquire])]
    .filter(t => t !== capturingPiece.type);
  return { ...capturingPiece, ...(merged.length ? { acquiredTypes: merged } : {}) };
}
