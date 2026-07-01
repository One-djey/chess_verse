import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import NavBar from "./NavBar";
import GameOver from "./GameOver";
import ColiseumBoard from "./ColiseumBoard";
import P2PStatusBar from "./P2PStatusBar";
import GameLabels, { type GameLabelItem } from "./GameLabels";
import { useColiseumGame } from "../hooks/useColiseumGame";
import { useColiseumP2PGame } from "../hooks/useColiseumP2PGame";
import { useP2P } from "../hooks/useP2P";
import { useBoardSkinStyle } from "../hooks/useBoardSkinStyle";
import { useBoardSkin } from "../hooks/useBoardSkin";
import { useSkin } from "../hooks/useSkin";
import { getBoardSkinDef, resolveEffectiveBoardSkin } from "../utils/boardSkin";
import { BoardSkinContext } from "../context/BoardSkinContext";
import { resolveEffectivePieceSkin } from "../utils/pieceImage";
import { CampDecoration } from "./CampDecoration";
import {
  getColiseumLegalMoves,
  isColiseumSquareUnderAttack,
} from "../utils/chess/coliseumMoves";
import { getColiseumAIMove } from "../utils/chess/coliseumAI";
import type { LocalSettings } from "../hooks/useChessGame";
import type { Arena, ColiseumGameState } from "../types/coliseum";
import type { Piece, PieceColor } from "../types/chess";
import type { RematchState } from "../types/p2p";
import type { P2PConnectionState } from "../types/p2p";
import { makeRoomActions } from "../services/TrysteroService";

// ── Shared UI ────────────────────────────────────────────────────────────────

interface ColiseumUIProps {
  state: ColiseumGameState;
  generating: boolean;
  handlePieceSelect: (piece: import("../types/chess").Piece) => void;
  handleDeselect: () => void;
  handleMove: (to: import("../types/chess").Position) => void;
  handleSurrender: (color: PieceColor) => void;
  applyAIMove?: (from: import("../types/chess").Position, to: import("../types/chess").Position) => void;
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
  applyAIMove,
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
  const effectiveSkin = resolveEffectivePieceSkin(skin, "fantasy");
  const [gameOverVisible, setGameOverVisible] = useState(true);
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

  const coordOffset = useMemo(() => {
    const grid = state.arena.grid;
    let lastRow = 0;
    for (let y = grid.length - 1; y >= 0; y--) {
      if (grid[y].some((v) => v === 1)) {
        lastRow = y;
        break;
      }
    }
    let firstCol = grid[0]?.length ?? 0;
    for (const row of grid) {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === 1 && x < firstCol) firstCol = x;
      }
    }
    return {
      x: firstCol < (grid[0]?.length ?? 0) ? firstCol : 0,
      lastRow,
    };
  }, [state.arena]);

  const [gameLabels, setGameLabels] = useState<GameLabelItem[]>([]);
  const prevIsCheck = useRef(false);
  const prevMovesLength = useRef(0);

  const handleSettingsChange = useCallback((s: LocalSettings) => {
    setSettings(s);
    localStorage.setItem("chess_settings", JSON.stringify(s));
  }, []);

  useEffect(() => {
    setGameOverVisible(true);
  }, [state.arena]);

  // AI effect: fire when it's black's turn and AI is enabled
  useEffect(() => {
    if (!applyAIMove || !settings.aiEnabled || state.currentTurn !== "black" || state.gameOver) return;
    const move = getColiseumAIMove(state.pieces, state.arena);
    if (move) applyAIMove(move.from, move.to);
  }, [state.currentTurn, state.gameOver, settings.aiEnabled, state.pieces, state.arena, applyAIMove]);

  const movablePieceIds = useMemo(() => {
    const ids = new Set<string>();
    // In P2P mode, only highlight pieces when it's the local player's turn
    if (isP2PMode && playerColor && state.currentTurn !== playerColor) {
      return ids;
    }
    // When AI is active, black's pieces are not selectable by the user
    if (!isP2PMode && settings.aiEnabled && state.currentTurn === "black") {
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
  }, [state.pieces, state.currentTurn, state.arena, isP2PMode, playerColor, settings.aiEnabled]);

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
    if (state.moves.length > prevMovesLength.current) {
      const last = state.moves[state.moves.length - 1];
      if (last?.capturedPiece) {
        const sq = `${String.fromCharCode(97 + last.to.x - coordOffset.x)}${coordOffset.lastRow - last.to.y + 1}`;
        setGameLabels((prev) => [
          ...prev,
          {
            id: `capture-${Date.now()}`,
            variant: "capture",
            createdAt: Date.now(),
            captureContext: {
              pieceName: t(`profile.pieces.${last.piece.type}`).toLowerCase(),
              pieceColor: t(`chess.colors.${last.piece.color}`),
              capturedName: t(
                `profile.pieces.${last.capturedPiece!.type}`,
              ).toLowerCase(),
              capturedColor: t(`chess.colors.${last.capturedPiece!.color}`),
              square: sq,
            },
          },
        ]);
      }
    }
    prevMovesLength.current = state.moves.length;
  }, [state.moves, coordOffset.x, coordOffset.lastRow, t]);

  const wrappedHandlePieceSelect = useCallback(
    (piece: Piece) => {
      if (settings.showMoveAnnotations) {
        const moves = getColiseumLegalMoves(piece, state.pieces, state.arena);
        if (moves.length === 0) {
          const variant = state.isCheck ? "checkBlockedPiece" : "blockedPiece";
          setGameLabels((prev) => [
            ...prev,
            { id: `blocked-${Date.now()}`, variant, createdAt: Date.now() },
          ]);
        }
      }
      handlePieceSelect(piece);
    },
    [
      handlePieceSelect,
      state.pieces,
      state.arena,
      state.isCheck,
      settings.showMoveAnnotations,
    ],
  );

  const breadcrumbs = isP2PMode
    ? [
        { label: t("modeSelect.multiplayer"), path: "/p2p" },
        { label: t("modes.coliseum.title") },
      ]
    : [
        { label: t("modeSelect.local"), path: "/local" },
        { label: t("modes.coliseum.title") },
      ];

  const boardSkinStyle = useBoardSkinStyle();
  const { boardSkin } = useBoardSkin();
  const skinDef = getBoardSkinDef(boardSkin);

  return (
    <div
      className={`h-screen overflow-hidden flex flex-col ${boardSkinStyle.backgroundImage ? "" : "bg-gray-100"}`}
      style={boardSkinStyle}
    >
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


<div className="flex-1 overflow-hidden flex flex-col">
        <CampDecoration
          campTop={skinDef.campTop}
          campBottom={skinDef.campBottom}
        >
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
              onPieceSelect={wrappedHandlePieceSelect}
              onMove={handleMove}
              onDeselect={handleDeselect}
              skin={effectiveSkin}
              endangeredPieceIds={
                settings.showDangerIndicator ? endangeredPieceIds : undefined
              }
              dangerousValidMoves={
                settings.showDangerIndicator ? dangerousValidMoves : undefined
              }
              hintMove={null}
            />
          )}
        </CampDecoration>
        {settings.showMoveAnnotations && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] w-full max-w-sm px-2 pointer-events-none">
            <div className="pointer-events-auto">
              <GameLabels
                items={gameLabels}
                onDismiss={(id) =>
                  setGameLabels((prev) => prev.filter((i) => i.id !== id))
                }
              />
            </div>
          </div>
        )}
      </div>

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
          aiEnabled={!isP2PMode && settings.aiEnabled}
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
    applyAIMove,
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
      applyAIMove={applyAIMove}
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
}

function ColiseumGameP2P({
  arena,
  role,
  playerColor,
  actions,
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
  } = useColiseumP2PGame({
    arena,
    role,
    playerColor,
    actions,
    connectionState,
  });

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
  const { isP2PMode, role, playerColor, actions, initialArena } = useP2P();
  const { boardSkin, setBoardSkin } = useBoardSkin();
  const effectiveBoardSkin = resolveEffectiveBoardSkin(
    boardSkin,
    "royal-arena",
  );

  let content: React.ReactNode;
  if (isP2PMode && role) {
    if (!initialArena) {
      content = (
        <div className="h-screen flex items-center justify-center bg-gray-100">
          <p className="text-gray-500 text-lg animate-pulse font-medium">
            {t("coliseum.generating", "Generating arena…")}
          </p>
        </div>
      );
    } else {
      content = (
        <ColiseumGameP2P
          arena={initialArena}
          role={role}
          playerColor={playerColor}
          actions={actions}
        />
      );
    }
  } else {
    content = <ColiseumGameLocal />;
  }

  return (
    <BoardSkinContext.Provider
      value={{ boardSkin: effectiveBoardSkin, setBoardSkin }}
    >
      {content}
    </BoardSkinContext.Provider>
  );
}
