import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Trophy,
  Clock,
  Hash,
  Brain,
  RefreshCw,
  Loader2,
  Flag,
  LogOut,
  X,
} from "lucide-react";
import { getDifficultyKey } from "../utils/chess";
import { PieceColor } from "../types/chess";
import { RematchState } from "../types/p2p";

interface GameOverProps {
  winner: PieceColor | null;
  drawReason?: "stalemate" | "only-kings" | "repetition" | "fifty-moves";
  surrenderedBy?: PieceColor;
  duration: number;
  moveCount: number;
  onReplay: () => void;
  aiEnabled?: boolean;
  aiDifficulty?: number;
  // P2P-specific
  isP2PMode?: boolean;
  playerColor?: PieceColor | null;
  rematchState?: RematchState;
  peerLeft?: boolean;
  onRematch?: () => void;
  onAcceptRematch?: () => void;
  onDeclineRematch?: () => void;
  onMainMenu?: () => void;
  /** Path to return to on "Main Menu" — defaults to '/' */
  returnPath?: string;
  /** Called when the user dismisses the modal (✕ or backdrop click) */
  onDismiss?: () => void;
}

export default function GameOver({
  winner,
  drawReason,
  surrenderedBy,
  duration,
  moveCount,
  onReplay,
  aiEnabled,
  aiDifficulty,
  isP2PMode,
  playerColor,
  rematchState,
  peerLeft,
  onRematch,
  onAcceptRematch,
  onDeclineRematch,
  onMainMenu,
  returnPath = "/",
  onDismiss,
}: GameOverProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const goMainMenu = () => {
    onMainMenu?.();
    navigate(returnPath);
  };
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);
  const isDraw = winner === null;

  // ── Title logic ────────────────────────────────────────────────────────────
  const getTitle = () => {
    if (isDraw) return t("gameOver.draw");
    if (surrenderedBy) {
      return surrenderedBy === "white"
        ? t("gameOver.whiteSurrendered")
        : t("gameOver.blackSurrendered");
    }
    if (isP2PMode) {
      // When playerColor is known, personalise the title ("You win!" / "You lose.").
      // Without playerColor, fall back to the generic color-based title.
      if (playerColor != null) {
        return winner === playerColor
          ? t("gameOver.youWin")
          : t("gameOver.youLose");
      }
      return winner === "white"
        ? t("gameOver.whiteWins")
        : t("gameOver.blackWins");
    }
    // UX-001 item 4 (intentional): in local pass-and-play without AI both
    // players share the same screen, so a generic "Victory!" title is correct
    // regardless of which color won — there is no single "local player" to
    // personalise toward.
    return aiEnabled && winner === "black"
      ? t("gameOver.defeat")
      : t("gameOver.victory");
  };

  const isDefeat = isP2PMode
    ? winner !== null && winner !== playerColor
    : !isP2PMode && aiEnabled && winner === "black";

  const stats = [
    {
      icon: <Clock className="w-5 h-5" />,
      label: t("gameOver.duration"),
      value: `${minutes}m ${seconds}s`,
    },
    {
      icon: <Hash className="w-5 h-5" />,
      label: t("gameOver.movesPlayed"),
      value: moveCount.toString(),
    },
    ...(aiEnabled && aiDifficulty
      ? [
          {
            icon: <Brain className="w-5 h-5" />,
            label: t("gameOver.aiLevel"),
            value: t(getDifficultyKey(aiDifficulty)),
          },
        ]
      : []),
  ];

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]"
      onClick={onDismiss}
    >
      <div
        className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
            aria-label={t("common.close")}
          >
            <X size={18} />
          </button>
        )}
        {/* Peer left banner */}
        {isP2PMode && peerLeft && (
          <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
            <LogOut size={16} className="shrink-0" />
            {t("gameOver.opponentLeft")}
          </div>
        )}

        <div className="text-center">
          <div className="mb-12 relative">
            {surrenderedBy ? (
              <Flag
                className={`w-16 h-16 mx-auto ${isDefeat ? "text-gray-400" : "text-yellow-400"}`}
              />
            ) : (
              <Trophy
                className={`w-16 h-16 mx-auto ${isDraw ? "text-blue-400" : isDefeat ? "text-gray-400" : "text-yellow-400"}`}
              />
            )}
            {!isDraw && (
              <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-white px-4 py-1 rounded-full border border-gray-200">
                <span className="text-sm font-medium text-gray-600">
                  {winner === "white"
                    ? t("gameOver.white")
                    : t("gameOver.black")}
                </span>
              </div>
            )}
          </div>

          <h2 className="text-3xl font-bold mb-2">{getTitle()}</h2>
          {isDraw && drawReason && (
            <p className="text-sm text-gray-500 mb-6">
              {drawReason === "stalemate"
                ? t("gameOver.stalemate")
                : drawReason === "repetition"
                  ? t("gameOver.repetition")
                  : drawReason === "fifty-moves"
                    ? t("gameOver.fiftyMoves")
                    : t("gameOver.onlyKings")}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 mb-6">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex items-center justify-between p-4 rounded-lg bg-gray-50 border border-gray-100"
              >
                <div className="flex items-center gap-3 text-gray-600">
                  {stat.icon}
                  <span className="font-medium">{stat.label}</span>
                </div>
                <span className="text-lg font-semibold text-gray-900">
                  {stat.value}
                </span>
              </div>
            ))}
          </div>

          {/* Rematch offered by opponent */}
          {isP2PMode && rematchState === "offered" && (
            <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg text-center">
              <p className="font-semibold text-indigo-800 mb-3">
                {t("gameOver.opponentWantsRematch")}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={onAcceptRematch}
                  className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 font-medium transition"
                >
                  {t("gameOver.accept")}
                </button>
                <button
                  onClick={onDeclineRematch}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 font-medium transition"
                >
                  {t("gameOver.decline")}
                </button>
              </div>
            </div>
          )}

          {/* Waiting / starting */}
          {isP2PMode &&
            (rematchState === "requested" || rematchState === "starting") && (
              <div className="mb-4 flex items-center justify-center gap-2 p-3 bg-gray-50 rounded-lg text-gray-500 text-sm">
                <Loader2 size={16} className="animate-spin" />
                {t("gameOver.waitingForOpponent")}
              </div>
            )}

          {/* Bottom buttons */}
          <div className="flex gap-4 justify-center mt-2">
            {!isP2PMode && (
              <button
                onClick={onReplay}
                className="flex-1 bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition font-medium"
              >
                {t("gameOver.playAgain")}
              </button>
            )}
            {isP2PMode && rematchState === "idle" && (
              <button
                onClick={peerLeft ? undefined : onRematch}
                disabled={peerLeft}
                title={peerLeft ? t("gameOver.peerGone") : undefined}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw size={18} /> {t("gameOver.rematch")}
              </button>
            )}
            <button
              onClick={goMainMenu}
              className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition font-medium"
            >
              {t("gameOver.mainMenu")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
