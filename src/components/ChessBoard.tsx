import React from 'react';
import { Piece, Position } from '../types/chess';
import { UNICODE_PIECES } from '../utils/chess';

interface ChessBoardProps {
  pieces: Piece[];
  currentTurn: 'white' | 'black';
  selectedPiece: Piece | null;
  validMoves: Position[];
  isCheck: boolean;
  onPieceSelect: (piece: Piece) => void;
  onMove: (position: Position) => void;
}

export default function ChessBoard({
  pieces,
  currentTurn,
  selectedPiece,
  validMoves,
  isCheck,
  onPieceSelect,
  onMove,
}: ChessBoardProps) {
  const renderSquare = (x: number, y: number) => {
    const piece = pieces.find((p) => p.position.x === x && p.position.y === y);
    const isSelected =
      selectedPiece?.position.x === x && selectedPiece?.position.y === y;
    const isValidMove = validMoves.some((move) => move.x === x && move.y === y);
    const isLight = (x + y) % 2 === 0;

    const squareClasses = `
      w-full h-full flex items-center justify-center text-4xl relative
      ${isLight ? 'bg-gray-200' : 'bg-gray-600'}
      ${
        isValidMove
          ? 'after:absolute after:inset-0 after:bg-blue-400 after:bg-opacity-40 after:pointer-events-none'
          : ''
      }
      transition-colors duration-200
    `;

    const pieceClasses = `
      select-none
      ${
        piece?.color === currentTurn
          ? 'hover:scale-110 transition-transform cursor-pointer'
          : 'opacity-80'
      }
      ${
        piece?.color === currentTurn && !isSelected
          ? 'drop-shadow-[0_0_4px_rgba(59,130,246,1)]'
          : ''
      }
      ${
        piece?.color === currentTurn && isCheck && piece.type === 'king'
          ? 'drop-shadow-[0_0_6px_rgba(249,115,22,1)]'
          : ''
      }
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
            onMove({ x, y });
          }
        }}
      >
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
