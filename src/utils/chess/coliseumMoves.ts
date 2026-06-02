import type { Piece, Position } from "../../types/chess";
import type { Arena } from "../../types/coliseum";

// Returns true if position is within arena and playable
function isPlayable(pos: Position, arena: Arena): boolean {
  return (
    pos.y >= 0 &&
    pos.y < arena.grid.length &&
    pos.x >= 0 &&
    pos.x < arena.grid[0].length &&
    arena.grid[pos.y][pos.x] === 1
  );
}

function getPieceAt(pos: Position, pieces: Piece[]): Piece | null {
  return (
    pieces.find((p) => p.position.x === pos.x && p.position.y === pos.y) ?? null
  );
}

// Get all valid moves for a piece in Coliseum (arena-aware, omnidirectional pawns)
export function getColiseumValidMoves(
  piece: Piece,
  pieces: Piece[],
  arena: Arena,
): Position[] {
  const moves: Position[] = [];
  const { x, y } = piece.position;

  const addIfPlayable = (
    nx: number,
    ny: number,
    mustCapture = false,
    mustEmpty = false,
  ) => {
    const pos = { x: nx, y: ny };
    if (!isPlayable(pos, arena)) return;
    const target = getPieceAt(pos, pieces);
    if (mustCapture && (!target || target.color === piece.color)) return;
    if (mustEmpty && target) return;
    if (!mustCapture && target && target.color === piece.color) return;
    moves.push(pos);
  };

  // Sliding pieces (bishop, rook, queen) — stop at void or occupied
  const slide = (dirs: [number, number][]) => {
    for (const [dy, dx] of dirs) {
      for (let step = 1; step < 30; step++) {
        const nx = x + dx * step,
          ny = y + dy * step;
        const pos = { x: nx, y: ny };
        if (!isPlayable(pos, arena)) break; // void = blocker
        const target = getPieceAt(pos, pieces);
        if (target) {
          if (target.color !== piece.color) moves.push(pos); // capture
          break; // blocked
        }
        moves.push(pos);
      }
    }
  };

  switch (piece.type) {
    case "pawn": {
      // Omnidirectional: move ±1 orthogonally (no capture), capture ±1 diagonally only
      for (const [dy, dx] of [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ] as [number, number][]) {
        addIfPlayable(x + dx, y + dy, false, true); // move only, no capture
      }
      for (const [dy, dx] of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ] as [number, number][]) {
        addIfPlayable(x + dx, y + dy, true, false); // capture only
      }
      break;
    }
    case "knight": {
      for (const [dy, dx] of [
        [2, 1],
        [2, -1],
        [-2, 1],
        [-2, -1],
        [1, 2],
        [1, -2],
        [-1, 2],
        [-1, -2],
      ] as [number, number][]) {
        addIfPlayable(x + dx, y + dy);
      }
      break;
    }
    case "bishop":
      slide([
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]);
      break;
    case "rook":
      slide([
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ]);
      break;
    case "queen":
      slide([
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]);
      break;
    case "king": {
      for (const [dy, dx] of [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ] as [number, number][]) {
        addIfPlayable(x + dx, y + dy);
      }
      break;
    }
  }

  return moves;
}

// Check if a position is under attack by any piece of `byColor`
export function isColiseumSquareUnderAttack(
  pos: Position,
  byColor: "white" | "black",
  pieces: Piece[],
  arena: Arena,
): boolean {
  const attackers = pieces.filter((p) => p.color === byColor);
  return attackers.some((attacker) => {
    const moves = getColiseumValidMoves(attacker, pieces, arena);
    return moves.some((m) => m.x === pos.x && m.y === pos.y);
  });
}

// Check if `color`'s king is in check
export function isColiseumInCheck(
  color: "white" | "black",
  pieces: Piece[],
  arena: Arena,
): boolean {
  const king = pieces.find((p) => p.type === "king" && p.color === color);
  if (!king) return false;
  const opponent = color === "white" ? "black" : "white";
  return isColiseumSquareUnderAttack(king.position, opponent, pieces, arena);
}

// Apply a move, returning new pieces array
export function applyColiseumMove(
  piece: Piece,
  to: Position,
  pieces: Piece[],
): Piece[] {
  return pieces
    .filter((p) => !(p.position.x === to.x && p.position.y === to.y)) // remove captured
    .map((p) =>
      p.id === piece.id ? { ...p, position: to, hasMoved: true } : p,
    );
}

// Get legal moves (excluding moves that leave own king in check)
export function getColiseumLegalMoves(
  piece: Piece,
  pieces: Piece[],
  arena: Arena,
): Position[] {
  const candidates = getColiseumValidMoves(piece, pieces, arena);
  return candidates.filter((to) => {
    const newPieces = applyColiseumMove(piece, to, pieces);
    return !isColiseumInCheck(piece.color, newPieces, arena);
  });
}

// Check if color has NO legal moves (checkmate or stalemate)
export function hasNoLegalMoves(
  color: "white" | "black",
  pieces: Piece[],
  arena: Arena,
): boolean {
  return pieces
    .filter((p) => p.color === color)
    .every((p) => getColiseumLegalMoves(p, pieces, arena).length === 0);
}
