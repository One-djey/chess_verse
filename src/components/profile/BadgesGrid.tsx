import { useTranslation } from "react-i18next";
import { BADGES } from "../../services/statsService";
import type { ChessverseStats } from "../../services/statsService";

interface Props {
  stats: ChessverseStats;
}

export default function BadgesGrid({ stats }: Props) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {BADGES.map((badge) => {
        const unlocked = badge.isUnlocked(stats);
        const prog = badge.progress?.(stats);

        return (
          <div key={badge.id} className="relative group">
            {/* Tooltip — visible on hover */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none text-center">
              {t(`${badge.i18nKey}Desc`)}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
            </div>

            {/* Badge card */}
            <div
              className={`
                flex flex-col items-center gap-2 p-3 rounded-xl border text-center
                transition-all duration-200
                ${
                  unlocked
                    ? "bg-white border-yellow-300 shadow-sm shadow-yellow-100"
                    : "bg-gray-50 border-gray-200 opacity-60 grayscale"
                }
              `}
            >
              {/* Icon */}
              <span
                className={`text-3xl leading-none ${unlocked ? "" : "opacity-40"}`}
              >
                {badge.icon}
              </span>

              {/* Label */}
              <span
                className={`text-xs font-semibold leading-tight ${
                  unlocked ? "text-gray-800" : "text-gray-400"
                }`}
              >
                {t(badge.i18nKey)}
              </span>

              {/* Progress bar (when locked) */}
              {!unlocked && prog && (
                <div className="w-full">
                  <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.round((prog.current / prog.target) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 mt-0.5 block">
                    {prog.current}/{prog.target}
                  </span>
                </div>
              )}

              {/* Unlocked checkmark */}
              {unlocked && (
                <span className="text-xs text-yellow-600 font-medium">
                  {t("profile.unlocked")}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
