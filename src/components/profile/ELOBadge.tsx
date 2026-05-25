import { useTranslation } from "react-i18next";
import { getELORank } from "../../services/statsService";

interface Props {
  maxAILevelBeaten: number;
}

export default function ELOBadge({ maxAILevelBeaten }: Props) {
  const { t } = useTranslation();
  const rank = getELORank(maxAILevelBeaten);

  const isLegend = maxAILevelBeaten >= 20;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`
          relative flex flex-col items-center justify-center
          w-28 h-28 rounded-2xl border-2 shadow-sm
          ${rank.bgColor} ${rank.borderColor}
          ${isLegend ? "ring-2 ring-purple-300 ring-offset-2" : ""}
        `}
      >
        {/* Crown icon */}
        <span className="text-3xl leading-none mb-1">
          {maxAILevelBeaten === 0
            ? "♟"
            : maxAILevelBeaten < 4
              ? "🛡"
              : maxAILevelBeaten < 7
                ? "⚔️"
                : maxAILevelBeaten < 11
                  ? "🐴"
                  : maxAILevelBeaten < 15
                    ? "🗼"
                    : maxAILevelBeaten < 18
                      ? "👑"
                      : maxAILevelBeaten < 20
                        ? "🏆"
                        : "⭐"}
        </span>

        {/* Level number */}
        {maxAILevelBeaten > 0 && (
          <span className={`text-lg font-bold leading-none ${rank.color}`}>
            {t("profile.level")}
            {maxAILevelBeaten}
          </span>
        )}

        {/* Legend shimmer overlay */}
        {isLegend && (
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-200/40 via-pink-200/40 to-yellow-200/40 pointer-events-none" />
        )}
      </div>

      {/* Rank label */}
      <span className={`text-sm font-semibold ${rank.color}`}>
        {t(rank.i18nKey)}
      </span>

      {/* Sub-label */}
      <span className="text-xs text-gray-400 text-center">
        {t("profile.eloRank")}
        {maxAILevelBeaten > 0 && (
          <>
            {" "}
            · {t("profile.ai")} {maxAILevelBeaten}/20
          </>
        )}
      </span>
    </div>
  );
}
