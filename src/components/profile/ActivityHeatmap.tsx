import React from "react";
import { useTranslation } from "react-i18next";
import { getHeatmapData } from "../../services/statsService";

interface Props {
  dailyActivity: Record<string, number>;
}

const MONTH_KEYS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;

function getCellColor(count: number): string {
  if (count === 0) return "bg-gray-100";
  if (count === 1) return "bg-emerald-200";
  if (count <= 3) return "bg-emerald-400";
  return "bg-emerald-600";
}

export default function ActivityHeatmap({ dailyActivity }: Props) {
  const { t } = useTranslation();
  const data = getHeatmapData(dailyActivity);

  // Group by week (columns), 7 rows per week (Mon–Sun)
  // data[0] is 364 days ago. Pad the first week so day 0 falls on the correct weekday.
  const firstDate = new Date();
  firstDate.setDate(firstDate.getDate() - 364);
  const firstDow = firstDate.getDay(); // 0=Sun … 6=Sat

  const paddedData: ({ date: string; count: number } | null)[] = [
    ...Array(firstDow).fill(null),
    ...data,
  ];

  const weeks: ({ date: string; count: number } | null)[][] = [];
  for (let i = 0; i < paddedData.length; i += 7) {
    weeks.push(paddedData.slice(i, i + 7));
  }

  // Month label positions: one label per month, placed at the first column
  // that contains any day with date ≤ 7. Dedup by label to avoid the same
  // month appearing in two consecutive columns when its 1st falls near a
  // week boundary.
  const monthPositions: { label: string; col: number }[] = [];
  weeks.forEach((week, wi) => {
    week.forEach((day) => {
      if (!day) return;
      const d = new Date(day.date);
      if (d.getDate() <= 7) {
        const label = t(`profile.months.${MONTH_KEYS[d.getMonth()]}`);
        if (!monthPositions.find((m) => m.label === label)) {
          monthPositions.push({ label, col: wi });
        }
      }
    });
  });

  const [tooltip, setTooltip] = React.useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  const dayLabels = [
    "",
    t("profile.days.mon"),
    "",
    t("profile.days.wed"),
    "",
    t("profile.days.fri"),
    "",
  ];

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        {t("profile.activity")}
      </h3>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-max">
          {/* Month labels — absolute positioning to avoid text overlap */}
          <div
            className="relative mb-1"
            style={{ paddingLeft: "20px", height: "16px" }}
          >
            {monthPositions.map(({ label, col }) => (
              <span
                key={`${label}-${col}`}
                className="absolute text-xs text-gray-400 whitespace-nowrap"
                style={{ left: col * 14 }} // 12px (w-3) + 2px (gap)
              >
                {label}
              </span>
            ))}
          </div>

          <div className="flex gap-0.5">
            {/* Day labels */}
            <div className="flex flex-col gap-0.5 mr-1">
              {dayLabels.map((d, i) => (
                <div
                  key={i}
                  className="w-3 h-3 text-xs text-gray-400 flex items-center justify-center leading-none"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Grid */}
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-0.5">
                {week.map((day, di) => {
                  if (!day) {
                    return <div key={di} className="w-3 h-3" />;
                  }
                  return (
                    <div
                      key={di}
                      className={`w-3 h-3 rounded-sm cursor-default transition-opacity hover:opacity-75 ${getCellColor(day.count)}`}
                      onMouseEnter={(e) => {
                        const rect = (
                          e.target as HTMLElement
                        ).getBoundingClientRect();
                        const countText =
                          day.count === 0
                            ? t("profile.activityNoGames")
                            : `${day.count} ${t(day.count === 1 ? "profile.game" : "profile.games")}`;
                        setTooltip({
                          x: rect.left + rect.width / 2,
                          y: rect.top - 8,
                          text: `${day.date}: ${countText}`,
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-1 mt-2 justify-end">
            <span className="text-xs text-gray-400">{t("profile.less")}</span>
            {[
              "bg-gray-100",
              "bg-emerald-200",
              "bg-emerald-400",
              "bg-emerald-600",
            ].map((c, i) => (
              <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
            ))}
            <span className="text-xs text-gray-400">{t("profile.more")}</span>
          </div>
        </div>
      </div>

      {/* Tooltip (fixed position) */}
      {tooltip && (
        <div
          className="fixed z-50 px-2 py-1 bg-gray-800 text-white text-xs rounded shadow-lg pointer-events-none -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
