import { useTranslation } from "react-i18next";
import { getTopPiece } from "../../services/statsService";
import type { PieceType } from "../../types/chess";

interface Props {
  pieceMoveCount: Partial<Record<PieceType, number>>;
  pieceCapturedCount: Partial<Record<PieceType, number>>;
}

function PieceCard({
  pieceType,
  label,
  sublabel,
  count,
  countLabel,
  accent,
}: {
  pieceType: PieceType | null;
  label: string;
  sublabel: string;
  count: number;
  countLabel: string;
  accent: string;
}) {
  const { t } = useTranslation();

  if (!pieceType) {
    return (
      <div className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-xl border border-gray-200 min-w-[120px]">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
          <span className="text-2xl text-gray-300">?</span>
        </div>
        <span className="text-xs text-gray-400 text-center">{label}</span>
        <span className="text-xs text-gray-300">—</span>
      </div>
    );
  }

  const imgSrc = `/ressources/pieces/classic/white_${pieceType}.png`;
  const pieceName = t(`profile.pieces.${pieceType}`);

  return (
    <div
      className={`flex flex-col items-center gap-2 p-4 rounded-xl border min-w-[120px] ${accent}`}
    >
      <div className="w-14 h-14 flex items-center justify-center">
        <img
          src={imgSrc}
          alt={pieceName}
          className="w-full h-full object-contain drop-shadow-sm"
        />
      </div>
      <span className="text-sm font-semibold text-gray-800">{pieceName}</span>
      <span className="text-xs text-gray-500 text-center leading-tight">
        {label}
      </span>
      <span className="text-xs font-medium text-gray-600">
        {count} {countLabel}
      </span>
      <span className="text-xs text-gray-400 text-center">{sublabel}</span>
    </div>
  );
}

export default function PieceStats({
  pieceMoveCount,
  pieceCapturedCount,
}: Props) {
  const { t } = useTranslation();

  const favPiece = getTopPiece(pieceMoveCount);
  const leastPiece = getTopPiece(pieceCapturedCount);

  const favCount = favPiece ? (pieceMoveCount[favPiece] ?? 0) : 0;
  const leastCount = leastPiece ? (pieceCapturedCount[leastPiece] ?? 0) : 0;

  return (
    <div className="flex gap-3 flex-wrap justify-center">
      <PieceCard
        pieceType={favPiece}
        label={t("profile.favoritePiece")}
        sublabel={t("profile.favoritePieceHint")}
        count={favCount}
        countLabel={t("profile.movesMade")}
        accent="bg-blue-50 border-blue-200"
      />
      <PieceCard
        pieceType={leastPiece}
        label={t("profile.leastFavoritePiece")}
        sublabel={t("profile.leastFavoritePieceHint")}
        count={leastCount}
        countLabel={t("profile.timesCaptured")}
        accent="bg-red-50 border-red-200"
      />
    </div>
  );
}
