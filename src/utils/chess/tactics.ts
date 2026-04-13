import { Piece, PieceColor, PieceType, Position, GameMode } from '../../types/chess';
import { isInCheck, isValidMove } from './moves';

export type TacticTag =
  | 'check'
  | 'discoveredCheck'
  | 'fork'
  | 'pin'
  | 'capture'
  | 'promotion'
  | 'castling';

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

const SLIDING_TYPES: PieceType[] = ['rook', 'bishop', 'queen'];

function isSlidingPiece(piece: Piece): boolean {
  if (SLIDING_TYPES.includes(piece.type)) return true;
  return piece.acquiredTypes?.some(t => SLIDING_TYPES.includes(t)) ?? false;
}

/** Returns the moved piece in nextPieces (matched by id). */
function getMovedPiece(ctx: MoveContext): Piece | undefined {
  return ctx.nextPieces.find(p => p.id === ctx.piece.id);
}

function opponentColor(color: PieceColor): PieceColor {
  return color === 'white' ? 'black' : 'white';
}

/**
 * Detect if the move creates a fork — the moved piece simultaneously attacks
 * two or more enemy pieces from its new position.
 */
function detectFork(ctx: MoveContext): boolean {
  const movedPiece = getMovedPiece(ctx);
  if (!movedPiece) return false;

  const opp = opponentColor(ctx.piece.color);
  const enemies = ctx.nextPieces.filter(p => p.color === opp);

  let attackCount = 0;
  for (const enemy of enemies) {
    // Use skipCheckValidation=true: we only care about attack geometry, not legality
    if (isValidMove(movedPiece, enemy.position, ctx.nextPieces, ctx.gameMode, true)) {
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
  const enemyKing = ctx.nextPieces.find(p => p.type === 'king' && p.color === opp);
  if (!enemyKing) return false;

  // For each non-king enemy piece, check if removing it exposes the king to our moved piece
  const enemyPieces = ctx.nextPieces.filter(p => p.color === opp && p.type !== 'king');
  for (const candidate of enemyPieces) {
    const withoutCandidate = ctx.nextPieces.filter(p => p.id !== candidate.id);
    if (isValidMove(movedPiece, enemyKing.position, withoutCandidate, ctx.gameMode, true)) {
      return true;
    }
  }
  return false;
}

/**
 * Returns the highest-priority tactic tag for the given move, or null if
 * the move is unremarkable.
 *
 * Priority order (highest first):
 *   promotion > castling > check > discoveredCheck > fork > pin > capture
 */
export function detectTactic(ctx: MoveContext): TacticTag | null {
  if (ctx.wasPromotion) return 'promotion';
  if (ctx.wasCastling) return 'castling';

  const opp = opponentColor(ctx.piece.color);
  const opponentInCheck = isInCheck(opp, ctx.nextPieces, ctx.gameMode);

  if (opponentInCheck) {
    // Was it the moved piece itself giving check, or did moving it reveal a check?
    const movedPiece = getMovedPiece(ctx);
    if (movedPiece) {
      const enemyKing = ctx.nextPieces.find(p => p.type === 'king' && p.color === opp);
      if (enemyKing && isValidMove(movedPiece, enemyKing.position, ctx.nextPieces, ctx.gameMode, true)) {
        return 'check';
      }
    }
    return 'discoveredCheck';
  }

  if (detectFork(ctx)) return 'fork';
  if (detectPin(ctx)) return 'pin';
  if (ctx.capturedPiece) return 'capture';

  return null;
}
