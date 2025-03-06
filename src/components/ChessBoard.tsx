import React, { useRef, useEffect, useState } from 'react';
import { Piece, Position, GameMode } from '../types/chess';
import { UNICODE_PIECES, findCastlingMove } from '../utils/chess';

interface ChessBoardProps {
  pieces: Piece[];
  currentTurn: 'white' | 'black';
  selectedPiece: Piece | null;
  validMoves: Position[];
  isCheck: boolean;
  onPieceSelect: (piece: Piece) => void;
  onMove: (position: Position) => void;
  gameMode: GameMode;
  aiEnabled?: boolean;
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
  aiEnabled = false,
}: ChessBoardProps) {
  const pieceRefs = useRef<Map<string, { x: number; y: number }>>(new Map());
  const [imagesLoaded, setImagesLoaded] = useState(false);

  // Update piece positions with animation
  useEffect(() => {
    pieces.forEach(piece => {
      const key = `${piece.color}-${piece.type}-${piece.position.x}-${piece.position.y}`;
      if (!pieceRefs.current.has(key)) {
        pieceRefs.current.set(key, { x: piece.position.x, y: piece.position.y });
      }
    });
  }, [pieces]);

  const handleImageLoad = () => {
    setImagesLoaded(true);
  };

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

  // Check if a move is a castling move
  const isCastlingMove = (x: number, y: number) => {
    if (!selectedPiece || selectedPiece.type !== 'king') return false;
    
    // For king, check if the move is 2 squares horizontally
    if (Math.abs(selectedPiece.position.x - x) === 2 && selectedPiece.position.y === y) {
      // Find the corresponding castling move
      const target = { x, y };
      const castlingMove = findCastlingMove(
        selectedPiece, 
        target, 
        pieces, 
        gameMode
      );
      return castlingMove !== null;
    }
    
    return false;
  };

  return (
    <div className="aspect-square w-[80vh] max-w-[800px] bg-white shadow-xl rounded-lg p-4">
      <div className="grid grid-cols-8 grid-rows-8 h-full gap-1 relative">
        {/* Board squares */}
        <div className="absolute inset-0 grid grid-cols-8 grid-rows-8 gap-1 z-0">
          {Array(8)
            .fill(null)
            .map((_, y) =>
              Array(8)
                .fill(null)
                .map((_, x) => {
                  const isLight = (x + y) % 2 === 0;
                  const borderGlow = getBorderGlow(x, y);
                  
                  return (
                    <div
                      key={`${x}-${y}`}
                      className={`
                        w-full h-full relative
                        ${isLight ? 'bg-gray-200' : 'bg-gray-600'}
                        transition-colors duration-200
                      `}
                    >
                      {borderGlow && <div className={borderGlow} />}
                    </div>
                  );
                })
            )}
        </div>

        {/* Valid moves overlay */}
        <div className="absolute inset-0 z-10">
          {Array(8)
            .fill(null)
            .map((_, y) =>
              Array(8)
                .fill(null)
                .map((_, x) => {
                  const isValidMove = isValidMovePosition(x, y);
                  const isCastling = isCastlingMove(x, y);
                  if (!isValidMove && !isCastling) return null;

                  return (
                    <div
                      key={`overlay-${x}-${y}`}
                      className={`absolute cursor-pointer ${
                        isCastling ? 'bg-purple-400' : 'bg-blue-400'
                      } bg-opacity-40`}
                      style={{
                        left: `${x * 12.5}%`,
                        top: `${y * 12.5}%`,
                        width: '12.5%',
                        height: '12.5%',
                      }}
                      onClick={() => {
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
                      }}
                    />
                  );
                })
            )}
        </div>
        
        {/* Interactive squares layer */}
        <div className="absolute inset-0 grid grid-cols-8 grid-rows-8 gap-1 z-20">
          {Array(8)
            .fill(null)
            .map((_, y) =>
              Array(8)
                .fill(null)
                .map((_, x) => {
                  const piece = pieces.find((p) => p.position.x === x && p.position.y === y);
                  const isValidMove = isValidMovePosition(x, y);
                  const isPlayable = piece?.color === currentTurn && (!aiEnabled || piece.color === 'white');
                  
                  return (
                    <div
                      key={`interactive-${x}-${y}`}
                      className="w-full h-full"
                      onClick={() => {
                        if (piece && isPlayable) {
                          onPieceSelect(piece);
                        } else if (isValidMove) {
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
                    />
                  );
                })
            )}
        </div>

        {/* Pieces layer */}
        <div className="absolute inset-0 z-30 pointer-events-none">
          {pieces.map((piece) => {
            const isSelected = selectedPiece?.position.x === piece.position.x && selectedPiece?.position.y === piece.position.y;
            const isPlayable = piece.color === currentTurn && (!aiEnabled || piece.color === 'white');

            const pieceClasses = `
              select-none absolute
              transform transition-all duration-300 ease-in-out
              ${isPlayable ? 'hover:scale-110' : 'opacity-80'}
              ${isPlayable && !isSelected ? 'drop-shadow-[0_0_4px_rgba(59,130,246,1)]' : ''}
              ${piece.color === currentTurn && isCheck && piece.type === 'king' ? 'drop-shadow-[0_0_6px rgba(249,115,22,1)]' : ''}
              ${isSelected ? 'scale-110 drop-shadow-[0_0_6px rgba(59,130,246,1)]' : ''}
              ${imagesLoaded ? 'opacity-100' : 'opacity-0'}
            `;

            return (
              <div
                key={piece.id}
                className={pieceClasses}
                style={{
                  left: `${piece.position.x * 12.5}%`,
                  top: `${piece.position.y * 12.5}%`,
                  width: '12.5%',
                  height: '12.5%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img 
                  src={`/ressources/pieces/${piece.color}_${piece.type}.png`} 
                  alt={`${piece.color} ${piece.type}`} 
                  style={{ width: '80%', height: '80%' }} 
                  onLoad={handleImageLoad}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}