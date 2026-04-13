import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import ChessBoard from "./ChessBoard";
import GameOver from "./GameOver";
import NavBar from "./NavBar";
import P2PStatusBar from "./P2PStatusBar";
import { Piece, Position, GameMode, PieceColor } from "../types/chess";
import { getValidMoves, applyMoveToState, normalizePos, isSquareUnderAttack, detectTactic, MoveContext, TacticTag } from "../utils/chess";
import { gameModes } from "./GameModes";
import { useP2P } from "../context/P2PContext";
import { useChessGame } from "../hooks/useChessGame";
import { useP2PGame } from "../hooks/useP2PGame";
import { useSkin } from "../context/SkinContext";

const TACTIC_ICONS: Record<TacticTag, string> = {
  check: "♟",
  discoveredCheck: "♟",
  fork: "⚔️",
  pin: "📌",
  capture: "✕",
  promotion: "♛",
  castling: "🏰",
};

function AnnotationToast({
  tag,
  onDismiss,
}: {
  tag: TacticTag;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();

  React.useEffect(() => {
    const id = setTimeout(onDismiss, 4000);
    return () => clearTimeout(id);
  }, [tag, onDismiss]);

  const desc = t(`learning.tactics.${tag}Desc`);

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg shadow-md text-sm text-gray-700">
      <span>{TACTIC_ICONS[tag]}</span>
      <div>
        <span className="font-semibold">{t(`learning.tactics.${tag}`)}</span>
        {desc && (
          <span className="ml-1.5 text-gray-500 text-xs">{desc}</span>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="ml-2 text-gray-400 hover:text-gray-600"
      >
        <X size={14} />
      </button>
    </div>
  );
}

function resolveGameMode(
  modeId: string | undefined,
  p2pMode: GameMode | null,
): GameMode {
  if (modeId === "p2p" && p2pMode) return p2pMode;
  return gameModes.find((m) => m.id === modeId) ?? gameModes[0];
}

export default function Game() {
  const { modeId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const p2p = useP2P();
  const { skin } = useSkin();

  // Ref updated on every render so the cleanup always reads the *current* P2P state,
  // avoiding the stale-closure problem of capturing p2p.isP2PMode at first-render time.
  const isActiveP2PRef = React.useRef(false);
  isActiveP2PRef.current = modeId === "p2p" && p2p.isP2PMode;

  // If we enter a non-P2P game while P2P state is still active (e.g. user navigated
  // away via the NavBar without going through handleLeaveP2P), clean up the stale state.
  // Also clean up on unmount so the WebRTC room is closed immediately when leaving,
  // even via NavBar/browser-back, without waiting for the next game to mount.
  React.useEffect(() => {
    if (modeId !== "p2p" && p2p.isP2PMode) {
      p2p.leaveRoom();
    }
    return () => {
      if (isActiveP2PRef.current) p2p.leaveRoom();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const gameMode = resolveGameMode(modeId, p2p.gameMode);

  const chess = useChessGame({
    modeId,
    navigate,
    gameMode,
    isP2PMode: p2p.isP2PMode,
    p2pInitialPieces: p2p.initialPieces,
  });

  const p2pGame = useP2PGame({
    isP2PMode: p2p.isP2PMode,
    role: p2p.role,
    playerColor: p2p.playerColor,
    actions: p2p.actions,
    room: p2p.room,
    gameMode,
    setGameState: chess.setGameState,
    gameStateRef: chess.gameStateRef,
    chessResetGame: chess.resetGame,
  });

  // ── AI move trigger ────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (
      !chess.aiEnabled ||
      chess.gameState.currentTurn !== "black" ||
      chess.gameState.gameOver
    )
      return;

    let cancelled = false;

    const applyMove = (move: { from: { x: number; y: number }; to: { x: number; y: number } }) => {
      const piece = chess.gameState.pieces.find(
        (p) =>
          p.position.x === move.from.x &&
          p.position.y === move.from.y &&
          p.color === "black",
      );
      if (!piece) return;
      const valid = getValidMoves(
        piece,
        chess.gameState.pieces,
        chess.gameState.gameMode,
      ).some((v) => v.x === move.to.x && v.y === move.to.y);
      if (!valid) return;
      chess.setGameState((prev) => {
        const nextState = applyMoveToState(prev, piece, move.to);
        const capturedPiece =
          prev.pieces.find(
            (p) =>
              p.color !== piece.color &&
              p.position.x === move.to.x &&
              p.position.y === move.to.y,
          ) ?? null;
        triggerAnnotation({
          piece,
          from: piece.position,
          to: move.to,
          capturedPiece,
          wasPromotion:
            piece.type === "pawn" && (move.to.y === 0 || move.to.y === 7),
          wasCastling:
            piece.type === "king" &&
            Math.abs(piece.position.x - move.to.x) === 2,
          prevPieces: prev.pieces,
          nextPieces: nextState.pieces,
          gameMode: prev.gameMode,
        });
        return nextState;
      });
    };

    const trigger = async (retriesLeft: number) => {
      if (cancelled) return;
      if (!chess.aiRef.current) {
        if (retriesLeft > 0)
          setTimeout(() => trigger(retriesLeft - 1), 1000);
        return;
      }
      try {
        const move = await chess.aiRef.current.getNextMove(
          chess.gameState.pieces,
        );
        if (!cancelled) applyMove(move);
      } catch (e) {
        console.error("AI move failed:", e);
        if (cancelled) return;
        if (retriesLeft > 0) {
          // Try to reinitialise the engine before retrying
          chess.aiRef.current?.restart?.();
          setTimeout(() => trigger(retriesLeft - 1), 800);
        } else {
          // All retries exhausted — disable AI so the player can continue
          console.warn("AI permanently failed after 3 retries. Disabling AI.");
          chess.handleSettingsChange({ ...chess.settings, aiEnabled: false });
        }
      }
    };

    const id = setTimeout(() => trigger(3), 500);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [chess.gameState.currentTurn, chess.aiEnabled, chess.gameState.gameOver]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Movable pieces (for check highlight) ──────────────────────────────────
  // When in check, only pieces that have at least one valid move should glow.
  const movablePieceIds = React.useMemo<Set<string> | null>(() => {
    if (!chess.gameState.isCheck) return null;
    const ids = new Set<string>();
    chess.gameState.pieces
      .filter((p) => p.color === chess.gameState.currentTurn)
      .forEach((p) => {
        if (
          getValidMoves(p, chess.gameState.pieces, chess.gameState.gameMode)
            .length > 0
        ) {
          ids.add(p.id);
        }
      });
    return ids;
  }, [
    chess.gameState.isCheck,
    chess.gameState.pieces,
    chess.gameState.currentTurn,
    chess.gameState.gameMode,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Danger indicator ──────────────────────────────────────────────────────
  const endangeredPieceIds = React.useMemo<Set<string>>(() => {
    if (!chess.settings.showDangerIndicator) return new Set();
    const opp =
      chess.gameState.currentTurn === "white" ? "black" : "white";
    const ids = new Set<string>();
    chess.gameState.pieces
      .filter((p) => p.color === chess.gameState.currentTurn)
      .forEach((p) => {
        if (
          isSquareUnderAttack(
            p.position,
            opp,
            chess.gameState.pieces,
            chess.gameState.gameMode,
          )
        ) {
          ids.add(p.id);
        }
      });
    return ids;
  }, [
    chess.settings.showDangerIndicator,
    chess.gameState.pieces,
    chess.gameState.currentTurn,
    chess.gameState.gameMode,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Hint (auto-calculated at the start of each turn) ─────────────────────
  const [hintMove, setHintMove] = React.useState<{
    from: Position;
    to: Position;
  } | null>(null);

  // Hint is available when the option is on, not in P2P, and it's the human's turn
  const canShowHint =
    chess.settings.showHint &&
    !p2p.isP2PMode &&
    !chess.gameState.gameOver &&
    (!chess.aiEnabled || chess.gameState.currentTurn === "white");

  React.useEffect(() => {
    setHintMove(null);
    if (!canShowHint || !chess.aiRef.current) return;
    chess.aiRef.current
      .getHintMove(chess.gameState.pieces, chess.gameState.currentTurn)
      .then((move) => setHintMove(move))
      .catch((e) => console.error("Hint:", e));
  }, [chess.gameState.currentTurn, canShowHint]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dangerous valid moves (for orange overlay on risky destinations) ───────
  const dangerousValidMoves = React.useMemo<Set<string>>(() => {
    if (!chess.settings.showDangerIndicator || !chess.gameState.selectedPiece)
      return new Set();
    const opp =
      chess.gameState.currentTurn === "white" ? "black" : "white";
    const result = new Set<string>();
    chess.gameState.validMoves.forEach((move) => {
      const nx = ((move.x % 8) + 8) % 8;
      const ny = ((move.y % 8) + 8) % 8;
      if (
        isSquareUnderAttack(
          { x: nx, y: ny },
          opp,
          chess.gameState.pieces,
          chess.gameState.gameMode,
        )
      ) {
        result.add(`${nx},${ny}`);
      }
    });
    return result;
  }, [
    chess.settings.showDangerIndicator,
    chess.gameState.selectedPiece,
    chess.gameState.validMoves,
    chess.gameState.pieces,
    chess.gameState.currentTurn,
    chess.gameState.gameMode,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Annotations ───────────────────────────────────────────────────────────
  const [annotation, setAnnotation] = React.useState<TacticTag | null>(null);
  const [annotationDismissed, setAnnotationDismissed] = React.useState(false);

  const triggerAnnotation = React.useCallback(
    (ctx: MoveContext) => {
      if (!chess.settings.showMoveAnnotations) return;
      const tag = detectTactic(ctx);
      if (tag) {
        setAnnotation(tag);
        setAnnotationDismissed(false);
      }
    },
    [chess.settings.showMoveAnnotations],
  );

  // ── Analytics ─────────────────────────────────────────────────────────────
  const playType = p2p.isP2PMode ? "multiplayer" : "local";

  React.useEffect(() => {
    if (chess.gameState.pieces.length === 0) return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "game_start",
      game_mode: chess.gameState.gameMode.id,
      play_type: playType,
      ai_enabled: chess.aiEnabled,
      ...(chess.aiEnabled && { ai_difficulty: chess.settings.aiDifficulty }),
    });
  }, [chess.gameState.startTime]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (!chess.gameState.gameOver) return;
    const {
      winner,
      surrenderedBy,
      drawReason,
      moveCount,
      startTime,
      gameMode,
    } = chess.gameState;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "game_end",
      game_mode: gameMode.id,
      play_type: playType,
      result: winner ? `${winner}_wins` : "draw",
      end_reason: surrenderedBy ? "surrender" : (drawReason ?? "checkmate"),
      duration_seconds: Math.round((Date.now() - startTime) / 1000),
      move_count: moveCount.white + moveCount.black,
    });
  }, [chess.gameState.gameOver]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pinned-piece notification ─────────────────────────────────────────────
  const [pinnedNotice, setPinnedNotice] = React.useState(false);

  // ── User action handlers ───────────────────────────────────────────────────
  const handlePieceSelect = (piece: Piece) => {
    if (
      p2p.isP2PMode
        ? piece.color !== p2p.playerColor
        : chess.aiEnabled && piece.color === "black"
    )
      return;
    if (piece.color !== chess.gameState.currentTurn) return;
    const moves = getValidMoves(
      piece,
      chess.gameState.pieces,
      chess.gameState.gameMode,
    );
    if (moves.length === 0) {
      setPinnedNotice(true);
      // Auto-dismiss
      setTimeout(() => setPinnedNotice(false), 3000);
    }
    chess.setGameState((prev) => ({
      ...prev,
      selectedPiece: piece,
      validMoves: moves,
    }));
  };

  const handleMove = (target: Position) => {
    const { selectedPiece } = chess.gameState;
    if (!selectedPiece) return;
    const norm = normalizePos(target.x, target.y);

    if (p2p.isP2PMode && p2p.role === "guest") {
      p2p.actions?.sendMoveProposal({
        type: "move_proposal",
        pieceId: selectedPiece.id,
        from: selectedPiece.position,
        to: norm,
      });
      chess.setGameState((prev) => ({
        ...prev,
        selectedPiece: null,
        validMoves: [],
      }));
      return;
    }

    if (p2p.isP2PMode && p2p.role === "host") {
      p2pGame.seqRef.current++;
      p2p.actions?.sendMoveConfirm({
        type: "move_confirm",
        pieceId: selectedPiece.id,
        from: selectedPiece.position,
        to: norm,
        seq: p2pGame.seqRef.current,
      });
    }

    chess.setGameState((prev) => {
      const nextState = applyMoveToState(prev, selectedPiece, norm);
      const capturedPiece =
        prev.pieces.find(
          (p) =>
            p.color !== selectedPiece.color &&
            p.position.x === norm.x &&
            p.position.y === norm.y,
        ) ?? null;
      triggerAnnotation({
        piece: selectedPiece,
        from: selectedPiece.position,
        to: norm,
        capturedPiece,
        wasPromotion:
          selectedPiece.type === "pawn" && (norm.y === 0 || norm.y === 7),
        wasCastling:
          selectedPiece.type === "king" &&
          Math.abs(selectedPiece.position.x - norm.x) === 2,
        prevPieces: prev.pieces,
        nextPieces: nextState.pieces,
        gameMode: prev.gameMode,
      });
      return nextState;
    });
  };

  const handleResign = () => {
    const myColor: PieceColor = p2p.isP2PMode
      ? (p2p.playerColor ?? "white")
      : chess.gameState.currentTurn;
    if (p2p.isP2PMode) p2p.actions?.sendResign({ type: "resign" });
    chess.setGameState((prev) => ({
      ...prev,
      gameOver: true,
      winner: myColor === "white" ? "black" : "white",
      surrenderedBy: myColor,
    }));
  };

  const returnPath = p2p.isP2PMode ? "/p2p" : "/local";
  const handleLeaveP2P = () => {
    p2p.leaveRoom();
    navigate(returnPath);
  };

  // ── Board orientation ──────────────────────────────────────────────────────
  const lockedColor: PieceColor | null = p2p.isP2PMode
    ? p2p.playerColor
    : chess.aiEnabled
      ? "white"
      : null;
  const boardFlipped = p2p.isP2PMode
    ? p2p.playerColor === "black"
    : !chess.aiEnabled && chess.settings.flipBoard
      ? chess.gameState.currentTurn === "black"
      : false;
  const rotatePieces =
    !p2p.isP2PMode && !chess.aiEnabled && !chess.settings.flipBoard;

  const playTypeLabel = p2p.isP2PMode
    ? t("modeSelect.multiplayer")
    : t("modeSelect.local");

  return (
    <div className="min-h-screen bg-gray-100">
      <NavBar
        breadcrumbs={[
          { label: playTypeLabel },
          { label: t(`modes.${chess.gameState.gameMode.id}.title`) },
        ]}
        onSurrender={handleResign}
        gameSettings={!p2p.isP2PMode ? chess.settings : null}
        onGameSettingsChange={
          !p2p.isP2PMode ? chess.handleSettingsChange : undefined
        }
      />

      {p2p.isP2PMode && (
        <P2PStatusBar
          connectionState={p2p.connectionState}
          playerColor={p2p.playerColor}
          currentTurn={chess.gameState.currentTurn}
          onLeave={handleLeaveP2P}
        />
      )}

      <div className="flex flex-col items-center justify-center p-2 sm:p-8 gap-3">
        <ChessBoard
          pieces={chess.gameState.pieces}
          currentTurn={chess.gameState.currentTurn}
          selectedPiece={chess.gameState.selectedPiece}
          validMoves={chess.gameState.validMoves}
          isCheck={chess.gameState.isCheck}
          onPieceSelect={handlePieceSelect}
          onMove={handleMove}
          gameMode={chess.gameState.gameMode}
          lockedColor={lockedColor}
          flipped={boardFlipped}
          rotateBlackPieces={rotatePieces}
          movablePieceIds={movablePieceIds}
          endangeredPieceIds={endangeredPieceIds}
          hintMove={hintMove}
          dangerousValidMoves={dangerousValidMoves}
          skin={skin}
          peerSkin={p2p.peerSkin ?? undefined}
        />

        {/* Pinned-piece notice */}
        {pinnedNotice && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-orange-200 rounded-lg shadow-md text-sm text-orange-700">
            <span>⚠️</span>
            <span>{t("learning.pinnedPiece")}</span>
            <button
              onClick={() => setPinnedNotice(false)}
              className="ml-2 text-orange-400 hover:text-orange-600"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Annotation toast */}
        {annotation && !annotationDismissed && chess.settings.showMoveAnnotations && (
          <AnnotationToast
            tag={annotation}
            onDismiss={() => setAnnotationDismissed(true)}
          />
        )}
      </div>

      {chess.gameState.gameOver && (
        <GameOver
          winner={chess.gameState.winner}
          drawReason={chess.gameState.drawReason}
          surrenderedBy={chess.gameState.surrenderedBy}
          duration={Date.now() - chess.gameState.startTime}
          moveCount={
            chess.gameState.winner
              ? chess.gameState.moveCount[chess.gameState.winner]
              : chess.gameState.moveCount.white +
                chess.gameState.moveCount.black
          }
          onReplay={chess.handleReplay}
          aiEnabled={chess.aiEnabled}
          aiDifficulty={chess.settings.aiDifficulty}
          isP2PMode={p2p.isP2PMode}
          playerColor={p2p.playerColor}
          rematchState={p2pGame.rematchState}
          peerLeft={p2pGame.peerLeft}
          onRematch={p2pGame.handleRematch}
          onAcceptRematch={p2pGame.handleAcceptRematch}
          onDeclineRematch={p2pGame.handleDeclineRematch}
          onMainMenu={p2p.isP2PMode ? handleLeaveP2P : undefined}
          returnPath={returnPath}
        />
      )}
    </div>
  );
}
