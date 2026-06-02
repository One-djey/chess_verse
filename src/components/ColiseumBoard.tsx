import { useState, useEffect } from "react";
import type { Piece, Position } from "../types/chess";
import type { Arena } from "../types/coliseum";
import { getPieceShadowFilter } from "../utils/boardRender";
import { getPieceImageSrc, type PieceSkin } from "../utils/pieceImage";

interface ColiseumBoardProps {
  arena: Arena;
  pieces: Piece[];
  currentTurn: "white" | "black";
  selectedPiece: Piece | null;
  validMoves: Position[];
  isCheck: boolean;
  movablePieceIds?: Set<string>;
  onPieceSelect: (piece: Piece) => void;
  onMove: (to: Position) => void;
  onDeselect?: () => void;
  skin?: string;
  endangeredPieceIds?: Set<string>;
  dangerousValidMoves?: Set<string>;
  hintMove?: { from: Position; to: Position } | null;
}

export default function ColiseumBoard({
  arena,
  pieces,
  currentTurn,
  selectedPiece,
  validMoves,
  isCheck,
  movablePieceIds,
  onPieceSelect,
  onMove,
  onDeselect,
  skin = "classic",
  endangeredPieceIds,
  dangerousValidMoves,
  hintMove,
}: ColiseumBoardProps) {
  const rows = arena.grid.length;
  const cols = arena.grid[0]?.length ?? rows;

  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [hoveredPos, setHoveredPos] = useState<{ x: number; y: number } | null>(
    null,
  );

  // Reset fade-in when skin changes
  useEffect(() => {
    setImagesLoaded(false);
  }, [skin]);

  return (
    <div
      className="relative bg-white shadow-xl rounded-lg overflow-hidden select-none"
      style={{
        width: `min(80vmin, 700px)`,
        aspectRatio: `${cols} / ${rows}`,
      }}
    >
      {/* Grid layer — absolute inset-0 to share the exact same coordinate space as the pieces layer */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
        }}
        onMouseLeave={() => setHoveredPos(null)}
      >
        {arena.grid.flatMap((row, y) =>
          row.map((cell, x) => {
            if (cell === 0) {
              return <div key={`${y}-${x}`} className="bg-white" />;
            }

            const piece = pieces.find(
              (p) => p.position.x === x && p.position.y === y,
            );
            const isValidMove = validMoves.some((m) => m.x === x && m.y === y);

            const isLight = (x + y) % 2 === 0;

            const handleCellClick = () => {
              if (isValidMove) {
                onMove({ x, y });
              } else if (piece && piece.color === currentTurn) {
                onPieceSelect(piece);
              } else {
                onDeselect?.();
              }
            };

            return (
              <div
                key={`${y}-${x}`}
                className={`relative cursor-pointer ${isLight ? "bg-gray-200" : "bg-gray-600"}`}
                onClick={handleCellClick}
                onMouseEnter={
                  cell === 1 ? () => setHoveredPos({ x, y }) : undefined
                }
              >
                {/* Valid move overlay */}
                {isValidMove && (
                  <div
                    className={`absolute inset-0 z-10 ${
                      hintMove &&
                      hintMove.to.x === x &&
                      hintMove.to.y === y &&
                      selectedPiece?.id &&
                      selectedPiece.position.x === hintMove.from.x &&
                      selectedPiece.position.y === hintMove.from.y
                        ? "bg-purple-400/60"
                        : dangerousValidMoves?.has(`${x},${y}`)
                          ? "bg-orange-400/50"
                          : "bg-blue-400/40"
                    }`}
                  />
                )}
              </div>
            );
          }),
        )}
      </div>

      {/* Pieces layer */}
      <div className="absolute inset-0 pointer-events-none z-30">
        {pieces.map((piece) => {
          const isSelected = selectedPiece?.id === piece.id;
          const isHovered =
            hoveredPos?.x === piece.position.x &&
            hoveredPos?.y === piece.position.y;

          return (
            <div
              key={piece.id}
              className="absolute"
              style={{
                width: `${100 / cols}%`,
                height: `${100 / rows}%`,
                left: 0,
                top: 0,
                transform: `translate(${piece.position.x * 100}%, ${piece.position.y * 100}%)`,
                transition: "transform 300ms ease-in-out",
              }}
            >
              <div
                className={`w-full h-full flex items-center justify-center ${
                  isSelected || isHovered ? "scale-110" : ""
                }`}
                style={{
                  filter: getPieceShadowFilter({
                    piece,
                    currentTurn,
                    isCheck,
                    selectedPieceId: selectedPiece?.id ?? null,
                    movablePieceIds,
                    endangeredPieceIds,
                    hintFromId:
                      hintMove &&
                      piece.position.x === hintMove.from.x &&
                      piece.position.y === hintMove.from.y
                        ? piece.id
                        : null,
                  }),
                  transition:
                    "transform 300ms ease-in-out, filter 80ms ease-in-out",
                }}
              >
                <img
                  src={getPieceImageSrc(
                    piece.color,
                    piece.type,
                    skin as PieceSkin,
                  )}
                  alt={`${piece.color} ${piece.type}`}
                  className={imagesLoaded ? "opacity-100" : "opacity-0"}
                  style={{
                    width: "80%",
                    height: "80%",
                    objectFit: "contain",
                    transition: "opacity 150ms",
                  }}
                  onLoad={() => setImagesLoaded(true)}
                  draggable={false}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
