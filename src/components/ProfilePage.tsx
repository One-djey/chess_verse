import { useTranslation } from "react-i18next";
import NavBar from "./NavBar";
import Footer from "./Footer";
import ActivityHeatmap from "./profile/ActivityHeatmap";
import ELOBadge from "./profile/ELOBadge";
import WinRateRing from "./profile/WinRateRing";
import PieceStats from "./profile/PieceStats";
import BadgesGrid from "./profile/BadgesGrid";
import ModeDistribution from "./profile/ModeDistribution";
import {
  getStats,
  getPreferredMode,
  formatDuration,
} from "../services/statsService";

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
  accent = "bg-white",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: string;
  accent?: string;
}) {
  return (
    <div
      className={`${accent} rounded-xl border border-gray-200 p-4 flex flex-col gap-1 shadow-sm`}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg leading-none">{icon}</span>
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <span className="text-2xl font-bold text-gray-900 leading-tight">
        {value}
      </span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-bold text-gray-700 border-b border-gray-200 pb-2 mb-4">
      {children}
    </h2>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { t } = useTranslation();
  const stats = getStats();

  const avgDurationMs =
    stats.totalGames > 0 ? stats.totalDurationMs / stats.totalGames : 0;

  const preferredModeId = getPreferredMode(stats.modeGameCount);
  const preferredModeLabel = preferredModeId
    ? t(`modes.${preferredModeId}.title`)
    : "—";

  const isEmpty = stats.totalGames === 0;

  const breadcrumbs = [{ label: t("profile.title") }];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <NavBar breadcrumbs={breadcrumbs} />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 space-y-10">
        {/* ── Empty state ── */}
        {isEmpty && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center">
            <span className="text-4xl mb-4 block">♟️</span>
            <p className="text-gray-500 text-sm">{t("profile.noGames")}</p>
          </div>
        )}

        {/* ── Hero: ELO + Win rate ── */}
        {!isEmpty && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex flex-wrap items-center justify-around gap-8">
              <ELOBadge maxAILevelBeaten={stats.maxAILevelBeaten} />

              <WinRateRing
                wins={stats.wins}
                losses={stats.losses}
                draws={stats.draws}
              />

              {/* Win streak */}
              <div className="flex flex-col items-center gap-2">
                <div className="text-5xl leading-none">
                  {stats.currentWinStreak > 0 ? "🔥" : "❄️"}
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">
                    {stats.currentWinStreak}
                  </div>
                  <div className="text-xs text-gray-500">
                    {t("profile.currentStreak")}
                  </div>
                </div>
                <div className="text-xs text-gray-400 text-center">
                  {t("profile.winStreak")}: {stats.maxWinStreak}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Stats grid ── */}
        {!isEmpty && (
          <section>
            <SectionHeading>{t("profile.stats")}</SectionHeading>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <StatCard
                icon="🎮"
                label={t("profile.totalGames")}
                value={stats.totalGames}
                accent="bg-white"
              />
              <StatCard
                icon="🖥️"
                label={t("profile.local")}
                value={stats.localGames}
                sub={
                  stats.totalGames > 0
                    ? `${Math.round((stats.localGames / stats.totalGames) * 100)}%`
                    : undefined
                }
              />
              <StatCard
                icon="🌐"
                label={t("profile.p2p")}
                value={stats.p2pGames}
                sub={
                  stats.totalGames > 0
                    ? `${Math.round((stats.p2pGames / stats.totalGames) * 100)}%`
                    : undefined
                }
              />
              <StatCard
                icon="🤖"
                label={t("profile.ai")}
                value={stats.aiGames}
                sub={
                  stats.totalGames > 0
                    ? `${Math.round((stats.aiGames / stats.totalGames) * 100)}%`
                    : undefined
                }
              />
              <StatCard
                icon="🏳️"
                label={t("profile.surrenders")}
                value={stats.surrenders}
                accent="bg-white"
              />
              <StatCard
                icon="⏱️"
                label={t("profile.totalTime")}
                value={formatDuration(stats.totalDurationMs)}
              />
              <StatCard
                icon="⌛"
                label={t("profile.avgTime")}
                value={avgDurationMs > 0 ? formatDuration(avgDurationMs) : "—"}
              />
              <StatCard
                icon="🎯"
                label={t("profile.favoriteMode")}
                value={preferredModeLabel}
              />
            </div>
          </section>
        )}

        {/* ── Activity heatmap ── */}
        {!isEmpty && (
          <section>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <ActivityHeatmap dailyActivity={stats.dailyActivity} />
            </div>
          </section>
        )}

        {/* ── Pieces + Mode distribution ── */}
        {!isEmpty && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pieces */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <SectionHeading>
                {t("profile.favoritePiece")} / {t("profile.leastFavoritePiece")}
              </SectionHeading>
              <PieceStats
                pieceMoveCount={stats.pieceMoveCount}
                pieceCapturedCount={stats.pieceCapturedCount}
              />
            </div>

            {/* Modes */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <SectionHeading>{t("profile.favoriteMode")}</SectionHeading>
              <ModeDistribution
                modeGameCount={stats.modeGameCount}
                totalGames={stats.totalGames}
              />
            </div>
          </section>
        )}

        {/* ── Badges ── */}
        <section>
          <SectionHeading>{t("profile.achievements")}</SectionHeading>
          <BadgesGrid stats={stats} />
        </section>
      </main>

      <Footer />
    </div>
  );
}
