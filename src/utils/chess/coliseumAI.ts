import type { Piece, Position, PieceColor } from "../../types/chess";
import type { Arena } from "../../types/coliseum";
import {
  getColiseumLegalMoves,
  isColiseumInCheck,
  applyColiseumMove,
} from "./coliseumMoves";
import { PIECE_VALUES } from "./constants";

const DEPTH = 2;
const CHECKMATE_SCORE = 100_000;
// 1 centipawn per distance unit — too small to override any material gain/loss,
// but enough to break ties in quiet positions and prevent oscillation.
const PROXIMITY_WEIGHT = 0.01;

function evaluate(pieces: Piece[]): number {
  const material = pieces.reduce(
    (acc, p) =>
      acc + (p.color === "black" ? PIECE_VALUES[p.type] : -PIECE_VALUES[p.type]),
    0,
  );

  // Proximity bonus: reward black non-king pieces being close to white non-king pieces.
  // Per move, at most one piece moves, so the max bonus shift is ~0.38 (<1 pawn).
  const blackNonKing = pieces.filter((p) => p.color === "black" && p.type !== "king");
  const whiteNonKing = pieces.filter((p) => p.color === "white" && p.type !== "king");
  if (blackNonKing.length === 0 || whiteNonKing.length === 0) return material;

  let totalMinDist = 0;
  for (const bp of blackNonKing) {
    let minDist = Infinity;
    for (const wp of whiteNonKing) {
      const d =
        Math.abs(bp.position.x - wp.position.x) +
        Math.abs(bp.position.y - wp.position.y);
      if (d < minDist) minDist = d;
    }
    totalMinDist += minDist;
  }

  return material - totalMinDist * PROXIMITY_WEIGHT;
}

function getAllLegalMoves(
  color: PieceColor,
  pieces: Piece[],
  arena: Arena,
): Array<{ piece: Piece; to: Position }> {
  const result: Array<{ piece: Piece; to: Position }> = [];
  for (const piece of pieces.filter((p) => p.color === color)) {
    for (const to of getColiseumLegalMoves(piece, pieces, arena)) {
      result.push({ piece, to });
    }
  }
  return result;
}

function minimax(
  pieces: Piece[],
  arena: Arena,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
): number {
  if (depth === 0) return evaluate(pieces);

  const color: PieceColor = isMaximizing ? "black" : "white";
  const moves = getAllLegalMoves(color, pieces, arena);

  if (moves.length === 0) {
    const inCheck = isColiseumInCheck(color, pieces, arena);
    return inCheck ? (isMaximizing ? -CHECKMATE_SCORE : CHECKMATE_SCORE) : 0;
  }

  if (isMaximizing) {
    let best = -Infinity;
    for (const { piece, to } of moves) {
      const newPieces = applyColiseumMove(piece, to, pieces);
      const score = minimax(newPieces, arena, depth - 1, alpha, beta, false);
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const { piece, to } of moves) {
      const newPieces = applyColiseumMove(piece, to, pieces);
      const score = minimax(newPieces, arena, depth - 1, alpha, beta, true);
      if (score < best) best = score;
      if (best < beta) beta = best;
      if (beta <= alpha) break;
    }
    return best;
  }
}

/**
 * Selects the best move for black in Coliseum mode using Minimax (depth 2) with
 * alpha-beta pruning. Evaluates by material balance so the AI naturally avoids
 * losing exchanges, advances toward the enemy, and never oscillates.
 * Used as the sole AI engine (no Stockfish) since Coliseum uses an irregular arena.
 */
export function getColiseumAIMove(
  pieces: Piece[],
  arena: Arena,
): { from: Position; to: Position } | null {
  const moves = getAllLegalMoves("black", pieces, arena);
  if (moves.length === 0) return null;

  let bestScore = -Infinity;
  let bestMove: { from: Position; to: Position } | null = null;

  for (const { piece, to } of moves) {
    const newPieces = applyColiseumMove(piece, to, pieces);
    const score = minimax(newPieces, arena, DEPTH - 1, -Infinity, Infinity, false);
    if (score > bestScore) {
      bestScore = score;
      bestMove = { from: piece.position, to };
    }
  }

  return bestMove;
}
