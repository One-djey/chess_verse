import type { Piece, Position } from "../../types/chess";
import type { Arena } from "../../types/coliseum";
import {
  getColiseumLegalMoves,
  isColiseumInCheck,
  isColiseumSquareUnderAttack,
  applyColiseumMove,
} from "./coliseumMoves";
import { PIECE_VALUES } from "./constants";

interface Candidate {
  piece: Piece;
  to: Position;
  isCapture: boolean;
  isSafe: boolean;
}

function isMoveSafe(piece: Piece, to: Position, pieces: Piece[], arena: Arena): boolean {
  const simulated = applyColiseumMove(piece, to, pieces);
  return !isColiseumSquareUnderAttack(to, "white", simulated, arena);
}

function captureValue(to: Position, pieces: Piece[]): number {
  const target = pieces.find(
    (p) => p.color === "white" && p.position.x === to.x && p.position.y === to.y,
  );
  return target ? PIECE_VALUES[target.type] : 0;
}

function toMove(c: Candidate): { from: Position; to: Position } {
  return { from: c.piece.position, to: c.to };
}

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

  return null;
}

function pickNormalFallback(
  candidates: Candidate[],
  pieces: Piece[],
): { from: Position; to: Position } | null {
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

  return null;
}

/**
 * Selects the best move for black in Coliseum mode using the same priority chain
 * as getSmartFallbackMove, but with arena-aware move generation and attack detection.
 * Used as the sole AI engine (no Stockfish) since Coliseum uses an irregular arena.
 */
export function getColiseumAIMove(
  pieces: Piece[],
  arena: Arena,
): { from: Position; to: Position } | null {
  const blackPieces = pieces.filter((p) => p.color === "black");

  const candidates: Candidate[] = [];
  for (const piece of blackPieces) {
    const moves = getColiseumLegalMoves(piece, pieces, arena);
    for (const to of moves) {
      const isCapture = pieces.some(
        (p) => p.color === "white" && p.position.x === to.x && p.position.y === to.y,
      );
      // getColiseumLegalMoves already guarantees king moves don't leave king in check,
      // which is equivalent to the destination being safe for the king.
      const isSafe =
        piece.type === "king" ? true : isMoveSafe(piece, to, pieces, arena);
      candidates.push({ piece, to, isCapture, isSafe });
    }
  }

  if (candidates.length === 0) return null;

  const inCheck = isColiseumInCheck("black", pieces, arena);
  return inCheck
    ? pickCheckFallback(candidates)
    : pickNormalFallback(candidates, pieces);
}
