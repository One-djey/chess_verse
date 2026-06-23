import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Skull, Swords } from "lucide-react";
import NavBar from "./NavBar";
import GameOver from "./GameOver";
import ChessBoard from "./ChessBoard";
import { PromotionPicker } from "./PromotionPicker";
import { useZombieHordeGame } from "../hooks/useZombieHordeGame";
import { useSkin } from "../hooks/useSkin";
import { useBoardSkinStyle } from "../hooks/useBoardSkinStyle";
import { getValidMoves } from "../utils/chess/moves";
import type { GameMode, Piece } from "../types/chess";

const CLASSIC_MODE: GameMode = {
  id: "classic",
  title: "Classic",
  description: "",
  image: "",
  rules: {},
};

function WaveStatusBar({
  wave,
  zombiesKilled,
  isThinking,
}: {
  wave: number;
  zombiesKilled: number;
  isThinking: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-gray-800 text-white text-sm font-medium">
      <div className="flex items-center gap-1.5">
        <Swords size={14} className="text-amber-400" />
        <span>
          {t("zombieHorde.wave")} {Math.max(wave, 1)}
          {wave >= 10 ? " 🔥" : ""}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Skull size={14} className="text-green-400" />
        <span>
          {zombiesKilled} {t("zombieHorde.zombiesKilled")}
        </span>
      </div>
      {isThinking && (
        <div className="ml-auto flex items-center gap-2 text-red-400 animate-pulse">
          <Skull size={14} />
          <span>{t("zombieHorde.hordeThinking")}</span>
        </div>
      )}
    </div>
  );
}

export default function ZombieHordeGame() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { skin } = useSkin();
  const boardSkinStyle = useBoardSkinStyle();

  const {
    state,
    enPassantTarget,
    handlePieceSelect,
    handleMove,
    handlePromotion,
    handleSurrender,
    handleRestart,
    getDuration,
  } = useZombieHordeGame();

  const [gameOverVisible, setGameOverVisible] = useState(true);

  const movablePieceIds = useMemo(() => {
    const ids = new Set<string>();
    if (state.gameOver || state.wave.isZombiesThinking || state.pendingPromotion)
      return ids;
    state.pieces
      .filter((p) => p.color === "white")
      .forEach((p) => {
        if (getValidMoves(p, state.pieces, CLASSIC_MODE, enPassantTarget).length > 0)
          ids.add(p.id);
      });
    return ids;
  }, [state.pieces, state.gameOver, state.wave.isZombiesThinking, state.pendingPromotion, enPassantTarget]);

  const handleReplay = () => {
    handleRestart();
    setGameOverVisible(true);
  };

  const handleMainMenu = () => navigate("/local");
  const isVictory = state.winner === "white";

  const breadcrumbs = [
    { label: t("modeSelect.local"), path: "/local" },
    { label: t("modes.zombie-horde.title") },
  ];

  return (
    <div
      className={`h-screen overflow-hidden flex flex-col ${boardSkinStyle.backgroundImage ? "" : "bg-gray-100"}`}
      style={boardSkinStyle}
    >
      <NavBar
        breadcrumbs={breadcrumbs}
        onSurrender={!state.gameOver ? handleSurrender : undefined}
        onShowResult={
          state.gameOver && !gameOverVisible
            ? () => setGameOverVisible(true)
            : undefined
        }
      />

      <WaveStatusBar
        wave={state.wave.currentWave}
        zombiesKilled={state.wave.zombiesKilled}
        isThinking={state.wave.isZombiesThinking}
      />

      {/* Interaction blocker while zombies think */}
      <div className="flex-1 overflow-hidden relative">
        {state.wave.isZombiesThinking && (
          <div className="absolute inset-0 z-50 cursor-not-allowed" />
        )}

        {/* Promotion picker floats above board */}
        <div style={{ height: 0, overflow: "visible", position: "relative" }}>
          {state.pendingPromotion && (
            <div className="flex justify-center">
              <PromotionPicker color="white" onSelect={handlePromotion} />
            </div>
          )}
        </div>

        <div className="h-full flex items-center justify-center p-2">
          <ChessBoard
            pieces={state.pieces}
            currentTurn="white"
            selectedPiece={state.selectedPiece}
            validMoves={state.validMoves}
            isCheck={state.isCheck}
            onPieceSelect={(piece: Piece) => handlePieceSelect(piece)}
            onMove={handleMove}
            gameMode={CLASSIC_MODE}
            lockedColor="white"
            skin={skin}
            movablePieceIds={movablePieceIds}
            hintMove={null}
          />
        </div>
      </div>

      {state.gameOver && gameOverVisible && (
        <GameOver
          winner={isVictory ? "white" : "black"}
          duration={getDuration()}
          moveCount={state.moveCount}
          aiEnabled={!isVictory}
          onReplay={handleReplay}
          returnPath="/local"
          onMainMenu={handleMainMenu}
          onDismiss={() => setGameOverVisible(false)}
        />
      )}
    </div>
  );
}
