import { Piece, PieceType, Position, PieceColor } from '../types/chess';

export const UNICODE_PIECES: Record<PieceColor, Record<PieceType, string>> = {
  white: {
    king: '♔',
    queen: '♕',
    rook: '♖',
    bishop: '♗',
    knight: '♘',
    pawn: '♙',
  },
  black: {
    king: '♚',
    queen: '♛',
    rook: '♜',
    bishop: '♝',
    knight: '♞',
    pawn: '♟',
  },
};

export const initialPieces: Piece[] = [
  // White pieces
  { type: 'rook', color: 'white', position: { x: 0, y: 7 } },
  { type: 'knight', color: 'white', position: { x: 1, y: 7 } },
  { type: 'bishop', color: 'white', position: { x: 2, y: 7 } },
  { type: 'queen', color: 'white', position: { x: 3, y: 7 } },
  { type: 'king', color: 'white', position: { x: 4, y: 7 } },
  { type: 'bishop', color: 'white', position: { x: 5, y: 7 } },
  { type: 'knight', color: 'white', position: { x: 6, y: 7 } },
  { type: 'rook', color: 'white', position: { x: 7, y: 7 } },
  ...Array(8).fill(null).map((_, i) => ({
    type: 'pawn' as PieceType,
    color: 'white' as PieceColor,
    position: { x: i, y: 6 },
  })),

  // Black pieces
  { type: 'rook', color: 'black', position: { x: 0, y: 0 } },
  { type: 'knight', color: 'black', position: { x: 1, y: 0 } },
  { type: 'bishop', color: 'black', position: { x: 2, y: 0 } },
  { type: 'queen', color: 'black', position: { x: 3, y: 0 } },
  { type: 'king', color: 'black', position: { x: 4, y: 0 } },
  { type: 'bishop', color: 'black', position: { x: 5, y: 0 } },
  { type: 'knight', color: 'black', position: { x: 6, y: 0 } },
  { type: 'rook', color: 'black', position: { x: 7, y: 0 } },
  ...Array(8).fill(null).map((_, i) => ({
    type: 'pawn' as PieceType,
    color: 'black' as PieceColor,
    position: { x: i, y: 1 },
  })),
];

const isWithinBoard = (pos: Position): boolean => {
  return pos.x >= 0 && pos.x < 8 && pos.y >= 0 && pos.y < 8;
};

const isSamePosition = (a: Position, b: Position): boolean => {
  return a.x === b.x && a.y === b.y;
};

const isPathClear = (start: Position, end: Position, pieces: Piece[]): boolean => {
  const dx = Math.sign(end.x - start.x);
  const dy = Math.sign(end.y - start.y);
  let x = start.x + dx;
  let y = start.y + dy;

  while (x !== end.x || y !== end.y) {
    if (getPieceAt({ x, y }, pieces)) {
      return false;
    }
    x += dx;
    y += dy;
  }

  return true;
};

export const getPieceAt = (position: Position, pieces: Piece[]): Piece | null => {
  return pieces.find(p => p.position.x === position.x && p.position.y === position.y) || null;
};

export const isValidMove = (piece: Piece, target: Position, pieces: Piece[]): boolean => {
  if (!isWithinBoard(target)) return false;
  
  const targetPiece = getPieceAt(target, pieces);
  if (targetPiece?.color === piece.color) return false;

  if (isSamePosition(piece.position, target)) return false;

  const dx = target.x - piece.position.x;
  const dy = target.y - piece.position.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  switch (piece.type) {
    case 'pawn': {
      const direction = piece.color === 'white' ? -1 : 1;
      const startRank = piece.color === 'white' ? 6 : 1;
      
      // Forward movement
      if (dx === 0) {
        if (dy === direction && !targetPiece) {
          return true;
        }
        if (piece.position.y === startRank && dy === 2 * direction) {
          return !targetPiece && !getPieceAt({ x: piece.position.x, y: piece.position.y + direction }, pieces);
        }
      }
      
      // Capture
      if (absDx === 1 && dy === direction) {
        return targetPiece !== null;
      }
      return false;
    }

    case 'knight':
      return (absDx === 2 && absDy === 1) || (absDx === 1 && absDy === 2);

    case 'bishop':
      if (absDx !== absDy) return false;
      return isPathClear(piece.position, target, pieces);

    case 'rook':
      if (dx !== 0 && dy !== 0) return false;
      return isPathClear(piece.position, target, pieces);

    case 'queen':
      if (absDx !== absDy && dx !== 0 && dy !== 0) return false;
      return isPathClear(piece.position, target, pieces);

    case 'king':
      return absDx <= 1 && absDy <= 1;

    default:
      return false;
  }
};

// Simule un mouvement et vérifie si le roi est toujours en échec
const wouldBeInCheck = (piece: Piece, target: Position, pieces: Piece[]): boolean => {
  const simulatedPieces = pieces.filter(p => 
    !(p.position.x === target.x && p.position.y === target.y)
  ).map(p => 
    p === piece ? { ...p, position: target } : p
  );
  
  return isInCheck(piece.color, simulatedPieces);
};

export const isInCheck = (color: PieceColor, pieces: Piece[]): boolean => {
  const king = pieces.find(p => p.type === 'king' && p.color === color);
  if (!king) return false;

  return pieces.some(piece => 
    piece.color !== color && 
    isValidMove(piece, king.position, pieces)
  );
};

export const hasLegalMoves = (color: PieceColor, pieces: Piece[]): boolean => {
  return pieces
    .filter(piece => piece.color === color)
    .some(piece =>
      Array(8)
        .fill(null)
        .some((_, y) =>
          Array(8)
            .fill(null)
            .some((_, x) => {
              const target = { x, y };
              return isValidMove(piece, target, pieces) && !wouldBeInCheck(piece, target, pieces);
            })
        )
    );
};

export { wouldBeInCheck }