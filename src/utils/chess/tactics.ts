import {
  Piece,
  PieceColor,
  PieceType,
  Position,
  GameMode,
  MoveRecord,
} from "../../types/chess";
import { isInCheck, isValidMove } from "./moves";

export type TacticTag =
  | "check"
  | "discoveredCheck"
  | "fork"
  | "pin"
  | "capture"
  | "promotion"
  | "castling";

export interface MoveContext {
  /** The piece that moved (as it was BEFORE the move). */
  piece: Piece;
  from: Position;
  to: Position;
  capturedPiece: Piece | null;
  wasPromotion: boolean;
  wasCastling: boolean;
  /** Board state BEFORE the move. */
  prevPieces: Piece[];
  /** Board state AFTER the move (result of applyMoveToState). */
  nextPieces: Piece[];
  gameMode: GameMode;
}

const SLIDING_TYPES: PieceType[] = ["rook", "bishop", "queen"];

function isSlidingPiece(piece: Piece): boolean {
  if (SLIDING_TYPES.includes(piece.type)) return true;
  return piece.acquiredTypes?.some((t) => SLIDING_TYPES.includes(t)) ?? false;
}

/** Returns the moved piece in nextPieces (matched by id). */
function getMovedPiece(ctx: MoveContext): Piece | undefined {
  return ctx.nextPieces.find((p) => p.id === ctx.piece.id);
}

function opponentColor(color: PieceColor): PieceColor {
  return color === "white" ? "black" : "white";
}

/**
 * Detect if the move creates a fork — the moved piece simultaneously attacks
 * two or more enemy pieces from its new position.
 */
function detectFork(ctx: MoveContext): boolean {
  const movedPiece = getMovedPiece(ctx);
  if (!movedPiece) return false;

  const opp = opponentColor(ctx.piece.color);
  const enemies = ctx.nextPieces.filter((p) => p.color === opp);

  let attackCount = 0;
  for (const enemy of enemies) {
    // Use skipCheckValidation=true: we only care about attack geometry, not legality
    if (isValidMove(movedPiece, enemy.position, ctx.nextPieces, ctx.gameMode)) {
      attackCount++;
      if (attackCount >= 2) return true;
    }
  }
  return false;
}

/**
 * Detect if the move creates an absolute pin — an enemy piece is pinned to
 * its king by the moved piece (removing the pinned piece would expose the king).
 * Only applies to sliding pieces (rook, bishop, queen).
 */
function detectPin(ctx: MoveContext): boolean {
  const movedPiece = getMovedPiece(ctx);
  if (!movedPiece || !isSlidingPiece(movedPiece)) return false;

  const opp = opponentColor(ctx.piece.color);
  const enemyKing = ctx.nextPieces.find(
    (p) => p.type === "king" && p.color === opp,
  );
  if (!enemyKing) return false;

  // For each non-king enemy piece, check if removing it exposes the king to our moved piece
  const enemyPieces = ctx.nextPieces.filter(
    (p) => p.color === opp && p.type !== "king",
  );
  for (const candidate of enemyPieces) {
    const withoutCandidate = ctx.nextPieces.filter(
      (p) => p.id !== candidate.id,
    );
    if (
      isValidMove(
        movedPiece,
        enemyKing.position,
        withoutCandidate,
        ctx.gameMode,
      )
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Detects the exact Scholar's Mate pattern (white side):
 *   1. e2→e4  2. Q→h5  3. B→c4  4. Q×f7#
 *
 * Coordinate system: y=0 is rank 8 (black back rank), y=7 is rank 1 (white back rank).
 * The move list is one entry per half-move (ply), white plays even indices.
 *
 * Extracted from Game.tsx (REC-001) — pure function with no React dependencies.
 */
export function detectScholarsMate(moves: MoveRecord[]): boolean {
  if (moves.length < 7) return false;
  const m0 = moves[0]; // white ply 1: pawn e2(4,6)→e4(4,4)
  const m2 = moves[2]; // white ply 2: queen →h5(7,3)
  const m4 = moves[4]; // white ply 3: bishop →c4(2,4)
  const m6 = moves[6]; // white ply 4: queen ×f7(5,1)#
  return (
    m0.piece.color === "white" &&
    m0.piece.type === "pawn" &&
    m0.from.x === 4 &&
    m0.from.y === 6 &&
    m0.to.x === 4 &&
    m0.to.y === 4 &&
    m2.piece.color === "white" &&
    m2.piece.type === "queen" &&
    m2.to.x === 7 &&
    m2.to.y === 3 &&
    m4.piece.color === "white" &&
    m4.piece.type === "bishop" &&
    m4.to.x === 2 &&
    m4.to.y === 4 &&
    m6.piece.color === "white" &&
    m6.piece.type === "queen" &&
    m6.to.x === 5 &&
    m6.to.y === 1 &&
    m6.capturedPiece !== null
  );
}

/**
 * Returns the highest-priority tactic tag for the given move, or null if
 * the move is unremarkable.
 *
 * Priority order (highest first):
 *   promotion > castling > check > discoveredCheck > fork > pin > capture
 */
export function detectTactic(ctx: MoveContext): TacticTag | null {
  if (ctx.wasPromotion) return "promotion";
  if (ctx.wasCastling) return "castling";

  const opp = opponentColor(ctx.piece.color);
  const opponentInCheck = isInCheck(opp, ctx.nextPieces, ctx.gameMode);

  if (opponentInCheck) {
    // Was it the moved piece itself giving check, or did moving it reveal a check?
    const movedPiece = getMovedPiece(ctx);
    if (movedPiece) {
      const enemyKing = ctx.nextPieces.find(
        (p) => p.type === "king" && p.color === opp,
      );
      if (
        enemyKing &&
        isValidMove(
          movedPiece,
          enemyKing.position,
          ctx.nextPieces,
          ctx.gameMode,
        )
      ) {
        return "check";
      }
    }
    return "discoveredCheck";
  }

  if (detectFork(ctx)) return "fork";
  if (detectPin(ctx)) return "pin";
  if (ctx.capturedPiece) return "capture";

  return null;
}
