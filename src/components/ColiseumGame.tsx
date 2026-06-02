import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import NavBar from "./NavBar";
import GameOver from "./GameOver";
import ColiseumBoard from "./ColiseumBoard";
import GameLabels, { type GameLabelItem } from "./GameLabels";
import { useColiseumGame } from "../hooks/useColiseumGame";
import { useSkin } from "../hooks/useSkin";
import {
  getColiseumLegalMoves,
  isColiseumSquareUnderAttack,
} from "../utils/chess/coliseumMoves";
import type { LocalSettings } from "../hooks/useChessGame";

export default function ColiseumGame() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { skin } = useSkin();
  const [gameOverVisible, setGameOverVisible] = useState(true);
  const {
    state,
    generating,
    handlePieceSelect,
    handleDeselect,
    handleMove,
    handleSurrender,
    regenerate,
    getDuration,
    getTotalMoveCount,
  } = useColiseumGame();

  // Local game settings
  const [settings, setSettings] = useState<LocalSettings>(() => {
    try {
      return {
        aiEnabled: false,
        aiDifficulty: 5,
        flipBoard: false,
        showDangerIndicator: false,
        showHint: false,
        showMoveAnnotations: false,
        ...JSON.parse(localStorage.getItem("chess_settings") ?? "{}"),
      };
    } catch {
      return {
        aiEnabled: false,
        aiDifficulty: 5,
        flipBoard: false,
        showDangerIndicator: false,
        showHint: false,
        showMoveAnnotations: false,
      };
    }
  });

  const [gameLabels, setGameLabels] = useState<GameLabelItem[]>([]);
  const prevIsCheck = useRef(false);
  const prevMoveCount = useRef(0);

  const handleSettingsChange = useCallback((s: LocalSettings) => {
    setSettings(s);
    localStorage.setItem("chess_settings", JSON.stringify(s));
  }, []);

  useEffect(() => {
    setGameOverVisible(true);
  }, [state.arena]);

  const movablePieceIds = useMemo(() => {
    const ids = new Set<string>();
    state.pieces
      .filter((p) => p.color === state.currentTurn)
      .forEach((p) => {
        if (getColiseumLegalMoves(p, state.pieces, state.arena).length > 0) {
          ids.add(p.id);
        }
      });
    return ids;
  }, [state.pieces, state.currentTurn, state.arena]);

  const endangeredPieceIds = useMemo(() => {
    const ids = new Set<string>();
    const opponent = state.currentTurn === "white" ? "black" : "white";
    const opponentPieces = state.pieces.filter((p) => p.color === opponent);
    const currentPieces = state.pieces.filter(
      (p) => p.color === state.currentTurn,
    );

    opponentPieces.forEach((op) => {
      const moves = getColiseumLegalMoves(op, state.pieces, state.arena);
      moves.forEach((move) => {
        const threatened = currentPieces.find(
          (p) => p.position.x === move.x && p.position.y === move.y,
        );
        if (threatened) ids.add(threatened.id);
      });
    });
    return ids;
  }, [state.pieces, state.currentTurn, state.arena]);

  const dangerousValidMoves = useMemo(() => {
    const dangerous = new Set<string>();
    if (!state.selectedPiece) return dangerous;
    const opponent = state.currentTurn === "white" ? "black" : "white";

    state.validMoves.forEach((move) => {
      // Simulate the board after this move
      const piecesAfter = state.pieces
        .filter((p) => !(p.position.x === move.x && p.position.y === move.y))
        .map((p) =>
          p.id === state.selectedPiece!.id ? { ...p, position: move } : p,
        );

      // Check if the moved piece is under attack after the move
      if (
        isColiseumSquareUnderAttack(move, opponent, piecesAfter, state.arena)
      ) {
        dangerous.add(`${move.x},${move.y}`);
      }
    });
    return dangerous;
  }, [
    state.validMoves,
    state.selectedPiece,
    state.pieces,
    state.currentTurn,
    state.arena,
  ]);

  // Add check label when check starts
  useEffect(() => {
    if (state.isCheck && !prevIsCheck.current) {
      setGameLabels((prev) => [
        ...prev,
        {
          id: `check-${Date.now()}`,
          variant: "check",
          createdAt: Date.now(),
        },
      ]);
    }
    prevIsCheck.current = state.isCheck;
  }, [state.isCheck]);

  // Add capture label on capture
  useEffect(() => {
    const total = state.moveCount.white + state.moveCount.black;
    if (total > prevMoveCount.current && state.moves.length > 0) {
      const last = state.moves[state.moves.length - 1];
      if (last.capturedPiece) {
        setGameLabels((prev) => [
          ...prev,
          {
            id: `capture-${Date.now()}`,
            variant: "capture",
            createdAt: Date.now(),
          },
        ]);
      }
    }
    prevMoveCount.current = total;
  }, [state.moveCount, state.moves]);

  const breadcrumbs = [
    { label: t("modeSelect.local"), path: "/local" },
    { label: t("modes.coliseum.title") },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <NavBar
        breadcrumbs={breadcrumbs}
        onSurrender={
          !state.gameOver ? () => handleSurrender(state.currentTurn) : undefined
        }
        onShowResult={
          state.gameOver && !gameOverVisible
            ? () => setGameOverVisible(true)
            : undefined
        }
        gameSettings={settings}
        onGameSettingsChange={handleSettingsChange}
        gameMode="coliseum"
      />

      <div className="flex-1 flex items-center justify-center p-4">
        {generating ? (
          <div className="text-gray-500 text-lg animate-pulse font-medium">
            {t("coliseum.generating", "Generating arena…")}
          </div>
        ) : (
          <ColiseumBoard
            arena={state.arena}
            pieces={state.pieces}
            currentTurn={state.currentTurn}
            selectedPiece={state.selectedPiece}
            validMoves={state.validMoves}
            isCheck={state.isCheck}
            movablePieceIds={movablePieceIds}
            onPieceSelect={handlePieceSelect}
            onMove={handleMove}
            onDeselect={handleDeselect}
            skin={skin}
            endangeredPieceIds={
              settings.showDangerIndicator ? endangeredPieceIds : undefined
            }
            dangerousValidMoves={
              settings.showDangerIndicator ? dangerousValidMoves : undefined
            }
            hintMove={null}
          />
        )}
      </div>

      {settings.showMoveAnnotations && (
        <GameLabels
          items={gameLabels}
          onDismiss={(id) =>
            setGameLabels((prev) => prev.filter((i) => i.id !== id))
          }
        />
      )}

      {state.gameOver && gameOverVisible && (
        <GameOver
          winner={state.winner}
          drawReason={!state.winner ? "stalemate" : undefined}
          duration={getDuration()}
          moveCount={getTotalMoveCount()}
          onReplay={regenerate}
          returnPath="/local"
          onMainMenu={() => navigate("/local")}
          onDismiss={() => setGameOverVisible(false)}
        />
      )}
    </div>
  );
}
