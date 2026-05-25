import type { Piece, Position, GameMode } from "../../types/chess";
import { getValidMoves, isInCheck, isSquareUnderAttack } from "./moves";
import { PIECE_VALUES } from "./constants";

/** Candidate move enriched with capture/safety metadata. */
interface Candidate {
  piece: Piece;
  to: Position;
  isCapture: boolean;
  isSafe: boolean;
}

/**
 * Normalise a virtual (possibly wrapped) position to board coordinates 0–7.
 * In borderless mode getValidMoves can return positions outside 0–7; we must
 * normalise before comparing with stored piece positions or querying attack maps.
 */
function normalizePosition(pos: Position): Position {
  return { x: ((pos.x % 8) + 8) % 8, y: ((pos.y % 8) + 8) % 8 };
}

/**
 * Simulate moving `piece` to `to`, then check whether that square is
 * immediately attacked by white. Returns true when the piece is "safe"
 * (cannot be recaptured on the next half-move).
 */
function isMoveSafe(
  piece: Piece,
  to: Position,
  pieces: Piece[],
  gameMode: GameMode,
): boolean {
  const norm = normalizePosition(to);
  const simulated = pieces
    // Remove any piece captured at the destination
    .filter((p) => !(p.position.x === norm.x && p.position.y === norm.y))
    // Move the acting piece to its new position
    .map((p) => (p.id === piece.id ? { ...p, position: norm } : p));
  return !isSquareUnderAttack(norm, "white", simulated, gameMode);
}

/** Material value of the white piece that would be captured at `to`, or 0. */
function captureValue(to: Position, pieces: Piece[]): number {
  const norm = normalizePosition(to);
  const target = pieces.find(
    (p) =>
      p.color === "white" && p.position.x === norm.x && p.position.y === norm.y,
  );
  return target ? PIECE_VALUES[target.type] : 0;
}

/** Format a candidate as a plain { from, to } result. */
function toMove(c: Candidate): { from: Position; to: Position } {
  return { from: c.piece.position, to: c.to };
}

/**
 * Fallback chain when the black king is in check.
 *
 * Priority (all candidates are already legal via getValidMoves):
 *   1. Non-king piece that resolves check AND is safe  → lowest piece value
 *   2. Non-king piece that resolves check AND is risky → lowest piece value
 *   3. King move (safe by construction from getValidMoves)
 *   4. null → checkmate confirmed
 */
function pickCheckFallback(
  candidates: Candidate[],
): { from: Position; to: Position } | null {
  const byValueAsc = (a: Candidate, b: Candidate) =>
    PIECE_VALUES[a.piece.type] - PIECE_VALUES[b.piece.type];

  const nonKing = candidates.filter((c) => c.piece.type !== "king");

  const safeNonKing = nonKing.filter((c) => c.isSafe).sort(byValueAsc);
  if (safeNonKing.length > 0) return toMove(safeNonKing[0]);

  const riskyNonKing = nonKing.filter((c) => !c.isSafe).sort(byValueAsc);
  if (riskyNonKing.length > 0) return toMove(riskyNonKing[0]);

  const kingMoves = candidates.filter((c) => c.piece.type === "king");
  if (kingMoves.length > 0) return toMove(kingMoves[0]);

  return null; // checkmate confirmed
}

/**
 * Fallback chain for a normal turn (king not in check).
 *
 * Priority:
 *   1. Safe capture   → highest captured value, then lowest mover value
 *   2. Safe move      → lowest mover value
 *   3. Risky capture  → highest captured value, then lowest mover value
 *   4. Risky move     → lowest mover value
 *   5. null → stalemate confirmed
 */
function pickNormalFallback(
  candidates: Candidate[],
  pieces: Piece[],
): { from: Position; to: Position } | null {
  /** Sort by best capture first, then sacrifice the cheapest piece. */
  const byCaptureDescThenMoverAsc = (a: Candidate, b: Candidate) => {
    const capDiff = captureValue(b.to, pieces) - captureValue(a.to, pieces);
    if (capDiff !== 0) return capDiff;
    return PIECE_VALUES[a.piece.type] - PIECE_VALUES[b.piece.type];
  };
  const byMoverAsc = (a: Candidate, b: Candidate) =>
    PIECE_VALUES[a.piece.type] - PIECE_VALUES[b.piece.type];

  const safeCaptures = candidates
    .filter((c) => c.isSafe && c.isCapture)
    .sort(byCaptureDescThenMoverAsc);
  if (safeCaptures.length > 0) return toMove(safeCaptures[0]);

  const safeMoves = candidates
    .filter((c) => c.isSafe && !c.isCapture)
    .sort(byMoverAsc);
  if (safeMoves.length > 0) return toMove(safeMoves[0]);

  const riskyCaptures = candidates
    .filter((c) => !c.isSafe && c.isCapture)
    .sort(byCaptureDescThenMoverAsc);
  if (riskyCaptures.length > 0) return toMove(riskyCaptures[0]);

  const riskyMoves = candidates
    .filter((c) => !c.isSafe && !c.isCapture)
    .sort(byMoverAsc);
  if (riskyMoves.length > 0) return toMove(riskyMoves[0]);

  return null; // stalemate confirmed
}

/**
 * Smart AI fallback move selector.
 *
 * Called when Stockfish suggests an illegal move (special-mode rule violation)
 * or when all Stockfish retries have failed. Exhaustively maps every legal move
 * for every black piece and selects the best option according to the priority
 * chain agreed in the design intent.
 *
 * ⚠️  Never short-circuit the candidate loop — in borderless and assimilation
 * modes, pieces have far more legal moves than in standard chess, and early
 * termination would wrongly declare stalemate/checkmate.
 *
 * @returns A { from, to } move, or null only when truly no legal move exists.
 */
export function getSmartFallbackMove(
  pieces: Piece[],
  gameMode: GameMode,
): { from: Position; to: Position } | null {
  const blackPieces = pieces.filter((p) => p.color === "black");

  // Build the full candidate list — exhaustive scan over all pieces and moves.
  const candidates: Candidate[] = [];
  for (const piece of blackPieces) {
    const moves = getValidMoves(piece, pieces, gameMode);
    for (const to of moves) {
      const norm = normalizePosition(to);
      const isCapture = pieces.some(
        (p) =>
          p.color === "white" &&
          p.position.x === norm.x &&
          p.position.y === norm.y,
      );
      const isSafe = isMoveSafe(piece, to, pieces, gameMode);
      candidates.push({ piece, to, isCapture, isSafe });
    }
  }

  // Only return null after the full scan confirms zero legal moves.
  if (candidates.length === 0) return null;

  const inCheck = isInCheck("black", pieces, gameMode);
  return inCheck
    ? pickCheckFallback(candidates)
    : pickNormalFallback(candidates, pieces);
}
