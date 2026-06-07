import React, { useContext } from "react";
import { useTranslation } from "react-i18next";
import { PieceColor, PieceType } from "../types/chess";
import { SkinContext } from "../context/SkinContext";
import { getPieceImageSrc } from "../utils/pieceImage";

const PROMOTION_PIECES: PieceType[] = ["queen", "rook", "bishop", "knight"];

interface Props {
  color: PieceColor;
  onSelect: (type: PieceType) => void;
}

export function PromotionPicker({ color, onSelect }: Props) {
  const { t } = useTranslation();
  const skinCtx = useContext(SkinContext);
  const skin = skinCtx?.skin ?? "classic";

  return (
    <div className="flex justify-center w-full">
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white border border-gray-200 rounded-lg shadow-md">
        <span className="text-sm font-bold text-gray-700 whitespace-nowrap">
          {t("promotion.choosePiece")}
        </span>
        <div className="flex gap-1">
          {PROMOTION_PIECES.map((type) => (
            <button
              key={type}
              onClick={() => onSelect(type)}
              className="w-11 h-11 flex items-center justify-center rounded-md hover:bg-gray-100 active:bg-gray-200 transition-colors cursor-pointer"
              title={t(`profile.pieces.${type}`)}
            >
              <img
                src={getPieceImageSrc(color, type, skin)}
                alt={type}
                className="w-9 h-9 object-contain"
                draggable={false}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
