import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Users, X } from "lucide-react";
import NavBar from "./NavBar";
import GameOver from "./GameOver";
import ColiseumBoard from "./ColiseumBoard";
import P2PStatusBar from "./P2PStatusBar";
import GameLabels, { type GameLabelItem } from "./GameLabels";
import { useColiseumGame } from "../hooks/useColiseumGame";
import { useColiseumP2PGame } from "../hooks/useColiseumP2PGame";
import { useP2P } from "../hooks/useP2P";
import { useSkin } from "../hooks/useSkin";
import {
  getColiseumLegalMoves,
  isColiseumSquareUnderAttack,
} from "../utils/chess/coliseumMoves";
import type { LocalSettings } from "../hooks/useChessGame";
import type { Arena, ColiseumGameState } from "../types/coliseum";
import type { PieceColor } from "../types/chess";
import type { RematchState } from "../types/p2p";
import type { P2PConnectionState } from "../types/p2p";
import { makeRoomActions } from "../services/TrysteroService";
import type { Room } from "@trystero-p2p/core";

// ── Shared UI ────────────────────────────────────────────────────────────────

interface ColiseumUIProps {
  state: ColiseumGameState;
  generating: boolean;
  handlePieceSelect: (piece: import("../types/chess").Piece) => void;
  handleDeselect: () => void;
  handleMove: (to: import("../types/chess").Position) => void;
  handleSurrender: (color: PieceColor) => void;
  onReplay?: () => void;
  getDuration: () => number;
  getTotalMoveCount: () => number;
  returnPath: string;
  onMainMenu: () => void;
  isP2PMode?: boolean;
  playerColor?: PieceColor | null;
  connectionState?: P2PConnectionState;
  onLeave?: () => void;
  rematchState?: RematchState;
  peerLeft?: boolean;
  onRematch?: () => void;
  onAcceptRematch?: () => void;
  onDeclineRematch?: () => void;
}

function ColiseumUI({
  state,
  generating,
  handlePieceSelect,
  handleDeselect,
  handleMove,
  handleSurrender,
  onReplay,
  getDuration,
  getTotalMoveCount,
  returnPath,
  onMainMenu,
  isP2PMode,
  playerColor,
  connectionState,
  onLeave,
  rematchState,
  peerLeft,
  onRematch,
  onAcceptRematch,
  onDeclineRematch,
}: ColiseumUIProps) {
  const { t } = useTranslation();
  const { skin } = useSkin();
  const [gameOverVisible, setGameOverVisible] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);
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
    // In P2P mode, only highlight pieces when it's the local player's turn
    if (isP2PMode && playerColor && state.currentTurn !== playerColor) {
      return ids;
    }
    state.pieces
      .filter((p) => p.color === state.currentTurn)
      .forEach((p) => {
        if (getColiseumLegalMoves(p, state.pieces, state.arena).length > 0) {
          ids.add(p.id);
        }
      });
    return ids;
  }, [state.pieces, state.currentTurn, state.arena, isP2PMode, playerColor]);

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
      const piecesAfter = state.pieces
        .filter((p) => !(p.position.x === move.x && p.position.y === move.y))
        .map((p) =>
          p.id === state.selectedPiece!.id ? { ...p, position: move } : p,
        );
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

  useEffect(() => {
    if (state.isCheck && !prevIsCheck.current) {
      setGameLabels((prev) => [
        ...prev,
        { id: `check-${Date.now()}`, variant: "check", createdAt: Date.now() },
      ]);
    }
    prevIsCheck.current = state.isCheck;
  }, [state.isCheck]);

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

  const breadcrumbs = isP2PMode
    ? [
        { label: t("modeSelect.multiplayer"), path: "/p2p" },
        { label: t("modes.coliseum.title") },
      ]
    : [
        { label: t("modeSelect.local"), path: "/local" },
        { label: t("modes.coliseum.title") },
      ];

  return (
    <div className="h-screen overflow-hidden bg-gray-100 flex flex-col">
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
        gameSettings={!isP2PMode ? settings : null}
        onGameSettingsChange={!isP2PMode ? handleSettingsChange : undefined}
        gameMode="coliseum"
      />

      {isP2PMode && connectionState && onLeave && (
        <P2PStatusBar
          connectionState={connectionState}
          playerColor={playerColor ?? null}
          currentTurn={state.currentTurn}
          onLeave={onLeave}
        />
      )}

      {!isP2PMode && !bannerDismissed && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 px-4 py-2 flex items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2">
            <Users size={15} className="shrink-0 text-amber-600" />
            <span>{t("modes.coliseum.localOnlyBanner")}</span>
          </div>
          <button
            onClick={() => setBannerDismissed(true)}
            className="shrink-0 text-amber-500 hover:text-amber-700 transition-colors"
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      )}

      <div className="flex-1 flex items-center justify-center p-2 overflow-hidden">
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
          surrenderedBy={state.surrenderedBy}
          duration={getDuration()}
          moveCount={getTotalMoveCount()}
          onReplay={onReplay ?? (() => {})}
          returnPath={returnPath}
          onMainMenu={onMainMenu}
          onDismiss={() => setGameOverVisible(false)}
          isP2PMode={isP2PMode}
          playerColor={playerColor}
          rematchState={rematchState}
          peerLeft={peerLeft}
          onRematch={onRematch}
          onAcceptRematch={onAcceptRematch}
          onDeclineRematch={onDeclineRematch}
        />
      )}
    </div>
  );
}

// ── Local game ───────────────────────────────────────────────────────────────

function ColiseumGameLocal() {
  const navigate = useNavigate();
  const [gameKey, setGameKey] = useState(0);
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

  const handleReplay = useCallback(() => {
    regenerate();
    setGameKey((k) => k + 1);
  }, [regenerate]);

  return (
    <ColiseumUI
      key={gameKey}
      state={state}
      generating={generating}
      handlePieceSelect={handlePieceSelect}
      handleDeselect={handleDeselect}
      handleMove={handleMove}
      handleSurrender={handleSurrender}
      onReplay={handleReplay}
      getDuration={getDuration}
      getTotalMoveCount={getTotalMoveCount}
      returnPath="/local"
      onMainMenu={() => navigate("/local")}
    />
  );
}

// ── P2P game ─────────────────────────────────────────────────────────────────

interface ColiseumGameP2PProps {
  arena: Arena;
  role: "host" | "guest";
  playerColor: PieceColor | null;
  actions: ReturnType<typeof makeRoomActions> | null;
  room: Room | null;
}

function ColiseumGameP2P({
  arena,
  role,
  playerColor,
  actions,
  room,
}: ColiseumGameP2PProps) {
  const navigate = useNavigate();
  const { connectionState, leaveRoom } = useP2P();
  const {
    state,
    handlePieceSelect,
    handleDeselect,
    handleMove,
    handleSurrender,
    getDuration,
    getTotalMoveCount,
    rematchState,
    peerLeft,
    handleRematch,
    handleAcceptRematch,
    handleDeclineRematch,
  } = useColiseumP2PGame({ arena, role, playerColor, actions, room });

  const handleLeave = () => {
    leaveRoom();
    navigate("/p2p");
  };

  return (
    <ColiseumUI
      state={state}
      generating={false}
      handlePieceSelect={handlePieceSelect}
      handleDeselect={handleDeselect}
      handleMove={handleMove}
      handleSurrender={handleSurrender}
      getDuration={getDuration}
      getTotalMoveCount={getTotalMoveCount}
      returnPath="/p2p"
      onMainMenu={() => navigate("/p2p")}
      isP2PMode
      playerColor={playerColor}
      connectionState={connectionState}
      onLeave={handleLeave}
      rematchState={rematchState}
      peerLeft={peerLeft}
      onRematch={handleRematch}
      onAcceptRematch={handleAcceptRematch}
      onDeclineRematch={handleDeclineRematch}
    />
  );
}

// ── Entry point ──────────────────────────────────────────────────────────────

export default function ColiseumGame() {
  const { t } = useTranslation();
  const { isP2PMode, role, playerColor, actions, room, initialArena } =
    useP2P();

  if (isP2PMode && role) {
    if (!initialArena) {
      return (
        <div className="h-screen flex items-center justify-center bg-gray-100">
          <p className="text-gray-500 text-lg animate-pulse font-medium">
            {t("coliseum.generating", "Generating arena…")}
          </p>
        </div>
      );
    }
    return (
      <ColiseumGameP2P
        arena={initialArena}
        role={role}
        playerColor={playerColor}
        actions={actions}
        room={room}
      />
    );
  }

  return <ColiseumGameLocal />;
}
