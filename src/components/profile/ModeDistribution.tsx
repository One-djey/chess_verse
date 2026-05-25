import { useTranslation } from "react-i18next";

interface Props {
  modeGameCount: Record<string, number>;
  totalGames: number;
}

const MODE_COLORS: Record<string, string> = {
  classic: "bg-blue-500",
  borderless: "bg-violet-500",
  "all-random": "bg-orange-500",
  assimilation: "bg-emerald-500",
};

const MODE_BG: Record<string, string> = {
  classic: "bg-blue-50",
  borderless: "bg-violet-50",
  "all-random": "bg-orange-50",
  assimilation: "bg-emerald-50",
};

const MODE_TEXT: Record<string, string> = {
  classic: "text-blue-700",
  borderless: "text-violet-700",
  "all-random": "text-orange-700",
  assimilation: "text-emerald-700",
};

const ALL_MODES = ["classic", "borderless", "all-random", "assimilation"];

export default function ModeDistribution({ modeGameCount, totalGames }: Props) {
  const { t } = useTranslation();

  const sorted = ALL_MODES.map((id) => ({
    id,
    count: modeGameCount[id] ?? 0,
  })).sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-2.5">
      {sorted.map(({ id, count }) => {
        const pct = totalGames > 0 ? Math.round((count / totalGames) * 100) : 0;
        const barColor = MODE_COLORS[id] ?? "bg-gray-400";
        const bgColor = MODE_BG[id] ?? "bg-gray-50";
        const textColor = MODE_TEXT[id] ?? "text-gray-700";

        return (
          <div key={id} className={`rounded-lg p-3 ${bgColor}`}>
            <div className="flex justify-between items-center mb-1.5">
              <span className={`text-xs font-semibold ${textColor}`}>
                {t(`modes.${id}.title`)}
              </span>
              <span className="text-xs text-gray-500">
                {count} {t(count === 1 ? "profile.game" : "profile.games")} ·{" "}
                {pct}%
              </span>
            </div>
            <div className="h-1.5 bg-white/70 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
