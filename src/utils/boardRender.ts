import type { Piece } from "../types/chess";

export interface PieceGlowOptions {
  piece: Piece;
  currentTurn: "white" | "black";
  isCheck: boolean;
  selectedPieceId?: string | null;
  endangeredPieceIds?: Set<string> | null;
  movablePieceIds?: Set<string> | null;
  hintFromId?: string | null;
  isAssimilated?: boolean;
}

export function getPieceShadowFilter({
  piece,
  currentTurn,
  isCheck,
  selectedPieceId,
  endangeredPieceIds,
  movablePieceIds,
  hintFromId,
  isAssimilated,
}: PieceGlowOptions): string {
  const isSelected = selectedPieceId === piece.id;
  const isEndangered = endangeredPieceIds?.has(piece.id) ?? false;
  const hasGlow = movablePieceIds?.has(piece.id) ?? false;
  const isHintPiece = hintFromId === piece.id;

  if (piece.color === currentTurn && isCheck && piece.type === "king")
    return "drop-shadow(0 0 6px rgba(239,68,68,1))"; // red — check
  if (isHintPiece) return "drop-shadow(0 0 6px rgba(168,85,247,1))"; // purple — hint
  if (isEndangered && !isSelected)
    return "drop-shadow(0 0 6px rgba(249,115,22,1))"; // orange — danger
  if (isSelected) return "drop-shadow(0 0 6px rgba(59,130,246,1))"; // blue — selected
  if (isAssimilated) return "drop-shadow(0 0 4px rgba(74,222,128,1))"; // green — assimilation
  if (hasGlow) return "drop-shadow(0 0 4px rgba(59,130,246,1))"; // blue — playable
  return "drop-shadow(0 0 0px transparent)";
}
