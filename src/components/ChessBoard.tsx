import React from 'react';
import { Piece, Position, GameMode } from '../types/chess';
import { UNICODE_PIECES } from '../utils/chess';

interface ChessBoardProps {
  pieces: Piece[];
  currentTurn: 'white' | 'black';
  selectedPiece: Piece | null;
  validMoves: Position[];
  isCheck: boolean;
  onPieceSelect: (piece: Piece) => void;
  onMove: (position: Position) => void;
  gameMode: GameMode;
}

export default function ChessBoard({
  pieces,
  currentTurn,
  selectedPiece,
  validMoves,
  isCheck,
  onPieceSelect,
  onMove,
  gameMode,
}: ChessBoardProps) {
  const isValidMovePosition = (x: number, y: number) => {
    return validMoves.some(move => {
      const normalizedMove = {
        x: ((move.x % 8) + 8) % 8,
        y: ((move.y % 8) + 8) % 8
      };
      return normalizedMove.x === x && normalizedMove.y === y;
    });
  };

  const isBorderCrossable = (x: number, y: number) => {
    if (!gameMode.rules?.borderless) return false;
    
    // Check if it's a border square
    const isBorder = x === 0 || x === 7 || y === 0 || y === 7;
    if (!isBorder) return false;

    // Left and right borders are always crossable for both colors
    if (x === 0 || x === 7) return true;

    // Top border is only crossable for white pieces moving up
    if (y === 0) return currentTurn === 'white';

    // Bottom border is only crossable for black pieces moving down
    if (y === 7) return currentTurn === 'black';

    return false;
  };

  const getBorderGlow = (x: number, y: number) => {
    if (!isBorderCrossable(x, y)) return '';

    let glowClasses = 'absolute inset-0 pointer-events-none ';
    
    // Left and right borders glow for both colors
    if (x === 0) glowClasses += 'bg-gradient-to-l from-transparent to-green-400/50';
    if (x === 7) glowClasses += 'bg-gradient-to-r from-transparent to-green-400/50';
    
    // Top border glows only for white pieces moving up
    if (y === 0 && currentTurn === 'white') {
      glowClasses += 'bg-gradient-to-t from-transparent to-green-400/50';
    }
    
    // Bottom border glows only for black pieces moving down
    if (y === 7 && currentTurn === 'black') {
      glowClasses += 'bg-gradient-to-b from-transparent to-green-400/50';
    }

    return glowClasses;
  };

  const renderSquare = (x: number, y: number) => {
    const piece = pieces.find((p) => p.position.x === x && p.position.y === y);
    const isSelected = selectedPiece?.position.x === x && selectedPiece?.position.y === y;
    const isValidMove = isValidMovePosition(x, y);
    const isLight = (x + y) % 2 === 0;
    const borderGlow = getBorderGlow(x, y);

    const squareClasses = `
      w-full h-full flex items-center justify-center text-4xl relative
      ${isLight ? 'bg-gray-200' : 'bg-gray-600'}
      ${isValidMove ? 'after:absolute after:inset-0 after:bg-blue-400 after:bg-opacity-40 after:pointer-events-none' : ''}
      transition-colors duration-200
    `;

    const pieceClasses = `
      select-none
      ${piece?.color === currentTurn ? 'hover:scale-110 transition-transform cursor-pointer' : 'opacity-80'}
      ${piece?.color === currentTurn && !isSelected ? 'drop-shadow-[0_0_4px_rgba(59,130,246,1)]' : ''}
      ${piece?.color === currentTurn && isCheck && piece.type === 'king' ? 'drop-shadow-[0_0_6px_rgba(249,115,22,1)]' : ''}
      ${isSelected ? 'scale-110 drop-shadow-[0_0_6px_rgba(59,130,246,1)]' : ''}
    `;

    return (
      <div
        key={`${x}-${y}`}
        className={squareClasses}
        onClick={() => {
          if (piece && piece.color === currentTurn) {
            onPieceSelect(piece);
          } else if (isValidMove) {
            // Find the original move coordinates that led to this normalized position
            const originalMove = validMoves.find(move => {
              const normalized = {
                x: ((move.x % 8) + 8) % 8,
                y: ((move.y % 8) + 8) % 8
              };
              return normalized.x === x && normalized.y === y;
            });
            if (originalMove) {
              onMove(originalMove);
            }
          }
        }}
      >
        {borderGlow && <div className={borderGlow} />}
        {piece && (
          <div className={pieceClasses}>
            {UNICODE_PIECES[piece.color][piece.type]}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="aspect-square w-[80vh] max-w-[800px] bg-white shadow-xl rounded-lg p-4">
      <div className="grid grid-cols-8 grid-rows-8 h-full gap-1">
        {Array(8)
          .fill(null)
          .map((_, y) =>
            Array(8)
              .fill(null)
              .map((_, x) => renderSquare(x, y))
          )}
      </div>
    </div>
  );
}