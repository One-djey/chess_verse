import React, { useRef, useEffect, useState, useCallback } from "react";
import { Piece, Position, GameMode, PieceColor } from "../types/chess";
import { findCastlingMove } from "../utils/chess";
import { PieceSkin, getPieceImageSrc } from "../utils/pieceImage";

interface ChessBoardProps {
  pieces: Piece[];
  currentTurn: "white" | "black";
  selectedPiece: Piece | null;
  validMoves: Position[];
  isCheck: boolean;
  onPieceSelect: (piece: Piece) => void;
  onMove: (position: Position) => void;
  gameMode: GameMode;
  lockedColor?: PieceColor | null;
  flipped?: boolean;
  rotateBlackPieces?: boolean;
  /** When set (typically during check), only these piece IDs receive the blue glow. */
  movablePieceIds?: Set<string> | null;
  skin?: PieceSkin;
  peerSkin?: PieceSkin;
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
  lockedColor = null,
  flipped = false,
  rotateBlackPieces = false,
  movablePieceIds = null,
  skin = "classic",
  peerSkin,
}: ChessBoardProps) {
  const pieceRefs = useRef<Map<string, { x: number; y: number }>>(new Map());
  const [imagesLoaded, setImagesLoaded] = useState(false);

  // Reset fade-in when skin changes
  useEffect(() => {
    setImagesLoaded(false);
  }, [skin]);

  const getSkinForPiece = (piece: Piece): PieceSkin => {
    if (peerSkin && lockedColor) {
      return piece.color === lockedColor ? skin : peerSkin;
    }
    return skin;
  };

  // ── Flip animation ────────────────────────────────────────────────────────
  // displayFlipped tracks the *rendered* orientation; it lags behind `flipped`
  // by half the animation duration so the swap happens when the board is invisible.
  const [displayFlipped, setDisplayFlipped] = useState(flipped);
  const [squishing, setSquishing] = useState(false);
  const prevFlipped = useRef(flipped);

  useEffect(() => {
    if (flipped === prevFlipped.current) return;
    prevFlipped.current = flipped;
    // Phase 1 — squish to zero
    setSquishing(true);
    const mid = setTimeout(() => {
      // Board invisible at this point — swap orientation
      setDisplayFlipped(flipped);
      // Phase 2 — un-squish
      setSquishing(false);
    }, 220);
    return () => clearTimeout(mid);
  }, [flipped]);

  // For static flips (P2P, solo default) keep displayFlipped in sync without animating
  useEffect(() => {
    setDisplayFlipped(flipped);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Map internal board coords ↔ display coords (uses displayFlipped for smooth animation)
  const toDisplay = useCallback(
    (x: number, y: number) => ({
      x: displayFlipped ? 7 - x : x,
      y: displayFlipped ? 7 - y : y,
    }),
    [displayFlipped],
  );
  const fromDisplay = useCallback(
    (dx: number, dy: number) => ({
      x: displayFlipped ? 7 - dx : dx,
      y: displayFlipped ? 7 - dy : dy,
    }),
    [displayFlipped],
  );

  useEffect(() => {
    pieces.forEach((piece) => {
      const key = `${piece.color}-${piece.type}-${piece.position.x}-${piece.position.y}`;
      if (!pieceRefs.current.has(key)) {
        pieceRefs.current.set(key, {
          x: piece.position.x,
          y: piece.position.y,
        });
      }
    });
  }, [pieces]);

  const handleImageLoad = () => {
    setImagesLoaded(true);
  };

  // ── Assimilation tooltip ─────────────────────────────────────────────────────
  const [hoveredSquare, setHoveredSquare] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Reset hover when the turn changes so the tooltip doesn't linger after a move
  useEffect(() => {
    setHoveredSquare(null);
  }, [currentTurn]);

  const hoveredPiece = hoveredSquare
    ? (pieces.find(
        (p) =>
          p.position.x === hoveredSquare.x && p.position.y === hoveredSquare.y,
      ) ?? null)
    : null;

  // Show acquired-types tooltip only when actively hovering a piece with acquiredTypes
  const tooltipPiece: Piece | null = gameMode.rules?.assimilation
    ? (hoveredPiece?.acquiredTypes?.length ?? 0) > 0
      ? hoveredPiece
      : null
    : null;

  const isValidMovePosition = (x: number, y: number) => {
    return validMoves.some((move) => {
      const normalizedMove = {
        x: ((move.x % 8) + 8) % 8,
        y: ((move.y % 8) + 8) % 8,
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
    if (y === 0) return currentTurn === "white";

    // Bottom border is only crossable for black pieces moving down
    if (y === 7) return currentTurn === "black";

    return false;
  };

  const getBorderGlow = (x: number, y: number) => {
    if (!isBorderCrossable(x, y)) return "";

    let glowClasses = "absolute inset-0 pointer-events-none ";

    // Left and right borders glow for both colors
    if (x === 0)
      glowClasses += "bg-gradient-to-l from-transparent to-green-400/50";
    if (x === 7)
      glowClasses += "bg-gradient-to-r from-transparent to-green-400/50";

    // Top border glows only for white pieces moving up
    if (y === 0 && currentTurn === "white") {
      glowClasses += "bg-gradient-to-t from-transparent to-green-400/50";
    }

    // Bottom border glows only for black pieces moving down
    if (y === 7 && currentTurn === "black") {
      glowClasses += "bg-gradient-to-b from-transparent to-green-400/50";
    }

    return glowClasses;
  };

  // Check if a move is a castling move
  const isCastlingMove = (x: number, y: number) => {
    if (!selectedPiece || selectedPiece.type !== "king") return false;

    // For king, check if the move is 2 squares horizontally
    if (
      Math.abs(selectedPiece.position.x - x) === 2 &&
      selectedPiece.position.y === y
    ) {
      // Find the corresponding castling move
      const target = { x, y };
      const castlingMove = findCastlingMove(
        selectedPiece,
        target,
        pieces,
        gameMode,
      );
      return castlingMove !== null;
    }

    return false;
  };

  return (
    <div className="aspect-square w-[80vh] max-w-[800px] bg-white shadow-xl rounded-lg p-4">
      <div
        className="grid grid-cols-8 grid-rows-8 h-full gap-1 relative"
        style={{
          transform: squishing ? "scaleX(0)" : "scaleX(1)",
          transition: squishing
            ? "transform 0.22s ease-in"
            : "transform 0.22s ease-out",
        }}
      >
        {/* Board squares */}
        <div className="absolute inset-0 grid grid-cols-8 grid-rows-8 gap-1 z-0">
          {Array(8)
            .fill(null)
            .map((_, dy) =>
              Array(8)
                .fill(null)
                .map((_, dx) => {
                  const { x, y } = fromDisplay(dx, dy);
                  const isLight = (x + y) % 2 === 0;
                  const borderGlow = getBorderGlow(x, y);

                  return (
                    <div
                      key={`${dx}-${dy}`}
                      className={`
                        w-full h-full relative
                        ${isLight ? "bg-gray-200" : "bg-gray-600"}
                        transition-colors duration-200
                      `}
                    >
                      {borderGlow && <div className={borderGlow} />}
                    </div>
                  );
                }),
            )}
        </div>

        {/* Valid moves overlay */}
        <div className="absolute inset-0 z-10">
          {Array(8)
            .fill(null)
            .map((_, dy) =>
              Array(8)
                .fill(null)
                .map((_, dx) => {
                  const { x, y } = fromDisplay(dx, dy);
                  const isValidMove = isValidMovePosition(x, y);
                  const isCastling = isCastlingMove(x, y);
                  if (!isValidMove && !isCastling) return null;

                  return (
                    <div
                      key={`overlay-${dx}-${dy}`}
                      className={`absolute cursor-pointer ${
                        isCastling ? "bg-purple-400" : "bg-blue-400"
                      } bg-opacity-40`}
                      style={{
                        left: `${dx * 12.5}%`,
                        top: `${dy * 12.5}%`,
                        width: "12.5%",
                        height: "12.5%",
                      }}
                      onClick={() => {
                        const originalMove = validMoves.find((move) => {
                          const normalized = {
                            x: ((move.x % 8) + 8) % 8,
                            y: ((move.y % 8) + 8) % 8,
                          };
                          return normalized.x === x && normalized.y === y;
                        });
                        if (originalMove) onMove(originalMove);
                      }}
                    />
                  );
                }),
            )}
        </div>

        {/* Interactive squares layer */}
        <div
          className="absolute inset-0 grid grid-cols-8 grid-rows-8 gap-1 z-20"
          onMouseLeave={() => setHoveredSquare(null)}
        >
          {Array(8)
            .fill(null)
            .map((_, dy) =>
              Array(8)
                .fill(null)
                .map((_, dx) => {
                  const { x, y } = fromDisplay(dx, dy);
                  const piece = pieces.find(
                    (p) => p.position.x === x && p.position.y === y,
                  );
                  const isValidMove = isValidMovePosition(x, y);
                  const isPlayable =
                    piece?.color === currentTurn &&
                    (!lockedColor || piece.color === lockedColor);

                  return (
                    <div
                      key={`interactive-${dx}-${dy}`}
                      className="w-full h-full"
                      onMouseEnter={() => setHoveredSquare({ x, y })}
                      onClick={() => {
                        if (piece && isPlayable) {
                          onPieceSelect(piece);
                        } else if (isValidMove) {
                          const originalMove = validMoves.find((move) => {
                            const normalized = {
                              x: ((move.x % 8) + 8) % 8,
                              y: ((move.y % 8) + 8) % 8,
                            };
                            return normalized.x === x && normalized.y === y;
                          });
                          if (originalMove) onMove(originalMove);
                        }
                      }}
                    />
                  );
                }),
            )}
        </div>

        {/* Assimilation tooltip */}
        {tooltipPiece &&
          (() => {
            const dp = toDisplay(
              tooltipPiece.position.x,
              tooltipPiece.position.y,
            );
            const showBelow = dp.y <= 1;

            // Arrow: always pinned to the piece's column center (percentages resolve vs the grid)
            const arrowLeftPct = (dp.x + 0.5) * 12.5;
            const arrowTopPct = showBelow ? (dp.y + 1) * 12.5 : dp.y * 12.5;
            const arrowTransform = showBelow
              ? "translateX(-50%)"
              : "translateX(-50%) translateY(-100%)";
            const arrowBorder: React.CSSProperties = showBelow
              ? {
                  borderLeft: "6px solid transparent",
                  borderRight: "6px solid transparent",
                  borderBottom: "6px solid white",
                }
              : {
                  borderLeft: "6px solid transparent",
                  borderRight: "6px solid transparent",
                  borderTop: "6px solid white",
                };

            // Bubble: edge-anchored horizontally to avoid overflow
            const bubbleTopPct = showBelow ? (dp.y + 1) * 12.5 : dp.y * 12.5;
            const bubbleTransformY = showBelow
              ? "translateY(6px)"
              : "translateY(calc(-100% - 6px))";
            let bubbleStyle: React.CSSProperties;
            if (dp.x <= 1) {
              bubbleStyle = {
                left: `${dp.x * 12.5}%`,
                top: `${bubbleTopPct}%`,
                transform: bubbleTransformY,
                width: "max-content",
              };
            } else if (dp.x >= 6) {
              bubbleStyle = {
                right: `${(7 - dp.x) * 12.5}%`,
                top: `${bubbleTopPct}%`,
                transform: bubbleTransformY,
                width: "max-content",
              };
            } else {
              bubbleStyle = {
                left: `${(dp.x + 0.5) * 12.5}%`,
                top: `${bubbleTopPct}%`,
                transform: `translateX(-50%) ${bubbleTransformY}`,
                width: "max-content",
              };
            }

            return (
              <>
                <div
                  className="absolute z-40 pointer-events-none w-0 h-0"
                  style={{
                    left: `${arrowLeftPct}%`,
                    top: `${arrowTopPct}%`,
                    transform: arrowTransform,
                    ...arrowBorder,
                  }}
                />
                <div
                  className="absolute z-40 pointer-events-none bg-white rounded-xl shadow-xl border border-gray-100 px-2.5 py-2 flex gap-2 items-center"
                  style={bubbleStyle}
                >
                  {tooltipPiece.acquiredTypes!.map((type) => (
                    <img
                      key={type}
                      src={getPieceImageSrc(
                        tooltipPiece.color,
                        type,
                        getSkinForPiece(tooltipPiece),
                      )}
                      alt={type}
                      className="w-7 h-7"
                    />
                  ))}
                </div>
              </>
            );
          })()}

        {/* Pieces layer */}
        <div className="absolute inset-0 z-30 pointer-events-none">
          {pieces.map((piece) => {
            const isSelected =
              selectedPiece?.position.x === piece.position.x &&
              selectedPiece?.position.y === piece.position.y;
            const isPlayable =
              piece.color === currentTurn &&
              (!lockedColor || piece.color === lockedColor);
            const hasGlow =
              isPlayable &&
              (movablePieceIds ? movablePieceIds.has(piece.id) : true);
            const isAssimilated =
              gameMode.rules?.assimilation &&
              (piece.acquiredTypes?.length ?? 0) > 0;
            const dp = toDisplay(piece.position.x, piece.position.y);

            // Single drop-shadow with explicit priority:
            //   orange › blue (selected) › green (assimilated) › blue (playable)
            // Always set a filter (even no-op) to keep GPU layer stable across turns.
            const shadowFilter = (() => {
              if (
                piece.color === currentTurn &&
                isCheck &&
                piece.type === "king"
              )
                return "drop-shadow(0 0 6px rgba(249,115,22,1))";
              if (isSelected) return "drop-shadow(0 0 6px rgba(59,130,246,1))";
              if (isAssimilated)
                return "drop-shadow(0 0 4px rgba(74,222,128,1))";
              if (hasGlow) return "drop-shadow(0 0 4px rgba(59,130,246,1))";
              return "drop-shadow(0 0 0px transparent)";
            })();

            return (
              // Outer div: GPU-composited position via transform — no layout reflow on move
              <div
                key={piece.id}
                className="absolute"
                style={{
                  width: "12.5%",
                  height: "12.5%",
                  left: 0,
                  top: 0,
                  transform: `translate(${dp.x * 100}%, ${dp.y * 100}%)`,
                  transition: "transform 300ms ease-in-out",
                }}
              >
                {/* Inner div: scale + filter + opacity, isolated from position animation */}
                <div
                  className={`
                    w-full h-full flex items-center justify-center
                    select-none hover:scale-110
                    ${isSelected ? "scale-110" : ""}
                    ${imagesLoaded ? "opacity-100" : "opacity-0"}
                  `}
                  style={{
                    filter: shadowFilter,
                    transition:
                      "transform 300ms ease-in-out, filter 80ms ease-in-out",
                  }}
                >
                  <img
                    src={getPieceImageSrc(
                      piece.color,
                      piece.type,
                      getSkinForPiece(piece),
                    )}
                    alt={`${piece.color} ${piece.type}`}
                    style={{
                      width: "80%",
                      height: "80%",
                      transform:
                        rotateBlackPieces && piece.color === "black"
                          ? "rotate(180deg)"
                          : undefined,
                    }}
                    onLoad={handleImageLoad}
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
