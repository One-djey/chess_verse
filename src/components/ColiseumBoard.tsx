import { useState, useEffect } from "react";
import type { Piece, Position } from "../types/chess";
import type { Arena } from "../types/coliseum";
import { getPieceShadowFilter } from "../utils/boardRender";
import { getPieceImageSrc, type PieceSkin } from "../utils/pieceImage";
import { useBoardSkin } from "../hooks/useBoardSkin";
import { getBoardSkinDef, getSlabUrl } from "../utils/boardSkin";

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

  const { boardSkin } = useBoardSkin();
  const boardSkinDef = getBoardSkinDef(boardSkin);

  const [imagesLoaded, setImagesLoaded] = useState(true);
  const [hoveredPos, setHoveredPos] = useState<{ x: number; y: number } | null>(
    null,
  );

  // Brief fade-out/in on skin change; fallback ensures visibility even with cached images
  useEffect(() => {
    setImagesLoaded(false);
    const timer = setTimeout(() => setImagesLoaded(true), 80);
    return () => clearTimeout(timer);
  }, [skin]);

  return (
    <div
      className="[container-type:inline-size]"
      style={{
        width: `min(80vh, calc(100vw - 1rem), calc((100vh - 8rem) * ${cols} / ${rows}))`,
        aspectRatio: `${cols} / ${rows}`,
      }}
    >
      <div
        className={`relative rounded-lg overflow-hidden select-none w-full h-full ${boardSkinDef.border ? "bg-transparent" : "bg-white shadow-xl"}`}
      >
        {/* Grid layer — absolute inset-0 to share the exact same coordinate space as the pieces layer */}
        <div
          style={{
            position: "absolute",
            inset: boardSkinDef.borderInset ?? "0",
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`,
          }}
          onMouseLeave={() => setHoveredPos(null)}
        >
          {arena.grid.flatMap((row, y) =>
            row.map((cell, x) => {
              if (cell === 0) {
                return (
                  <div
                    key={`${y}-${x}`}
                    className={boardSkinDef.slabsCount ? "" : "bg-white"}
                  >
                    {boardSkinDef.slabsCount && (
                      <img
                        src={getSlabUrl(boardSkinDef, x, y)}
                        alt=""
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    )}
                  </div>
                );
              }

              const piece = pieces.find(
                (p) => p.position.x === x && p.position.y === y,
              );
              const isValidMove = validMoves.some(
                (m) => m.x === x && m.y === y,
              );

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
                  className={`relative cursor-pointer${!boardSkinDef.lightSquare ? ` ${isLight ? "bg-gray-200" : "bg-gray-600"}` : ""}`}
                  style={
                    boardSkinDef.lightSquare
                      ? {
                          backgroundImage: `url(${isLight ? boardSkinDef.lightSquare : boardSkinDef.darkSquare})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : undefined
                  }
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

        {/* Board border overlay — covers the full outer container */}
        {boardSkinDef.border && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `url(${boardSkinDef.border})`,
              backgroundSize: "100% 100%",
              zIndex: 50,
            }}
          />
        )}

        {/* Pieces layer */}
        <div
          className="absolute pointer-events-none z-30"
          style={{ inset: boardSkinDef.borderInset ?? "0" }}
        >
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
                  left: `${(piece.position.x * 100) / cols}%`,
                  top: `${(piece.position.y * 100) / rows}%`,
                  transition: "left 300ms ease-in-out, top 300ms ease-in-out",
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
    </div>
  );
}
