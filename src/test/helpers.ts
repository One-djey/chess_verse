import type {
  Piece,
  PieceColor,
  PieceType,
  Position,
} from "../types/chess";

let nextId = 0;

/** Creates a test piece with a unique auto-generated id. */
export function makePiece(
  color: PieceColor,
  type: PieceType,
  x: number,
  y: number,
  opts: Partial<Pick<Piece, "id" | "hasMoved" | "acquiredTypes">> = {},
): Piece {
  return {
    id: opts.id ?? `test-${color}-${type}-${nextId++}`,
    type,
    color,
    position: { x, y },
    ...(opts.hasMoved !== undefined && { hasMoved: opts.hasMoved }),
    ...(opts.acquiredTypes && { acquiredTypes: opts.acquiredTypes }),
  };
}

/** Shorthand position constructor. */
export function pos(x: number, y: number): Position {
  return { x, y };
}

/** Returns true if the move list contains the given position. */
export function includesPos(moves: Position[], x: number, y: number): boolean {
  return moves.some((m) => m.x === x && m.y === y);
}
