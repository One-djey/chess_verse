import { useTranslation } from "react-i18next";

interface Props {
  wins: number;
  losses: number;
  draws: number;
}

export default function WinRateRing({ wins, losses, draws }: Props) {
  const { t } = useTranslation();
  const total = wins + losses + draws;

  const cx = 60;
  const cy = 60;
  const r = 48;
  const circumference = 2 * Math.PI * r;
  const strokeWidth = 10;

  // Compute arcs
  const winFrac = total > 0 ? wins / total : 0;
  const lossFrac = total > 0 ? losses / total : 0;
  const drawFrac = total > 0 ? draws / total : 0;

  // SVG arc helper — returns strokeDasharray + strokeDashoffset for a segment
  function segment(frac: number, offset: number) {
    const dash = frac * circumference;
    const gap = circumference - dash;
    return {
      strokeDasharray: `${dash.toFixed(2)} ${gap.toFixed(2)}`,
      strokeDashoffset: (-offset * circumference).toFixed(2),
    };
  }

  const winSeg = segment(winFrac, 0);
  const drawSeg = segment(drawFrac, winFrac);
  const lossSeg = segment(lossFrac, winFrac + drawFrac);

  const winPct = total > 0 ? Math.round((wins / total) * 100) : 0;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-[120px] h-[120px]">
        <svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          className="-rotate-90"
        >
          {/* Background track */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
          />

          {total === 0 ? (
            /* Empty state — single gray ring */
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="#d1d5db"
              strokeWidth={strokeWidth}
            />
          ) : (
            <>
              {/* Wins — green */}
              {winFrac > 0 && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth={strokeWidth}
                  strokeLinecap="butt"
                  {...winSeg}
                />
              )}
              {/* Draws — amber */}
              {drawFrac > 0 && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={strokeWidth}
                  strokeLinecap="butt"
                  {...drawSeg}
                />
              )}
              {/* Losses — red */}
              {lossFrac > 0 && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth={strokeWidth}
                  strokeLinecap="butt"
                  {...lossSeg}
                />
              )}
            </>
          )}
        </svg>

        {/* Centre label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className="text-2xl font-bold text-gray-800 leading-none">
            {winPct}%
          </span>
          <span className="text-[10px] text-gray-400 text-center leading-tight max-w-[56px]">
            {t("profile.winRate")}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-3 text-xs">
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
          <span className="text-gray-600">
            {t("profile.wins")} · {wins}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
          <span className="text-gray-600">
            {t("profile.draws")} · {draws}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
          <span className="text-gray-600">
            {t("profile.losses")} · {losses}
          </span>
        </div>
      </div>
    </div>
  );
}
